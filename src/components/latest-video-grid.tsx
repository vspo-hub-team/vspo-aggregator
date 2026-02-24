'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Video, Member, Clipper } from '@/types/database'
import { LatestVideoCard } from '@/components/latest-video-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useMembers } from '@/hooks/use-members'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ClipperListView } from './clipper-list-view'
import { SearchBar } from './search-bar'
import Link from 'next/link'

type MainTab = 'archives' | 'jp_clips' | 'cn_clips'
type PlatformFilter = 'all' | 'youtube' | 'twitch'
type ContentFilter = 'all' | 'video' | 'shorts' | 'channels'

const PAGE_SIZE = 24

// 成員暱稱字典（Alias Dictionary）
// 用於精華影片搜尋，因為剪輯頻道常用暱稱而非官方全名
const MEMBER_ALIAS_DICT: Record<string, string[]> = {
  '橘ひなの': ['ひなの', 'ひなーの'],
  '紡木こかげ': ['こかげ', 'つむお'],
  '如月れん': ['れんくん'],
  '紫宮るな': ['るな'],
  '花芽なずな': ['なずな', 'なずぴ'],
  '八雲べに': ['べに'],
  // 可以繼續擴充其他成員的暱稱
}

// 判斷是否為中文標題
function isChineseTitle(title: string): boolean {
  const chinesePatterns = /【|】|中字|烤肉|翻譯|字幕|精華/
  return chinesePatterns.test(title)
}

// 判斷是否為 Shorts
function isShorts(video: Video): boolean {
  if (video.duration_sec && video.duration_sec <= 60) return true
  if (video.title?.includes('#Shorts') || video.title?.includes('#shorts')) return true
  return false
}

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-16" />
            <div className="flex items-center space-x-2 pt-1">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

interface LatestVideoGridProps {
  memberId?: string // 可選：強制綁定特定成員
  channelIds?: string[] // 可選：使用頻道 ID 列表查詢（用於個人頁面）
  memberNames?: { name_jp: string; name_zh: string } // 可選：成員名稱（用於標題關鍵字查詢）
}

export function LatestVideoGrid({ memberId, channelIds, memberNames }: LatestVideoGridProps = {}) {
  const [mainTab, setMainTab] = useState<MainTab>('archives')
  const [selectedMember, setSelectedMember] = useState<string | null>(memberId || null)
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  // 分頁狀態管理
  const [page, setPage] = useState<number>(0)
  const [videos, setVideos] = useState<Video[]>([])
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)

  // 獲取所有成員（如果沒有強制綁定 memberId）
  const { data: members = [] } = useMembers()
  
  // 排序成員：JP 組優先，EN 組排最後
  // EN 組名單（根據 name_jp 欄位）
  const enNames = ['Arya Kuroha', 'Jira Jisaki', 'Remia Aotsuki', 'Riko Solari', 'Narin Mikure']
  const sortedMembers = useMemo(() => {
    if (!members || members.length === 0) return []
    
    // 建立索引映射以維持同組內的原始順序
    const originalIndices = new Map(members.map((m, i) => [m.id, i]))
    
    return [...members].sort((a, b) => {
      // 判斷是否為 EN 組成員（檢查 name_jp 和 name_zh）
      const isAEn = enNames.includes(a.name_jp) || enNames.includes(a.name_zh)
      const isBEn = enNames.includes(b.name_jp) || enNames.includes(b.name_zh)
      
      // 如果 A 是 EN 且 B 是 JP，A 排在後面
      if (isAEn && !isBEn) return 1
      // 如果 A 是 JP 且 B 是 EN，A 排在前面
      if (!isAEn && isBEn) return -1
      // 同組內維持原本順序（使用原始索引）
      const indexA = originalIndices.get(a.id) ?? 0
      const indexB = originalIndices.get(b.id) ?? 0
      return indexA - indexB
    })
  }, [members])
  
  // 如果提供了 memberId，強制使用它
  useEffect(() => {
    if (memberId) {
      setSelectedMember(memberId)
    }
  }, [memberId])

  // 構建查詢函數（將篩選邏輯移到後端）
  const buildQuery = (pageParam: number = 0) => {
    // 根據 MainTab 決定 select 語句（使用 !inner 強制關聯）
    // 明確包含 member_id 字段，確保不會因為關聯展開而丟失
    // 注意：只包含資料庫中確實存在的欄位，避免 400 錯誤
    const selectClause = 
      mainTab === 'jp_clips' || mainTab === 'cn_clips'
        ? 'id, video_id, member_id, clipper_id, platform, title, thumbnail_url, published_at, view_count, video_type, duration_sec, created_at, updated_at, member:members(*), clipper:clippers!inner(*)'
        : 'id, video_id, member_id, clipper_id, platform, title, thumbnail_url, published_at, view_count, video_type, duration_sec, created_at, updated_at, member:members(*), clipper:clippers(*)'

    let query = supabase
      .from('videos')
      .select(selectClause)
      .order('published_at', { ascending: false })

    // 根據 MainTab 篩選
    if (mainTab === 'archives') {
      // 直播存檔：member_id 不為空 (官方) 且 (duration > 1800 或 video_type === 'archive')
      query = query
        .not('member_id', 'is', null)
        .or('duration_sec.gt.1800,video_type.eq.archive')
    } else if (mainTab === 'jp_clips') {
      // 日文精華：clipper_id 不為空 且 clipper.lang === 'ja'
      // 注意：使用 !inner 強制關聯，確保 clipper 存在
      query = query
        .not('clipper_id', 'is', null)
        .eq('clippers.lang', 'ja')
    } else if (mainTab === 'cn_clips') {
      // 中文精華：clipper_id 不為空 且 clipper.lang !== 'ja'
      // 注意：使用 !inner 強制關聯，確保 clipper 存在
      // 因為資料庫中 NULL 已修復，可以直接用 neq
      query = query
        .not('clipper_id', 'is', null)
        .neq('clippers.lang', 'ja')
    }

    // 根據成員篩選（根據 mainTab 使用完全不同的過濾方式）
    const memberFilter = memberId || selectedMember
    
    if (memberFilter) {
      // 從 members 資料中找到選中的成員
      const selectedMemberData = members.find(m => m.id === memberFilter)
      
      if (mainTab === 'archives') {
        // Archives 模式：直接使用 member_id 過濾（官方頻道）
        // 絕對不要加入標題過濾，因為官方直播標題通常不會包含自己的名字
        // 注意：videos 表中沒有 channel_id 欄位，應該使用 member_id 來過濾
        if (selectedMemberData) {
          // 直接使用 member_id 過濾
          query = query.eq('member_id', selectedMemberData.id)
        } else if (memberFilter) {
          // 如果只提供了 memberFilter（UUID），直接使用
          query = query.eq('member_id', memberFilter)
        }
      } else if (mainTab === 'jp_clips' || mainTab === 'cn_clips') {
        // Clips 模式：只使用標題和暱稱過濾
        // 絕對不要加入頻道 ID 限制，因為精華影片是由剪輯頻道上傳的
        const conditions: string[] = []
        
        // 取得成員名稱（優先使用傳入的 memberNames，否則從 members 資料中取得）
        let nameJp: string | null = null
        let nameZh: string | null = null
        
        if (memberNames) {
          nameJp = memberNames.name_jp
          nameZh = memberNames.name_zh
        } else if (selectedMemberData) {
          nameJp = selectedMemberData.name_jp
          nameZh = selectedMemberData.name_zh
        }
        
        // 標題關鍵字條件（包含官方名稱和暱稱）
        if (nameJp) {
          // 原始名稱（包含空格）
          conditions.push(`title.ilike.%${nameJp}%`)
          // 去除空格後的比對（如果名稱包含空格）
          if (nameJp.includes(' ')) {
            const nameWithoutSpaces = nameJp.replace(/\s+/g, '')
            conditions.push(`title.ilike.%${nameWithoutSpaces}%`)
          }
          
          // 加入暱稱比對（如果字典中有對應的暱稱）
          const aliases = MEMBER_ALIAS_DICT[nameJp]
          if (aliases && aliases.length > 0) {
            for (const alias of aliases) {
              conditions.push(`title.ilike.%${alias}%`)
            }
          }
        }
        if (nameZh) {
          // 原始名稱（包含空格）
          conditions.push(`title.ilike.%${nameZh}%`)
          // 去除空格後的比對（如果名稱包含空格）
          if (nameZh.includes(' ')) {
            const nameWithoutSpaces = nameZh.replace(/\s+/g, '')
            conditions.push(`title.ilike.%${nameWithoutSpaces}%`)
          }
        }
        
        // 組合所有標題條件（使用 OR 聯集）
        // 注意：這個條件與 Clips 模式的基底條件（clipper_id 不為空）是 AND 關係
        // 即：是剪輯頻道上傳的 AND 標題包含成員名字
        // 嚴格檢查：只有在有條件時才使用 .or()，避免空字串導致 400 錯誤
        if (conditions && conditions.length > 0) {
          const orCondition = conditions.filter(c => c && c.trim() !== '').join(',')
          if (orCondition) {
            query = query.or(orCondition)
          }
        }
      }
    }

    // 根據平台篩選（Archives 模式）
    if (mainTab === 'archives' && platformFilter !== 'all') {
      query = query.eq('platform', platformFilter)
    }

    // 根據時長篩選（Shorts/影片過濾）- 整合到後端查詢
    // 注意：只在 Clips 模式下應用時長過濾，Archives 模式不限制時長
    if ((mainTab === 'jp_clips' || mainTab === 'cn_clips') && contentFilter !== 'all') {
      if (contentFilter === 'shorts') {
        // Shorts：只顯示 duration_sec <= 60 的影片（排除 NULL，因為 NULL 應該算作影片）
        query = query.lte('duration_sec', 60).not('duration_sec', 'is', null)
      } else if (contentFilter === 'video') {
        // 影片：只顯示 duration_sec > 60 或 duration_sec IS NULL 的影片（包含直播存檔）
        query = query.or('duration_sec.gt.60,duration_sec.is.null')
      }
    }
    // contentFilter === 'all' 或 Archives 模式時不限制時長

    // 搜索功能：搜索影片標題
    if (searchQuery.trim()) {
      query = query.ilike('title', `%${searchQuery.trim()}%`)
    }

    // 分頁
    // 確保 pageParam 是有效的數字，避免 NaN 導致 400 錯誤
    const validPage = Number.isInteger(pageParam) && pageParam >= 0 ? pageParam : 0
    const start = validPage * PAGE_SIZE
    const end = (validPage + 1) * PAGE_SIZE - 1
    query = query.range(start, end)

    return query
  }

  // 獲取影片資料
  // 注意：queryKey 需要包含 memberId，確保當 memberId 改變時重新查詢
  const {
    data: fetchedData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['latest-videos', mainTab, memberId, selectedMember, platformFilter, contentFilter, searchQuery, page, channelIds, memberNames],
    queryFn: async () => {
      const { data, error } = await buildQuery(page)

      if (error) throw error

      // 將 member 別名映射回 members 以保持向後兼容
      const videos = (data || []).map((video: any) => ({
        ...video,
        members: video.member || null,
      }))

      return videos as Video[]
    },
  })

  // 當篩選條件改變時，重置分頁和影片列表
  // 關鍵防呆機制：任何過濾條件改變時都必須重置分頁
  useEffect(() => {
    setPage(0)
    setVideos([])
    setHasMore(true)
    setIsLoadingMore(false)
  }, [mainTab, memberId, selectedMember, platformFilter, contentFilter, searchQuery, channelIds, memberNames])

  // 當資料載入完成時，更新影片列表
  useEffect(() => {
    if (fetchedData !== undefined) {
      if (page === 0) {
        // 初次載入或條件改變：重置影片列表
        setVideos(fetchedData)
      } else {
        // 載入更多：追加到現有列表
        setVideos((prev) => [...prev, ...fetchedData])
      }
      
      // 判斷是否還有更多資料：如果回傳的資料筆數小於 PAGE_SIZE，代表已經到底了
      setHasMore(fetchedData.length === PAGE_SIZE)
      
      // 載入完成，關閉載入更多狀態
      setIsLoadingMore(false)
    }
  }, [fetchedData, page])

  // 所有影片（用於前端篩選）
  const allVideos = videos

  // 前端篩選（目前時長過濾已移到後端，這裡保留以備未來擴展）
  const filteredVideos = useMemo(() => {
    // 時長過濾已經整合到 Supabase 查詢中，這裡直接返回所有影片
    return [...allVideos]
  }, [allVideos])

  // 當切換 MainTab 時，重置次級過濾
  const handleMainTabChange = (tab: MainTab) => {
    setMainTab(tab)
    setPlatformFilter('all')
    // Archives 模式不需要時長過濾，所以重置為 'all'
    // Clips 模式可以保留用戶選擇的時長過濾
    if (tab === 'archives') {
      setContentFilter('all')
    }
  }

  // 處理搜索
  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  // 清除搜索
  const handleClearSearch = () => {
    setSearchQuery('')
  }

  // 載入更多
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true)
      setPage((prev) => prev + 1)
    }
  }

  // 初始載入時顯示骨架屏（只在 page === 0 且沒有資料時）
  if (isLoading && page === 0 && videos.length === 0) {
    return <VideoGridSkeleton />
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        載入錯誤：{error instanceof Error ? error.message : '未知錯誤'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 搜索欄 */}
      <SearchBar 
        onSearch={handleSearch} 
        onClear={handleClearSearch}
        searchQuery={searchQuery}
      />

      {/* UI 區域一：頂部導覽 (Main Tabs) */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => handleMainTabChange('archives')}
          variant={mainTab === 'archives' ? 'default' : 'outline'}
          className={`rounded-full px-6 py-2 ${
            mainTab === 'archives'
              ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600'
              : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border-gray-600'
          }`}
        >
          直播存檔
        </Button>
        <Button
          onClick={() => handleMainTabChange('jp_clips')}
          variant={mainTab === 'jp_clips' ? 'default' : 'outline'}
          className={`rounded-full px-6 py-2 ${
            mainTab === 'jp_clips'
              ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
              : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border-gray-600'
          }`}
        >
          日文精華
        </Button>
        <Button
          onClick={() => handleMainTabChange('cn_clips')}
          variant={mainTab === 'cn_clips' ? 'default' : 'outline'}
          className={`rounded-full px-6 py-2 ${
            mainTab === 'cn_clips'
              ? 'bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600'
              : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border-gray-600'
          }`}
        >
          中文精華
        </Button>
      </div>

      {/* UI 區域二：成員篩選列（如果沒有強制綁定 memberId 才顯示） */}
      {!memberId && (
        <div className="w-full">
          <div className="flex flex-nowrap overflow-x-auto w-full gap-3 pb-4 custom-scrollbar">
          <button
            onClick={() => setSelectedMember(null)}
            className={`flex-shrink-0 flex flex-col items-center gap-2 transition-all ${
              selectedMember === null
                ? 'opacity-100 scale-105'
                : 'opacity-60 hover:opacity-80'
            }`}
          >
            <div
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center border-2 text-xl md:text-2xl ${
                selectedMember === null
                  ? 'border-white bg-white/20'
                  : 'border-gray-600 bg-gray-800/50'
              }`}
            >
              🌐
            </div>
            <span className="text-xs text-gray-300 whitespace-nowrap">全部</span>
          </button>

          {sortedMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedMember(member.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-2 transition-all ${
                selectedMember === member.id
                  ? 'opacity-100 scale-105'
                  : 'opacity-60 hover:opacity-80'
              }`}
            >
              <div
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden border-2 ${
                  selectedMember === member.id
                    ? 'border-white ring-2 ring-white/50'
                    : 'border-gray-600'
                }`}
              >
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.name_jp || member.name_zh || '成員'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-xl md:text-2xl"
                    style={{
                      backgroundColor: `${member.color_hex || '#888888'}20`,
                    }}
                  >
                    📺
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-300 whitespace-nowrap max-w-[60px] truncate">
                {member.name_jp || member.name_zh || '成員'}
              </span>
            </button>
          ))}
          </div>
        </div>
      )}

      {/* UI 區域三：次級過濾 */}
      {mainTab === 'archives' ? (
        <div className="flex flex-wrap gap-2">
          {/* 平台過濾 */}
          <Button
            onClick={() => setPlatformFilter('all')}
            variant={platformFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className={`rounded-full ${
              platformFilter === 'all'
                ? 'bg-purple-600/80 hover:bg-purple-700/80 text-white'
                : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
            }`}
          >
            全部
          </Button>
          <Button
            onClick={() => setPlatformFilter('youtube')}
            variant={platformFilter === 'youtube' ? 'default' : 'outline'}
            size="sm"
            className={`rounded-full ${
              platformFilter === 'youtube'
                ? 'bg-purple-600/80 hover:bg-purple-700/80 text-white'
                : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
            }`}
          >
            YouTube
          </Button>
          <Button
            onClick={() => setPlatformFilter('twitch')}
            variant={platformFilter === 'twitch' ? 'default' : 'outline'}
            size="sm"
            className={`rounded-full ${
              platformFilter === 'twitch'
                ? 'bg-purple-600/80 hover:bg-purple-700/80 text-white'
                : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
            }`}
          >
            Twitch
          </Button>
          {/* Archives 模式不顯示時長過濾器（直播存檔通常都是長影片） */}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setContentFilter('all')}
            variant={contentFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className={`rounded-full ${
              contentFilter === 'all'
                ? mainTab === 'jp_clips'
                  ? 'bg-blue-600/80 hover:bg-blue-700/80 text-white'
                  : 'bg-cyan-600/80 hover:bg-cyan-700/80 text-white'
                : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
            }`}
          >
            全部
          </Button>
          <Button
            onClick={() => setContentFilter('video')}
            variant={contentFilter === 'video' ? 'default' : 'outline'}
            size="sm"
            className={`rounded-full ${
              contentFilter === 'video'
                ? mainTab === 'jp_clips'
                  ? 'bg-blue-600/80 hover:bg-blue-700/80 text-white'
                  : 'bg-cyan-600/80 hover:bg-cyan-700/80 text-white'
                : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
            }`}
          >
            影片
          </Button>
          <Button
            onClick={() => setContentFilter('shorts')}
            variant={contentFilter === 'shorts' ? 'default' : 'outline'}
            size="sm"
            className={`rounded-full ${
              contentFilter === 'shorts'
                ? mainTab === 'jp_clips'
                  ? 'bg-blue-600/80 hover:bg-blue-700/80 text-white'
                  : 'bg-cyan-600/80 hover:bg-cyan-700/80 text-white'
                : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300'
            }`}
          >
            Shorts
          </Button>
          <Link href="/clippers">
            <Button
              variant="outline"
              size="sm"
              className="relative rounded-full transition-all bg-gray-800/50 hover:bg-gray-700/50 text-gray-300"
            >
              <span className="relative z-10">精華頻道列表</span>
            </Button>
          </Link>
        </div>
      )}

      {/* 內容渲染 */}
      {contentFilter === 'channels' && (mainTab === 'jp_clips' || mainTab === 'cn_clips') ? (
        // 顯示精華頻道列表
        <ClipperListView lang={mainTab === 'cn_clips' ? 'zh' : 'ja'} />
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-12">
          <Card className="bg-gray-900/80 backdrop-blur-md border-gray-700 p-8 max-w-md mx-auto">
            {searchQuery ? (
              <>
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">
                  找不到相關影片
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  沒有找到與「<span className="text-purple-400 font-medium">{searchQuery}</span>」相關的影片
                </p>
                <Button
                  onClick={handleClearSearch}
                  variant="outline"
                  className="bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border-gray-600"
                >
                  清除搜尋
                </Button>
              </>
            ) : (
              <>
                <div className="text-4xl mb-4">📭</div>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">
                  目前沒有符合條件的影片
                </h3>
                <p className="text-sm text-gray-400">
                  請嘗試調整篩選條件或搜尋關鍵字
                </p>
              </>
            )}
          </Card>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredVideos.map((video) => (
              <LatestVideoCard key={video.id} video={video} />
            ))}
          </div>

          {/* 載入更多按鈕 */}
          <div className="flex justify-center pt-6">
            {hasMore ? (
              <Button
                onClick={handleLoadMore}
                disabled={isLoading || isLoadingMore}
                className="w-full max-w-md bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border border-gray-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    載入中...
                  </span>
                ) : (
                  '載入更多影片...'
                )}
              </Button>
            ) : videos.length > 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">
                <span className="text-gray-400">已經到底囉！</span>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Video } from '@/types/database'
import { Card } from '@/components/ui/card'

export function NowLiveSection() {
  const {
    data: liveVideos = [],
    isLoading,
    isError,
  } = useQuery<Video[]>({
    queryKey: ['now-live-videos'],
    queryFn: async () => {
      // 1. 先從資料庫撈取正在直播、且有人觀看的影片
      const { data, error } = await supabase
        .from('videos')
        .select(
          'id, member_id, clipper_id, platform, title, thumbnail_url, published_at, view_count, concurrent_viewers, video_type, duration_sec, created_at, updated_at, related_stream_id, members(*), clippers(*)'
        )
        .eq('video_type', 'live')
        .gt('concurrent_viewers', 0) // 嚴格過濾：同接必須大於 0
        .order('published_at', { ascending: false })

      if (error) {
        console.error('取得現正直播影片失敗:', error)
        return []
      }

      if (!data) return []

      // 🚫 2. 終極黑名單過濾 (前端處理最準確)
      const blacklist = [
        'free chat', 
        'フリーチャット', 
        'schedule', 
        'スケジュール', 
        '予定',
        'freechat'
      ]

      const validVideos = (data as any[]).filter((v) => {
        if (!v.title) return false
        const lowerTitle = v.title.toLowerCase()
        // 只要標題含有黑名單字眼，直接剔除
        return !blacklist.some((keyword) => lowerTitle.includes(keyword))
      })

      // 🤖 3. 智能去重邏輯 (同一個 VTuber 只留同接最高的)
      const uniqueMap = new Map()
      validVideos.forEach((v) => {
        // 如果沒有 member_id (例如官方台)，用影片 id 當作 key 防止誤殺
        const key = v.member_id || v.id
        const existing = uniqueMap.get(key)
        
        if (!existing) {
          uniqueMap.set(key, v)
        } else {
          // 如果已經有這個人的直播，保留觀看人數比較高的那一個
          const currentViewers = v.concurrent_viewers || 0
          const existingViewers = existing.concurrent_viewers || 0
          if (currentViewers > existingViewers) {
            uniqueMap.set(key, v)
          }
        }
      })

      // 4. 轉換型別並依照「觀看人數」由高到低排序 (最熱門的在最左邊)
      const finalVideos = Array.from(uniqueMap.values()).map((v) => ({
        ...v,
        video_id: v.video_id || v.id,
        members: v.members ?? null,
        clipper: v.clippers ?? null,
      })) as unknown as Video[]

      return finalVideos.sort((a, b) => (b.concurrent_viewers || 0) - (a.concurrent_viewers || 0))
    },
    // 設定重新抓取時間，避免頻繁發送 API
    staleTime: 1000 * 60 * 2, // 2 分鐘內不重新 fetch
  })

  // 如果載入中、發生錯誤，或是過濾完之後發現其實沒人在直播，就隱藏區塊
  if (isLoading || isError || !liveVideos || liveVideos.length === 0) {
    return null
  }

  return (
    <section className="mb-10">
      {/* 標題區塊優化 */}
      <div className="mb-4 flex items-center gap-3 pl-1">
        {/* 呼吸閃爍紅點 */}
        <div className="relative flex items-center justify-center h-4 w-4">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          現正直播中 <span className="hidden md:inline text-slate-500 text-lg font-medium">/ NOW LIVE</span>
        </h2>
      </div>

      {/* 卡片列表：小螢幕走橫向滑動，大螢幕以 Grid 顯示無限量 */}
      <div className="block md:hidden">
        <div className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-proximity pb-4 touch-pan-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {liveVideos.map((video) => (
            <div key={video.id} className="snap-start shrink-0">
              <NowLiveCard video={video} />
            </div>
          ))}
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {liveVideos.map((video) => (
          <NowLiveCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  )
}

interface NowLiveCardProps {
  video: Video
}

function NowLiveCard({ video }: NowLiveCardProps) {
  const memberName =
    video.members?.name_jp || video.members?.name_zh || video.clipper?.name || 'VSPO 官方 / 成員'

  const liveUrl =
    video.platform === 'twitch'
      ? video.members?.channel_id_twitch
        ? `https://www.twitch.tv/${video.members.channel_id_twitch}`
        : `https://www.twitch.tv/directory`
      : `https://www.youtube.com/watch?v=${video.id}`

  return (
    <a
      href={liveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block min-w-[260px] max-w-[320px] md:min-w-0 h-full group"
    >
      <Card className="h-full gap-0 overflow-hidden bg-white dark:bg-gray-900/50 border border-slate-200 dark:border-gray-800 p-0 transition-all duration-300 hover:-translate-y-1 hover:border-red-500/70 hover:shadow-lg hover:shadow-red-500/10 dark:hover:shadow-indigo-500/10">
        <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-slate-900">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-800 text-3xl opacity-50">
              📺
            </div>
          )}

          {/* 左上角 LIVE 標籤 */}
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-sm bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>

          {/* 右下角即時人數 */}
          {typeof video.concurrent_viewers === 'number' && video.concurrent_viewers > 0 && (
            <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm flex items-center gap-1.5">
              <span className="text-red-500">🔴</span> {video.concurrent_viewers.toLocaleString()}
            </div>
          )}
        </div>

        <div className="space-y-1.5 p-3">
          <p className="line-clamp-2 text-sm md:text-base font-bold text-slate-900 dark:text-gray-100 leading-snug group-hover:text-red-500 transition-colors">
            {video.title}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs font-medium text-slate-500 dark:text-gray-400 truncate pr-2">
              {memberName}
            </p>
            {/* 平台標籤 */}
            {video.platform && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${video.platform === 'youtube' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                {video.platform === 'youtube' ? 'YT' : 'Twitch'}
              </span>
            )}
          </div>
        </div>
      </Card>
    </a>
  )
}
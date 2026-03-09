'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useMembers } from '@/hooks/use-members'
import { supabase } from '@/lib/supabase'
import { LiveNowBar } from '@/components/live-now-bar'
import { LatestVideoGrid } from '@/components/latest-video-grid'
import { LatestVideoCard } from '@/components/latest-video-card'
import { RelatedVideoDialog } from '@/components/related-video-dialog'
import { Video } from '@/types/database'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

function HomeContent() {
  const { data: members } = useMembers()
  const searchParams = useSearchParams()
  const [selectedVideoForDialog, setSelectedVideoForDialog] = useState<Video | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // 查詢本週熱門影片
  const { data: trendingVideos = [], isLoading: isLoadingTrending } = useQuery<Video[]>({
    queryKey: ['trending-videos-this-week'],
    queryFn: async () => {
      // 計算 7 天前的日期（ISO 字串）
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const sevenDaysAgoISO = sevenDaysAgo.toISOString()

      // 查詢本週熱門影片（過去 7 天內，按觀看次數降序）
      // 過濾掉 view_count 為 null 的影片，確保排序準確性
      const { data: videosData, error } = await supabase
        .from('videos')
        .select('id, member_id, clipper_id, platform, title, thumbnail_url, published_at, view_count, concurrent_viewers, video_type, duration_sec, created_at, updated_at, related_stream_id, members(*), clippers(*)')
        .gte('published_at', sevenDaysAgoISO)
        .not('view_count', 'is', null)
        .gt('view_count', 0)
        .order('view_count', { ascending: false })
        .limit(4)

      if (error) {
        console.error('查詢本週熱門影片失敗:', error)
        return []
      }

      if (!videosData || videosData.length === 0) {
        return []
      }

      // 將 Supabase 關聯欄位 members/clippers 映射回型別定義中的 members/clipper
      // 注意：id 就是 YouTube Video ID，所以將 id 複製到 video_id（如果沒有 video_id）
      const mappedVideos = (videosData as any[]).map((v) => ({
        ...v,
        video_id: v.video_id || v.id, // id 就是 YouTube Video ID
        members: v.members ?? null,
        clipper: v.clippers ?? null,
      })) as unknown as Video[]

      return mappedVideos
    },
  })

  // 從 URL 參數取得影片 ID
  const videoIdFromUrl = searchParams.get('v')

  // 查詢 URL 參數指定的影片（僅在有 URL 參數時才查詢）
  const { data: urlVideo } = useQuery<Video | null>({
    queryKey: ['video-by-id', videoIdFromUrl],
    queryFn: async () => {
      if (!videoIdFromUrl) return null

      // 直接查詢資料庫（因為影片可能不在首頁預設載入的清單內）
      const { data: videoData, error } = await supabase
        .from('videos')
        .select('id, member_id, clipper_id, platform, title, thumbnail_url, published_at, view_count, concurrent_viewers, video_type, duration_sec, created_at, updated_at, related_stream_id, members(*), clippers(*)')
        .eq('id', videoIdFromUrl)
        .maybeSingle()

      if (error) {
        console.error('查詢影片失敗:', error)
        return null
      }

      if (!videoData) {
        return null
      }

      // 將 Supabase 關聯欄位 members/clippers 映射回型別定義中的 members/clipper
      const mappedVideo = {
        ...videoData,
        video_id: videoData.id,  // 直接用 id 就好！
        members: videoData.members ?? null,
        clipper: videoData.clippers ?? null,
      } as unknown as Video

      return mappedVideo
    },
    enabled: !!videoIdFromUrl, // 只在有 URL 參數時才查詢
  })

  // 處理 URL 參數：自動彈出同場精華對話框
  // 優先檢查現有列表，找不到再使用查詢結果
  useEffect(() => {
    if (!videoIdFromUrl) return

    // 步驟 1：先在現有的影片列表中尋找（本週熱門影片）
    const foundInTrending = trendingVideos.find((v) => v.id === videoIdFromUrl)
    if (foundInTrending) {
      setSelectedVideoForDialog(foundInTrending)
      setIsDialogOpen(true)
      return
    }

    // 步驟 2：如果在現有列表中找不到，使用查詢結果
    if (urlVideo) {
      setSelectedVideoForDialog(urlVideo)
      setIsDialogOpen(true)
    }
  }, [videoIdFromUrl, trendingVideos, urlVideo])

  return (
    <main className="min-h-screen bg-gray-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 正在直播快速列 */}
        {members && <LiveNowBar members={members} />}

        {/* 本週熱門精華區塊 */}
        {trendingVideos.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
              🔥 本週熱門精華 (Trending This Week)
            </h2>
            {isLoadingTrending ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden bg-gray-900 border-gray-800">
                    <Skeleton className="aspect-video w-full" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {trendingVideos.map((video) => (
                  <LatestVideoCard key={video.id} video={video} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 標題 */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">
          最新影片 / Latest Videos
        </h1>

        {/* 最新影片牆 */}
        <LatestVideoGrid />
      </div>

      {/* URL 參數觸發的同場精華對話框 */}
      {selectedVideoForDialog && (
        <RelatedVideoDialog
          video={selectedVideoForDialog}
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              // 關閉對話框時清除選中的影片
              setSelectedVideoForDialog(null)
            }
          }}
        />
      )}
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-950 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  )
}

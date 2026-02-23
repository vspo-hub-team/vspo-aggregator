'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Video } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LatestVideoCard } from '@/components/latest-video-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

interface RelatedVideoDialogProps {
  video: Video
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RelatedVideoDialog({ video, open, onOpenChange }: RelatedVideoDialogProps) {
  // 真正的同場直播查詢：通過 streams 和 clips 表建立關聯
  const { data: relatedVideosData, isLoading } = useQuery<{ videos: Video[], isSameStream: boolean }>({
    queryKey: ['related-clips', video.id, video.video_type, video.clipper_id],
    queryFn: async () => {
      let results: Video[] = []
      let isSameStream = false // 標記是否為同場直播的精華

      // ===== 第一順位：同場直播所有剪輯（精準關聯） =====
      try {
        // 取得當前影片的 YouTube Video ID
        // 注意：video.id 可能是 UUID，video.video_id 才是 YouTube Video ID
        // 但根據實際使用情況，video.id 可能就是 YouTube Video ID
        const currentVideoId = (video as any).video_id || video.id

        // 情況 1：如果點擊的是直播/存檔 (live/archive)
        if (video.video_type === 'live' || video.video_type === 'archive') {
          // 1. 在 streams 表中找到對應的 stream（通過 video_id 比對，TEXT 型別）
          const { data: streamData } = await supabase
            .from('streams')
            .select('id')
            .eq('video_id', currentVideoId) // video_id 是 TEXT，安全比對
            .maybeSingle()

          if (streamData?.id) {
            const streamId = streamData.id // UUID

            // 2. 在 clips 表中找到所有 related_stream_id === streamId 的精華
            const { data: clipsData } = await supabase
              .from('clips')
              .select('video_id')
              .eq('related_stream_id', streamId) // UUID 比對，安全
              .order('published_at', { ascending: false })
              .limit(20)

            if (clipsData && clipsData.length > 0) {
              const clipVideoIds = clipsData.map(c => c.video_id).filter(Boolean)

              // 3. 通過 clips.video_id 去 videos 表找對應的影片資料
              // 注意：videos.id 可能就是 YouTube Video ID（根據實際使用情況）
              if (clipVideoIds.length > 0) {
                // 直接通過 videos.id 查詢（假設 id 就是 YouTube Video ID）
                const { data: videosData } = await supabase
                  .from('videos')
                  .select('id, title, thumbnail_url, member_id, clipper_id, published_at, view_count, video_type, duration_sec, platform, created_at, updated_at')
                  .in('id', clipVideoIds) // 直接使用 clips.video_id 作為 videos.id 查詢
                  .not('clipper_id', 'is', null) // 只取精華
                  .order('published_at', { ascending: false })
                  .limit(20)

                if (videosData && videosData.length > 0) {
                  // 前端過濾：排除當前影片
                  const filteredVideos = videosData
                    .filter(v => v.id !== video.id)
                    .slice(0, 6)

                  if (filteredVideos.length > 0) {
                    isSameStream = true
                    results = filteredVideos as Video[]
                  }
                }
              }
            }
          }
        }
        // 情況 2：如果點擊的是精華（有 clipper_id）
        else if (video.clipper_id) {
          // 1. 在 clips 表中找到當前精華的記錄（通過 video_id 比對）
          const { data: currentClip } = await supabase
            .from('clips')
            .select('related_stream_id')
            .eq('video_id', currentVideoId) // video_id 是 TEXT，安全比對
            .maybeSingle()

          if (currentClip?.related_stream_id) {
            const streamId = currentClip.related_stream_id // UUID

            // 2. 在 clips 表中找到所有 related_stream_id === streamId 的其他精華
            const { data: clipsData } = await supabase
              .from('clips')
              .select('video_id')
              .eq('related_stream_id', streamId) // UUID 比對，安全
              .order('published_at', { ascending: false })
              .limit(20)

            if (clipsData && clipsData.length > 0) {
              const clipVideoIds = clipsData.map(c => c.video_id).filter(Boolean)

              // 3. 通過 clips.video_id 去 videos 表找對應的影片資料
              // 注意：videos.id 可能就是 YouTube Video ID（根據實際使用情況）
              if (clipVideoIds.length > 0) {
                // 直接通過 videos.id 查詢（假設 id 就是 YouTube Video ID）
                const { data: videosData } = await supabase
                  .from('videos')
                  .select('id, title, thumbnail_url, member_id, clipper_id, published_at, view_count, video_type, duration_sec, platform, created_at, updated_at')
                  .in('id', clipVideoIds) // 直接使用 clips.video_id 作為 videos.id 查詢
                  .not('clipper_id', 'is', null) // 只取精華
                  .order('published_at', { ascending: false })
                  .limit(20)

                if (videosData && videosData.length > 0) {
                  // 前端過濾：排除當前影片
                  const filteredVideos = videosData
                    .filter(v => v.id !== video.id)
                    .slice(0, 6)

                  if (filteredVideos.length > 0) {
                    isSameStream = true
                    results = filteredVideos as Video[]
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('第一順位（同場直播）查詢失敗:', error)
      }

      // ===== 第二順位：同成員推薦（Fallback） =====
      if (results.length < 3 && video.member_id) {
        try {
          // 只查詢基礎欄位，只使用 UUID 比對（member_id 確定是 UUID）
          const { data: videosData, error } = await supabase
            .from('videos')
            .select('id, title, thumbnail_url, member_id, clipper_id, published_at, view_count, video_type, duration_sec, platform, created_at, updated_at')
            .eq('member_id', video.member_id) // 同成員（member_id 是 UUID，絕對安全）
            .not('clipper_id', 'is', null) // 只取精華（有 clipper_id）
            .neq('video_type', 'live') // 排除直播
            .neq('video_type', 'archive') // 排除存檔
            .order('published_at', { ascending: false })
            .limit(12) // 多取一些，以便前端過濾後仍有足夠數量

          if (error) {
            console.warn('第二順位查詢錯誤:', error)
          } else if (videosData && videosData.length > 0) {
            // 前端過濾：排除當前影片和已存在的影片
            const existingIds = new Set(results.map(v => v.id))
            const filteredVideos = videosData
              .filter(v => v.id !== video.id && !existingIds.has(v.id))
              .slice(0, 6 - results.length)

            if (filteredVideos.length > 0) {
              // 如果需要關聯資料，再單獨查詢
              const memberIds = [...new Set(filteredVideos.map(v => v.member_id).filter(Boolean))]
              const clipperIds = [...new Set(filteredVideos.map(v => v.clipper_id).filter(Boolean))]

              let membersMap = new Map()
              let clippersMap = new Map()

              if (memberIds.length > 0) {
                const { data: membersData } = await supabase
                  .from('members')
                  .select('*')
                  .in('id', memberIds)
                if (membersData) {
                  membersData.forEach(m => membersMap.set(m.id, m))
                }
              }

              if (clipperIds.length > 0) {
                const { data: clippersData } = await supabase
                  .from('clippers')
                  .select('*')
                  .in('id', clipperIds)
                if (clippersData) {
                  clippersData.forEach(c => clippersMap.set(c.id, c))
                }
              }

              const newVideos = filteredVideos.map((v: any) => ({
                ...v,
                members: membersMap.get(v.member_id) || null,
                clipper: clippersMap.get(v.clipper_id) || null,
              })) as Video[]

              results = [...results, ...newVideos]
            }
          }
        } catch (error) {
          console.warn('第二順位查詢失敗:', error)
        }
      }

      // 確保返回最多 6 部影片
      return { videos: results.slice(0, 6), isSameStream }
    },
    enabled: open, // 對所有影片都查詢
  })

  // 動態標題：根據是否為同場直播切換
  const dialogTitle = relatedVideosData?.isSameStream 
    ? '同場直播所有剪輯' 
    : '相關精華推薦'

  const videos = relatedVideosData?.videos || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </Card>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            暫無相關精華
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {videos.map((relatedVideo) => (
              <LatestVideoCard 
                key={relatedVideo.id} 
                video={relatedVideo} 
                hideRelatedButton={true}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

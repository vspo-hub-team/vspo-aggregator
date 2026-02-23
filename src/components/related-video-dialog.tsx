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
  // 三層降級查詢：確保總是有影片可以推薦
  const { data: relatedVideos = [], isLoading } = useQuery({
    queryKey: ['related-clips', video.id, video.video_id, video.member_id],
    queryFn: async () => {
      let results: Video[] = []

      // ===== 第一順位：精準比對（原本的邏輯） =====
      try {
        // 步驟 1: 確定當前影片的 video_id（可能是 videos.id 或 videos.video_id）
        let archiveVideoId = video.video_id || video.id
        
        // 如果 video.id 看起來像 UUID（包含連字符），則查詢 videos 表獲取 video_id
        if (video.id.includes('-') && !video.video_id) {
          const { data: videoData } = await supabase
            .from('videos')
            .select('video_id')
            .eq('id', video.id)
            .single()

          if (videoData?.video_id) {
            archiveVideoId = videoData.video_id
          }
        }

        // 步驟 2: 通過 streams 表找到對應的 stream_id
        const { data: streamData } = await supabase
          .from('streams')
          .select('id')
          .eq('video_id', archiveVideoId)
          .limit(1)
          .maybeSingle()

        if (streamData?.id) {
          const streamId = streamData.id

          // 步驟 3: 通過 clips 表嚴格過濾，只獲取 related_stream_id = streamId 的精華
          const { data: clipsData } = await supabase
            .from('clips')
            .select('video_id')
            .eq('related_stream_id', streamId)
            .order('published_at', { ascending: false })
            .limit(20)

          if (clipsData && clipsData.length > 0) {
            // 步驟 4: 通過 clips.video_id 在 videos 表中查找對應的 clipper 影片
            const clipVideoIds = clipsData.map(c => c.video_id).filter(Boolean)
            if (clipVideoIds.length > 0) {
              const { data: videosData } = await supabase
                .from('videos')
                .select('*, member:members(*), clipper:clippers(*)')
                .not('clipper_id', 'is', null)
                .in('video_id', clipVideoIds)
                .neq('video_type', 'live')
                .neq('video_type', 'archive')
                .order('published_at', { ascending: false })
                .limit(20)

              if (videosData && videosData.length > 0) {
                results = videosData.map((v: any) => ({
                  ...v,
                  members: v.member || null,
                })) as Video[]
              }
            }
          }
        }
      } catch (error) {
        console.warn('第一順位查詢失敗:', error)
      }

      // ===== 第二順位：同成員的近期精華（Fallback） =====
      if (results.length < 3 && video.member_id) {
        try {
          // 獲取該成員的所有 stream IDs
          const { data: memberStreams } = await supabase
            .from('streams')
            .select('id')
            .eq('member_id', video.member_id)

          if (memberStreams && memberStreams.length > 0) {
            const streamIds = memberStreams.map(s => s.id)

            // 獲取這些 stream 相關的精華
            const { data: clipsData } = await supabase
              .from('clips')
              .select('video_id')
              .in('related_stream_id', streamIds)
              .order('published_at', { ascending: false })
              .limit(20)

            if (clipsData && clipsData.length > 0) {
              const clipVideoIds = clipsData.map(c => c.video_id).filter(Boolean)
              if (clipVideoIds.length > 0) {
                const { data: videosData } = await supabase
                  .from('videos')
                  .select('*, member:members(*), clipper:clippers(*)')
                  .not('clipper_id', 'is', null)
                  .in('video_id', clipVideoIds)
                  .neq('video_type', 'live')
                  .neq('video_type', 'archive')
                  .order('published_at', { ascending: false })
                  .limit(20)

                if (videosData && videosData.length > 0) {
                  const memberClips = videosData.map((v: any) => ({
                    ...v,
                    members: v.member || null,
                  })) as Video[]

                  // 合併結果，避免重複
                  const existingIds = new Set(results.map(v => v.id))
                  const newClips = memberClips.filter(v => !existingIds.has(v.id))
                  results = [...results, ...newClips]
                }
              }
            }
          }
        } catch (error) {
          console.warn('第二順位查詢失敗:', error)
        }
      }

      // ===== 第三順位：全站熱門/隨機精華（最終 Fallback） =====
      if (results.length < 3) {
        try {
          // 計算 3 天前的時間
          const threeDaysAgo = new Date()
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
          const threeDaysAgoISO = threeDaysAgo.toISOString()

          // 查詢近 3 天內觀看數最高的精華影片
          const { data: videosData } = await supabase
            .from('videos')
            .select('*, member:members(*), clipper:clippers(*)')
            .not('clipper_id', 'is', null)
            .neq('video_type', 'live')
            .neq('video_type', 'archive')
            .gte('published_at', threeDaysAgoISO)
            .order('view_count', { ascending: false })
            .limit(20)

          if (videosData && videosData.length > 0) {
            const popularClips = videosData.map((v: any) => ({
              ...v,
              members: v.member || null,
            })) as Video[]

            // 合併結果，避免重複
            const existingIds = new Set(results.map(v => v.id))
            const newClips = popularClips.filter(v => !existingIds.has(v.id))
            results = [...results, ...newClips]

            // 如果還是不夠，隨機補充一些（不限時間）
            if (results.length < 3) {
              const { data: randomVideos } = await supabase
                .from('videos')
                .select('*, member:members(*), clipper:clippers(*)')
                .not('clipper_id', 'is', null)
                .neq('video_type', 'live')
                .neq('video_type', 'archive')
                .order('published_at', { ascending: false })
                .limit(50)

              if (randomVideos && randomVideos.length > 0) {
                const randomClips = randomVideos.map((v: any) => ({
                  ...v,
                  members: v.member || null,
                })) as Video[]

                const existingIds = new Set(results.map(v => v.id))
                const newClips = randomClips
                  .filter(v => !existingIds.has(v.id))
                  .slice(0, 6 - results.length) // 確保總數不超過 6 部
                results = [...results, ...newClips]
              }
            }
          }
        } catch (error) {
          console.warn('第三順位查詢失敗:', error)
        }
      }

      // 確保至少返回 3-6 部影片（如果有的話）
      return results.slice(0, 6)
    },
    enabled: open && (video.video_type === 'archive' || video.video_type === 'live'), // 只對存檔或直播影片查詢
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>相關精華推薦</DialogTitle>
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
        ) : relatedVideos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            暫無相關精華
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {relatedVideos.map((relatedVideo) => (
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

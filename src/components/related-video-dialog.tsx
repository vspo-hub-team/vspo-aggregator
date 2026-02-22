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
  // 嚴格查詢：只抓取與當前影片（直播存檔）直接相關的精華
  const { data: relatedVideos = [], isLoading } = useQuery({
    queryKey: ['related-clips', video.id, video.video_id],
    queryFn: async () => {
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
        } else {
          // 如果找不到 video_id，返回空陣列
          return []
        }
      }

      // 步驟 2: 通過 streams 表找到對應的 stream_id
      const { data: streamData, error: streamError } = await supabase
        .from('streams')
        .select('id')
        .eq('video_id', archiveVideoId)
        .limit(1)
        .single()

      if (streamError || !streamData) {
        // 如果找不到對應的 stream，返回空陣列（可能不是存檔影片）
        return []
      }

      const streamId = streamData.id

      // 步驟 3: 通過 clips 表嚴格過濾，只獲取 related_stream_id = streamId 的精華
      const { data: clipsData, error: clipsError } = await supabase
        .from('clips')
        .select('video_id')
        .eq('related_stream_id', streamId) // 嚴格過濾：只取該場直播的精華
        .order('published_at', { ascending: false })

      if (clipsError || !clipsData || clipsData.length === 0) {
        // 如果沒有相關精華，返回空陣列
        return []
      }

      // 步驟 4: 通過 clips.video_id 在 videos 表中查找對應的 clipper 影片
      const clipVideoIds = clipsData.map(c => c.video_id).filter(Boolean)
      if (clipVideoIds.length === 0) {
        return []
      }

      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('*, member:members(*), clipper:clippers(*)')
        .not('clipper_id', 'is', null) // 只抓取剪輯
        .in('video_id', clipVideoIds) // 嚴格限制：只取這些 video_id
        .neq('video_type', 'live') // 排除直播
        .neq('video_type', 'archive') // 排除存檔（確保只抓精華）
        .order('published_at', { ascending: false })
        .limit(20) // 限制數量，避免過多

      if (videosError) throw videosError

      // 將 member 別名映射回 members 以保持向後兼容
      const videos = (videosData || []).map((v: any) => ({
        ...v,
        members: v.member || null,
      }))

      return videos as Video[]
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

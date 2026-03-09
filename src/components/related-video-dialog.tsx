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
import { Button } from '@/components/ui/button'
import { Share2 } from 'lucide-react'

interface RelatedVideoDialogProps {
  video: Video
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RelatedVideoDialog({ video, open, onOpenChange }: RelatedVideoDialogProps) {
  // 嚴格模式：只查詢 videos 表的 related_stream_id，不查 clips 表，不依賴 Fallback
  const { data: relatedVideosData, isLoading } = useQuery<{ videos: Video[] }>({
    queryKey: ['related-videos', video.id, video.related_stream_id, video.video_type],
    queryFn: async () => {
      // 🔍 照妖鏡：檢查點擊的影片完整資料
      console.log('🔍 照妖鏡 - 點擊的影片完整資料:', video)
      console.log('🔍 照妖鏡 - video.related_stream_id 值:', video.related_stream_id)
      console.log('🔍 照妖鏡 - video.related_stream_id 類型:', typeof video.related_stream_id)
      console.log('🔍 照妖鏡 - video.related_stream_id === null:', video.related_stream_id === null)
      console.log('🔍 照妖鏡 - video.related_stream_id === undefined:', video.related_stream_id === undefined)
      
      let streamId: string | null = null

      // 情況 1：如果點擊的是精華（有 related_stream_id）
      if (video.related_stream_id) {
        streamId = video.related_stream_id
        console.log('嚴格模式: 從 video.related_stream_id 取得 streamId =', streamId)
      }
      // 情況 2：如果點擊的是直播/存檔（需要通過 streams 表查找）
      else if (video.video_type === 'live' || video.video_type === 'archive') {
        // 取得當前影片的 YouTube Video ID
        // 注意：videos 表的 id 就是 YouTube Video ID
        const currentVideoId = (video as any).video_id || video.id
        
        // 在 streams 表中找到對應的 stream（通過 video_id 比對）
        const { data: streamData, error: streamError } = await supabase
          .from('streams')
          .select('id')
          .eq('video_id', currentVideoId)
          .maybeSingle()

        if (streamError) {
          console.warn('查詢 streams 表失敗:', streamError)
          return { videos: [] }
        }

        if (streamData?.id) {
          streamId = streamData.id
          console.log('嚴格模式: 從 streams 表取得 streamId =', streamId)
        } else {
          console.log('嚴格模式: streams 表中找不到 video_id =', currentVideoId, '的記錄，返回空陣列')
          return { videos: [] }
        }
      }
      // 情況 3：其他類型或沒有 streamId
      else {
        console.log('嚴格模式: 無法取得 streamId，返回空陣列')
        return { videos: [] }
      }

      // 嚴格模式：如果沒有 streamId，直接返回空陣列
      if (!streamId) {
        console.log('嚴格模式: streamId 為 null，返回空陣列')
        return { videos: [] }
      }

      // 在 videos 表中查詢所有 related_stream_id 等於該 streamId 的影片
      // 在 videos 表中查詢所有 related_stream_id 等於該 streamId 的影片
      const { data: videosData, error } = await supabase
        .from('videos')
        .select(`
          id,
          member_id,
          clipper_id,
          platform,
          title,
          thumbnail_url,
          published_at,
          view_count,
          concurrent_viewers,
          video_type,
          duration_sec,
          created_at,
          updated_at,
          related_stream_id,
          members(*),
          clippers(*)
        `)
        .eq('related_stream_id', streamId)
        .not('clipper_id', 'is', null) // 只取精華（有 clipper_id）
        // 包含所有精華類型：video, short, clip（無視大小寫）
        .or('video_type.eq.video,video_type.eq.Video,video_type.eq.VIDEO,video_type.eq.short,video_type.eq.Short,video_type.eq.SHORT,video_type.eq.clip,video_type.eq.Clip,video_type.eq.CLIP')
        .order('published_at', { ascending: false })
        .limit(30)

      if (error) {
        console.warn('查詢同場精華失敗:', error)
        return { videos: [] }
      }

      if (!videosData || videosData.length === 0) {
        console.log('嚴格模式: 找不到同場精華，返回空陣列')
        return { videos: [] }
      }

      // 將 Supabase 關聯欄位 member/clipper 映射回型別定義中的 members/clipper
      // 並在前端過濾掉當前這一部影片本身
      const filteredVideos = (videosData as any[])
        .filter((v) => v.id !== video.id)
        .map((v) => ({
          ...v,
          members: v.members ?? null,
          clipper: v.clippers ?? null,
        })) as Video[]

      console.log(`嚴格模式: 找到 ${filteredVideos.length} 部同場精華`)
      return { videos: filteredVideos }
    },
    enabled: open, // 只在彈出視窗打開時查詢
  })

  // 標題固定為「同場直播所有剪輯」
  const dialogTitle = '同場直播所有剪輯'

  const videos = relatedVideosData?.videos || []

  // 複製同場精華連結
  const handleCopyLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/?v=${video.id}`
      await navigator.clipboard.writeText(shareUrl)
      alert('已複製同場精華連結！')
    } catch (error) {
      console.error('複製連結失敗:', error)
      alert('複製連結失敗，請手動複製網址')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              分享連結
            </Button>
          </div>
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

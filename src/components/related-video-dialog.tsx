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
  // 三層降級查詢：確保總是有影片可以推薦（簡化版，只使用 videos 表）
  const { data: relatedVideos = [], isLoading } = useQuery({
    queryKey: ['related-clips', video.id, video.video_id, video.member_id],
    queryFn: async () => {
      let results: Video[] = []

      // ===== 第一順位：同成員的近期精華（最安全的方式） =====
      if (video.member_id) {
        try {
          const { data: videosData } = await supabase
            .from('videos')
            .select('*, member:members(*), clipper:clippers(*)')
            .eq('member_id', video.member_id)
            .not('clipper_id', 'is', null)
            .neq('video_type', 'live')
            .neq('video_type', 'archive')
            .neq('id', video.id) // 排除當前影片
            .order('published_at', { ascending: false })
            .limit(10)

          if (videosData && videosData.length > 0) {
            results = videosData.map((v: any) => ({
              ...v,
              members: v.member || null,
            })) as Video[]
          }
        } catch (error) {
          console.warn('第一順位查詢失敗:', error)
        }
      }

      // ===== 第二順位：全站熱門精華（Fallback） =====
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
            .neq('id', video.id) // 排除當前影片
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
          }
        } catch (error) {
          console.warn('第二順位查詢失敗:', error)
        }
      }

      // ===== 第三順位：全站最新精華（最終 Fallback） =====
      if (results.length < 3) {
        try {
          const { data: videosData } = await supabase
            .from('videos')
            .select('*, member:members(*), clipper:clippers(*)')
            .not('clipper_id', 'is', null)
            .neq('video_type', 'live')
            .neq('video_type', 'archive')
            .neq('id', video.id) // 排除當前影片
            .order('published_at', { ascending: false })
            .limit(20)

          if (videosData && videosData.length > 0) {
            const randomClips = videosData.map((v: any) => ({
              ...v,
              members: v.member || null,
            })) as Video[]

            const existingIds = new Set(results.map(v => v.id))
            const newClips = randomClips
              .filter(v => !existingIds.has(v.id))
              .slice(0, 6 - results.length) // 確保總數不超過 6 部
            results = [...results, ...newClips]
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

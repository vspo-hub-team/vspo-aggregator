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
  // 極簡化查詢：只使用基礎欄位，確保一定能查詢到資料
  const { data: relatedVideos = [], isLoading } = useQuery({
    queryKey: ['related-clips', video.id, video.member_id],
    queryFn: async () => {
      let results: Video[] = []

      // ===== 第一順位：同成員推薦（最簡單直接） =====
      if (video.member_id) {
        try {
          // 只查詢基礎欄位，不進行 JOIN（移除不存在的 video_id）
          const { data: videosData, error } = await supabase
            .from('videos')
            .select('id, title, thumbnail_url, member_id, clipper_id, published_at, view_count, video_type, duration_sec, platform, created_at, updated_at')
            .eq('member_id', video.member_id) // 同成員
            .not('clipper_id', 'is', null) // 只取精華（有 clipper_id）
            .neq('video_type', 'live') // 排除直播
            .neq('video_type', 'archive') // 排除存檔
            .neq('id', video.id) // 排除當前影片
            .order('published_at', { ascending: false })
            .limit(6)

          if (error) {
            console.warn('第一順位查詢錯誤:', error)
          } else if (videosData && videosData.length > 0) {
            // 如果需要關聯資料，再單獨查詢
            const memberIds = [...new Set(videosData.map(v => v.member_id).filter(Boolean))]
            const clipperIds = [...new Set(videosData.map(v => v.clipper_id).filter(Boolean))]

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

            results = videosData.map((v: any) => ({
              ...v,
              members: membersMap.get(v.member_id) || null,
              clipper: clippersMap.get(v.clipper_id) || null,
            })) as Video[]
          }
        } catch (error) {
          console.warn('第一順位查詢失敗:', error)
        }
      }

      // ===== 第二順位：全站最新精華（無腦 Fallback） =====
      if (results.length < 3) {
        try {
          // 只查詢基礎欄位（移除不存在的 video_id）
          const { data: videosData, error } = await supabase
            .from('videos')
            .select('id, title, thumbnail_url, member_id, clipper_id, published_at, view_count, video_type, duration_sec, platform, created_at, updated_at')
            .not('clipper_id', 'is', null) // 只取精華
            .neq('video_type', 'live') // 排除直播
            .neq('video_type', 'archive') // 排除存檔
            .neq('id', video.id) // 排除當前影片
            .order('published_at', { ascending: false })
            .limit(6)

          if (error) {
            console.warn('第二順位查詢錯誤:', error)
          } else if (videosData && videosData.length > 0) {
            // 如果需要關聯資料，再單獨查詢
            const memberIds = [...new Set(videosData.map(v => v.member_id).filter(Boolean))]
            const clipperIds = [...new Set(videosData.map(v => v.clipper_id).filter(Boolean))]

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

            const newClips = videosData.map((v: any) => ({
              ...v,
              members: membersMap.get(v.member_id) || null,
              clipper: clippersMap.get(v.clipper_id) || null,
            })) as Video[]

            // 合併結果，避免重複
            const existingIds = new Set(results.map(v => v.id))
            const uniqueClips = newClips.filter(v => !existingIds.has(v.id))
            results = [...results, ...uniqueClips]
          }
        } catch (error) {
          console.warn('第二順位查詢失敗:', error)
        }
      }

      // 確保返回最多 6 部影片
      return results.slice(0, 6)
    },
    enabled: open, // 對所有影片都查詢
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

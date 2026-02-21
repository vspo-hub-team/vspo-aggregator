'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
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

/**
 * 計算兩個標題的相似度分數（增強版）
 */
function calculateSimilarity(
  titleA: string,
  titleB: string,
  clipperIdA: number | null,
  clipperIdB: number | null,
  member: { name_zh?: string | null; name_jp?: string | null } | null | undefined,
  candidateTitle: string
): number {
  // 移除非文字符號，切割成 token
  const tokenize = (title: string): string[] => {
    return title
      .replace(/[【】\[\]()（）#【】「」『』《》]/g, ' ') // 移除常見符號
      .split(/\s+/)
      .filter(token => token.length > 0)
      .map(token => token.toLowerCase())
  }

  const tokensA = tokenize(titleA)
  const tokensB = tokenize(titleB)

  // 計算重疊關鍵字數量
  const setA = new Set(tokensA)
  const setB = new Set(tokensB)
  let overlapCount = 0

  for (const token of setA) {
    if (setB.has(token)) {
      overlapCount++
    }
  }

  // 基礎分數：重疊關鍵字數量
  let score = overlapCount

  // 加分項 1：如果有相同的 clipper_id，額外加分
  if (clipperIdA && clipperIdB && clipperIdA === clipperIdB) {
    score += 3 // 同一個剪輯師額外加 3 分
  }

  // 加分項 2：成員加權（如果候選影片標題包含成員名稱）
  if (member) {
    const memberNameZh = member.name_zh?.toLowerCase() || ''
    const memberNameJp = member.name_jp?.toLowerCase() || ''
    const candidateTitleLower = candidateTitle.toLowerCase()

    if (memberNameZh && candidateTitleLower.includes(memberNameZh)) {
      score += 10 // 包含中文名稱，+10 分
    }
    if (memberNameJp && candidateTitleLower.includes(memberNameJp)) {
      score += 10 // 包含日文名稱，+10 分
    }
  }

  return score
}

export function RelatedVideoDialog({ video, open, onOpenChange }: RelatedVideoDialogProps) {
  // 只抓取剪輯（clipper_id 不為空）且排除直播
  const { data: allVideos = [], isLoading } = useQuery({
    queryKey: ['related-clips', video.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('videos')
        .select('*, member:members(*), clipper:clippers(*)')
        .not('clipper_id', 'is', null) // 只抓取剪輯
        .neq('video_type', 'live') // 排除直播
        .neq('video_type', 'archive') // 排除存檔（確保只抓精華）
        .neq('id', video.id) // 排除自己
        .order('published_at', { ascending: false })
        .limit(100) // 抓取最新的 100 部精華影片

      if (error) throw error

      // 將 member 別名映射回 members 以保持向後兼容
      const videos = (data || []).map((v: any) => ({
        ...v,
        members: v.member || null,
      }))

      return videos as Video[]
    },
    enabled: open, // 只在對話框打開時查詢
  })

  // 前端智慧排序：計算相似度並排序
  const relatedVideos = useMemo(() => {
    if (!video.title || allVideos.length === 0) {
      return []
    }

    // 計算每個影片的相似度分數
    const videosWithScore = allVideos.map((relatedVideo) => ({
      video: relatedVideo,
      score: calculateSimilarity(
        video.title || '',
        relatedVideo.title || '',
        video.clipper_id,
        relatedVideo.clipper_id,
        video.members, // 傳入當前影片的成員資訊
        relatedVideo.title || ''
      ),
    }))

    // 按分數降序排序
    videosWithScore.sort((a, b) => b.score - a.score)

    // 只取分數 > 0 的影片（至少有一些相似度）
    const filtered = videosWithScore.filter(item => item.score > 0)

    // 取前 10 筆
    return filtered.slice(0, 10).map(item => item.video)
  }, [allVideos, video.title, video.clipper_id, video.members])

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

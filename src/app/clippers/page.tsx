'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Clipper, Video } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Eye, ExternalLink, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

// 擴展 Clipper 類型，包含最新影片
interface ClipperWithLatestVideo extends Clipper {
  latestVideo?: Video | null
}

// 格式化觀看數
function formatViewCount(count: number | null | undefined): string {
  if (count === null || count === undefined) {
    return '0 次觀看'
  }
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}萬 次觀看`
  }
  return `${count.toLocaleString()} 次觀看`
}

function ClipperCardSkeleton() {
  return (
    <Card className="bg-gray-900 border-gray-800 overflow-hidden animate-pulse">
      <Skeleton className="aspect-video w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </Card>
  )
}

// 頻道影片卡片組件
function ClipperVideoCard({ clipper }: { clipper: ClipperWithLatestVideo }) {
  const latestVideo = clipper.latestVideo
  const channelUrl = `https://www.youtube.com/channel/${clipper.channel_id}`
  const videoUrl = latestVideo 
    ? `https://www.youtube.com/watch?v=${latestVideo.id}`
    : null

  // 處理頻道頭像點擊（前往頻道頁面）
  const handleChannelClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.open(channelUrl, '_blank', 'noopener,noreferrer')
  }

  // 處理影片點擊（前往影片頁面）
  const handleVideoClick = () => {
    if (videoUrl) {
      window.open(videoUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Card className="bg-gray-900 border-gray-800 overflow-hidden hover:border-gray-600 transition-colors group">
      {/* 上半部：影片縮圖 */}
      <div className="relative aspect-video bg-black">
        {latestVideo?.thumbnail_url ? (
          <>
            <img
              src={latestVideo.thumbnail_url}
              alt={latestVideo.title || '影片縮圖'}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-video.png'
              }}
            />
            {/* 疊加頻道資訊 */}
            <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1.5">
              <button
                onClick={handleChannelClick}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Avatar className="h-6 w-6 border border-gray-600">
                  <AvatarImage src={clipper.avatar_url || undefined} />
                  <AvatarFallback className="bg-gray-700 text-gray-300 text-xs">
                    {clipper.name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold text-white line-clamp-1 max-w-[120px]">
                  {clipper.name}
                </span>
              </button>
            </div>
            {/* 點擊遮罩 */}
            <button
              onClick={handleVideoClick}
              className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center"
            >
              <div className="opacity-0 group-hover:opacity-100 bg-red-600/90 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transform scale-90 group-hover:scale-100 transition-all flex items-center gap-1.5">
                <ExternalLink size={14} /> 觀看影片
              </div>
            </button>
          </>
        ) : (
          // 沒有影片時的佔位符
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-sm gap-2">
            <div className="text-2xl">📺</div>
            <span>尚無影片</span>
            {/* 頻道資訊（即使沒有影片也顯示） */}
            <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1.5">
              <button
                onClick={handleChannelClick}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Avatar className="h-6 w-6 border border-gray-600">
                  <AvatarImage src={clipper.avatar_url || undefined} />
                  <AvatarFallback className="bg-gray-700 text-gray-300 text-xs">
                    {clipper.name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold text-white line-clamp-1 max-w-[120px]">
                  {clipper.name}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 下半部：影片資訊 */}
      {latestVideo && (
        <div className="p-4 space-y-2">
          {/* 影片標題 */}
          <button
            onClick={handleVideoClick}
            className="text-sm text-gray-200 line-clamp-2 hover:text-blue-400 transition-colors text-left w-full leading-tight"
          >
            {latestVideo.title}
          </button>
          
          {/* 發布時間與觀看次數 */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {formatViewCount(latestVideo.view_count)}
            </span>
            {latestVideo.published_at && (
              <span>
                {formatDistanceToNow(new Date(latestVideo.published_at), {
                  addSuffix: true,
                  locale: zhTW,
                })}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// 推薦頻道表單組件
function RecommendClipperDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 簡單驗證 YouTube URL
    if (!youtubeUrl.trim()) {
      alert('請輸入 YouTube 頻道網址')
      return
    }

    // 驗證是否為有效的 YouTube 頻道 URL
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:channel\/|user\/|@)|youtu\.be\/)/
    if (!youtubeRegex.test(youtubeUrl.trim())) {
      alert('請輸入有效的 YouTube 頻道網址')
      return
    }

    setIsSubmitting(true)

    // 模擬提交（目前只顯示成功提示）
    setTimeout(() => {
      setIsSubmitting(false)
      alert('感謝推薦！我們會盡快審核並加入資料庫。')
      setYoutubeUrl('')
      setNotes('')
      onOpenChange(false)
    }, 500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            ✨ 推薦新烤肉頻道
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            如果您發現有優質的剪輯頻道尚未收錄，歡迎推薦給我們！
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="youtube-url" className="text-sm font-medium text-gray-300">
              剪輯頻道 YouTube 網址 <span className="text-red-400">*</span>
            </label>
            <input
              id="youtube-url"
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/channel/..."
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500">
              請貼上完整的 YouTube 頻道網址
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium text-gray-300">
              推薦理由 / 備註 <span className="text-gray-500 text-xs">(選填)</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如：這個頻道專門剪輯 VSPO 成員的精華，品質很高..."
              rows={4}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? '送出中...' : '送出推薦'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ClippersPage() {
  const router = useRouter()
  const [isRecommendDialogOpen, setIsRecommendDialogOpen] = useState(false)

  // 獲取所有精華頻道及其最新影片（使用兩步查詢）
  const { data: clippers = [], isLoading, isError, error } = useQuery({
    queryKey: ['all-clippers-with-videos'],
    queryFn: async () => {
      // Step 1: 獨立獲取所有剪輯頻道
      const { data: clippersData, error: clippersError } = await supabase
        .from('clippers')
        .select('*')
        .order('name', { ascending: true })

      if (clippersError) throw clippersError
      if (!clippersData || clippersData.length === 0) {
        return [] as ClipperWithLatestVideo[]
      }

      // Step 2: 獨立獲取最新精華影片
      // 提取所有 clipper 的 ID
      const clipperIds = clippersData
        .map((c: any) => c.id)
        .filter((id: any) => id != null)
      
      // 加上空陣列防呆機制
      if (!clipperIds || clipperIds.length === 0) {
        // 如果沒有有效的 clipper IDs，直接返回沒有影片的 clippers
        return clippersData.map((c: any) => ({
          ...c,
          latestVideo: null
        })) as ClipperWithLatestVideo[]
      }

      // 查詢這些頻道的近期影片（按發布時間降序，限制 1000 筆）
      // 必須包含 related_stream_id 欄位，用於同場直播關聯查詢
      const { data: recentVideos, error: videosError } = await supabase
        .from('videos')
        .select('id, related_stream_id, title, thumbnail_url, published_at, view_count, duration_sec, clipper_id')
        .in('clipper_id', clipperIds)
        .not('clipper_id', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1000)

      if (videosError) {
        console.error('Error fetching videos:', JSON.stringify(videosError, null, 2))
        // 即使影片查詢失敗，也返回 clippers（只是沒有影片）
        return clippersData.map((c: any) => ({
          ...c,
          latestVideo: null
        })) as ClipperWithLatestVideo[]
      }

      // Step 3: 在前端合併資料
      // 建立一個 Map，key 是 clipper_id，value 是該頻道的第一部影片（因為已按時間降序，第一部就是最新）
      const latestVideoMap = new Map<number, Video>()
      for (const video of recentVideos || []) {
        const clipperId = video.clipper_id
        if (clipperId != null && !latestVideoMap.has(clipperId)) {
          latestVideoMap.set(clipperId, video as Video)
        }
      }

      // 遍歷 clippers，為每個 clipper 附加最新影片
      const processed = clippersData.map((clipper: any) => {
        const latestVideo = latestVideoMap.get(clipper.id) || null
        return {
          ...clipper,
          latestVideo
        } as ClipperWithLatestVideo
      })

      // Step 4: 按照最新影片的發布時間降序排列（有最新影片的排在前面）
      return processed.sort((a, b) => {
        const timeA = a.latestVideo?.published_at 
          ? new Date(a.latestVideo.published_at).getTime() 
          : 0
        const timeB = b.latestVideo?.published_at 
          ? new Date(b.latestVideo.published_at).getTime() 
          : 0
        return timeB - timeA // 降序 (最新的在前面)
      })
    },
  })

  // 按語言分組
  const jpClippers = clippers.filter(c => c.lang === 'ja') as ClipperWithLatestVideo[]
  const zhClippers = clippers.filter(c => c.lang === 'zh') as ClipperWithLatestVideo[]

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-950 px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 返回按鈕與推薦按鈕 */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首頁
            </Button>
            <Button
              onClick={() => setIsRecommendDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              推薦新烤肉頻道
            </Button>
          </div>

          {/* 標題 */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              精華頻道列表
            </h1>
            <p className="text-gray-400 mb-1">
              所有已收錄的烤肉頻道（剪輯師）
            </p>
            <p className="text-sm text-gray-500">
              這裡收錄了所有為 VSPO 成員製作精華的創作者。如果有遺漏的優質頻道，歡迎點擊右上角推薦給我們！
            </p>
          </div>

          {/* 推薦頻道對話框 */}
          <RecommendClipperDialog
            open={isRecommendDialogOpen}
            onOpenChange={setIsRecommendDialogOpen}
          />

          {/* 載入中骨架屏 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <ClipperCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (isError) {
    return (
      <main className="min-h-screen bg-gray-950 px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 返回按鈕與推薦按鈕 */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首頁
            </Button>
            <Button
              onClick={() => setIsRecommendDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              推薦新烤肉頻道
            </Button>
          </div>

          {/* 推薦頻道對話框 */}
          <RecommendClipperDialog
            open={isRecommendDialogOpen}
            onOpenChange={setIsRecommendDialogOpen}
          />

          <Card className="bg-gray-900 border-gray-700 p-8 text-center">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">
              載入錯誤
            </h2>
            <p className="text-sm text-gray-400">
              {error instanceof Error ? error.message : '未知錯誤'}
            </p>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 返回按鈕與推薦按鈕 */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首頁
          </Button>
          <Button
            onClick={() => setIsRecommendDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            推薦新烤肉頻道
          </Button>
        </div>

        {/* 標題 */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            精華頻道列表
          </h1>
          <p className="text-gray-400 mb-1">
            所有已收錄的烤肉頻道（剪輯師）
          </p>
          <p className="text-sm text-gray-500">
            這裡收錄了所有為 VSPO 成員製作精華的創作者。如果有遺漏的優質頻道，歡迎點擊右上角推薦給我們！
          </p>
        </div>

        {/* 推薦頻道對話框 */}
        <RecommendClipperDialog
          open={isRecommendDialogOpen}
          onOpenChange={setIsRecommendDialogOpen}
        />

        {/* 日文精華頻道 */}
        {jpClippers.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-blue-500">🇯🇵</span>
              日文精華頻道
              <span className="text-sm text-gray-400 font-normal">
                ({jpClippers.length} 個頻道)
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {jpClippers.map((clipper) => (
                <ClipperVideoCard key={clipper.id} clipper={clipper} />
              ))}
            </div>
          </div>
        )}

        {/* 中文精華頻道 */}
        {zhClippers.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-cyan-500">🇨🇳</span>
              中文精華頻道
              <span className="text-sm text-gray-400 font-normal">
                ({zhClippers.length} 個頻道)
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {zhClippers.map((clipper) => (
                <ClipperVideoCard key={clipper.id} clipper={clipper} />
              ))}
            </div>
          </div>
        )}

        {/* 空狀態 */}
        {clippers.length === 0 && (
          <Card className="bg-gray-900 border-gray-700 p-8 text-center">
            <div className="text-4xl mb-4">📺</div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">
              尚無精華頻道
            </h2>
            <p className="text-sm text-gray-400">
              目前資料庫中還沒有收錄任何精華頻道
            </p>
          </Card>
        )}
      </div>
    </main>
  )
}

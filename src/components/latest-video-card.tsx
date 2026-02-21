'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Clapperboard, ExternalLink, Youtube, Twitch } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Video } from '@/types/database'
import { RelatedVideoDialog } from '@/components/related-video-dialog'

interface LatestVideoCardProps {
  video: Video
  hideRelatedButton?: boolean
}

export function LatestVideoCard({ video, hideRelatedButton = false }: LatestVideoCardProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  // 優先顯示 clipper（如果是烤肉影片），否則顯示官方成員
  const clipper = video.clipper
  const member = video.members
  
  // 決定顯示的頭像和名稱
  const displayName = clipper 
    ? clipper.name 
    : (member?.name_jp || '未知成員')
  const displayAvatar = clipper 
    ? clipper.avatar_url 
    : (member?.avatar_url || null)
  const hasDisplayInfo = clipper !== null || member !== null

  // 格式化時間：顯示精確時間 (MM/DD HH:mm)
  const formatPublishedTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '未知時間'
    try {
      const date = new Date(dateString)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${month}/${day} ${hours}:${minutes}`
    } catch {
      return '未知時間'
    }
  }

  const publishedTime = formatPublishedTime(video.published_at)

  // 判斷是否為 New（嚴格計算 24 小時內發布）
  const isNew = video.published_at
    ? (() => {
        const now = Date.now()
        const publishedAt = new Date(video.published_at).getTime()
        const hoursDiff = (now - publishedAt) / (1000 * 60 * 60)
        return hoursDiff < 24
      })()
    : false

  // 格式化觀看數
  const formatViewCount = (count: number | null | undefined): string => {
    if (count === null || count === undefined) {
      return '0 次觀看'
    }
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}萬 次觀看`
    }
    return `${count.toLocaleString()} 次觀看`
  }

  // 格式化時長 (秒數轉為 HH:mm:ss 或 mm:ss)
  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds || seconds === 0) return ''
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }

  // 根據平台決定影片連結
  const videoId = video.video_id || video.id
  const getVideoUrl = () => {
    if (video.platform === 'twitch') {
      return `https://www.twitch.tv/videos/${videoId}`
    }
    // 預設為 YouTube（包括 platform === 'youtube' 或 null）
    return `https://www.youtube.com/watch?v=${videoId}`
  }
  const videoUrl = getVideoUrl()

  // 處理成員頭像點擊事件（跳轉到個人頁面）
  const handleAvatarClick = (e: React.MouseEvent) => {
    e.preventDefault() // 阻止外層 <a> 的預設跳轉行為
    e.stopPropagation() // 阻止事件向上冒泡到外層的卡片

    if (!member?.id) return

    // 單純左鍵點擊即可跳轉
    router.push(`/member/${member.id}`)
  }

  // 影片類型標籤樣式
  const getTypeBadge = () => {
    if (video.video_type === 'live') {
      return (
        <Badge
          variant="destructive"
          className="absolute top-2 left-2 bg-red-600 text-white animate-pulse"
        >
          LIVE
        </Badge>
      )
    }
    if (video.video_type === 'upcoming') {
      return (
        <Badge
          variant="default"
          className="absolute top-2 left-2 bg-blue-600 text-white"
        >
          UPCOMING
        </Badge>
      )
    }
    return null
  }

  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <Card className="group overflow-hidden transition-transform hover:scale-105 cursor-pointer">
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <img
            src={video.thumbnail_url || 'https://via.placeholder.com/640x360'}
            alt={video.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-110"
          />
          {/* 影片類型標籤 */}
          {getTypeBadge()}
          {/* 時長顯示（右下角） */}
          {video.duration_sec && video.duration_sec > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
              {formatDuration(video.duration_sec)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Title */}
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
            {video.title}
          </h3>

          {/* Published Time, Platform, New Label & View Count */}
          <div className="flex items-center justify-between gap-2">
            {/* 左邊：發布時間和平台圖示 */}
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground">{publishedTime}</p>
              {/* 平台圖示 */}
              {video.platform === 'twitch' ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Twitch className="h-3 w-3 text-purple-500" />
                  <span className="text-purple-500">Twitch</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Youtube className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">YouTube</span>
                </div>
              )}
            </div>
            {/* 右邊：New 標籤和觀看次數 */}
            <div className="flex items-center gap-2">
              {/* New 標籤（24 小時內發布） */}
              {isNew && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 whitespace-nowrap">
                  New
                </span>
              )}
              {/* 觀看次數（永遠顯示，即使是 0） */}
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {formatViewCount(video.view_count)}
              </p>
            </div>
          </div>

          {/* Member/Clipper Info & Related Button */}
          <div className="flex items-center justify-between pt-1">
            {hasDisplayInfo && (
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {/* 如果是成員（不是 clipper），添加點擊事件跳轉到個人頁面 */}
                {member && !clipper ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleAvatarClick}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleAvatarClick(e as any)
                      }
                    }}
                    title="前往成員個人主頁"
                    className="flex items-center space-x-2 flex-1 min-w-0 hover:opacity-80 transition-opacity cursor-pointer group/avatar"
                  >
                    <div className="relative">
                      <Avatar className="h-6 w-6">
                        {displayAvatar ? (
                          <AvatarImage src={displayAvatar} alt={displayName} />
                        ) : (
                          <AvatarFallback className="text-xs">
                            {displayName.slice(0, 2)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      {/* 懸浮時顯示外連圖示 */}
                      <div className="absolute -bottom-0.5 -right-0.5 bg-blue-600 rounded-full p-0.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                        <ExternalLink className="h-2.5 w-2.5 text-white" />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground truncate group-hover/avatar:text-blue-400 transition-colors">
                      {displayName}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <Avatar className="h-6 w-6">
                      {displayAvatar ? (
                        <AvatarImage src={displayAvatar} alt={displayName} />
                      ) : (
                        <AvatarFallback className="text-xs">
                          {displayName.slice(0, 2)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate">
                      {displayName}
                    </span>
                  </div>
                )}
              </div>
            )}
            {/* 相關影片按鈕 */}
            {!hideRelatedButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setDialogOpen(true)
                }}
                title="查看相關影片"
              >
                <Clapperboard className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 相關影片對話框 */}
      {!hideRelatedButton && (
        <RelatedVideoDialog
          video={video}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </a>
  )
}

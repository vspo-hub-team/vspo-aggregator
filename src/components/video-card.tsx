import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { FALLBACK_VIDEO_THUMBNAIL, getOptimizedImageUrl } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Clip } from '@/types/database'

interface VideoCardProps {
  clip: Clip
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export function VideoCard({ clip }: VideoCardProps) {
  const channelName = clip.translate_channels?.channel_name || '未知頻道'
  const publishedTime = clip.published_at
    ? formatDistanceToNow(new Date(clip.published_at), {
        addSuffix: true,
        locale: zhTW,
      })
    : '未知時間'

  return (
    <Link href={`https://www.youtube.com/watch?v=${clip.video_id}`} target="_blank" rel="noopener noreferrer">
      <Card className="group cursor-pointer gap-0 overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-indigo-500/10">
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
          <img
            src={getOptimizedImageUrl(clip.thumbnail_url || FALLBACK_VIDEO_THUMBNAIL, 640)}
            alt={clip.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = FALLBACK_VIDEO_THUMBNAIL
            }}
          />
          {/* Duration Badge */}
          {clip.duration_sec && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="secondary" className="bg-black/80 text-white">
                {formatDuration(clip.duration_sec)}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Title */}
          <h3 className="line-clamp-2 text-sm md:text-base font-semibold leading-tight">
            {clip.title}
          </h3>

          {/* Channel Info */}
          <div className="flex items-center space-x-2">
            <Avatar className="h-6 w-6 transition-transform duration-200 group-hover:scale-110 active:scale-95">
              <AvatarFallback className="text-xs">
                {channelName.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {channelName}
            </span>
          </div>

          {/* Published Time */}
          <p className="text-xs text-muted-foreground">{publishedTime}</p>
        </div>
      </Card>
    </Link>
  )
}

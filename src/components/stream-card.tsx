import Image from 'next/image'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StreamWithMember } from '@/types/database'

interface StreamCardProps {
  stream: StreamWithMember
  hasClips: boolean
}

export function StreamCard({ stream, hasClips }: StreamCardProps) {
  const memberName = stream.members?.name_zh || '未知成員'
  const memberAvatar = stream.members?.avatar_url || null
  const publishedTime = stream.published_at
    ? formatDistanceToNow(new Date(stream.published_at), {
        addSuffix: true,
        locale: zhTW,
      })
    : '未知時間'

  const thumbnailUrl = `https://img.youtube.com/vi/${stream.video_id}/maxresdefault.jpg`

  return (
    <Card className="group overflow-hidden transition-transform hover:scale-105">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <Link
          href={`https://www.youtube.com/watch?v=${stream.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src={thumbnailUrl}
            alt={stream.title || '直播存檔'}
            fill
            className="object-cover transition-transform group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </Link>
        {/* Platform Badge */}
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="bg-black/80 text-white">
            {stream.platform.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
          {stream.title || '無標題'}
        </h3>

        {/* Member Info */}
        <div className="flex items-center space-x-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={memberAvatar || undefined} />
            <AvatarFallback className="text-xs">
              {memberName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {memberName}
          </span>
        </div>

        {/* Published Time */}
        <p className="text-xs text-muted-foreground">{publishedTime}</p>

        {/* Clips Link Button */}
        <div className="pt-1">
          {hasClips ? (
            <Button
              variant="default"
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700"
              asChild
            >
              <Link href={`/archives?stream=${stream.id}`}>
                查看精華
              </Link>
            </Button>
          ) : (
            <Badge variant="secondary" className="w-full justify-center py-1.5">
              尚無精華
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
}

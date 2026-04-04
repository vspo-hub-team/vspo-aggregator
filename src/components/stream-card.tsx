import Image from 'next/image'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Clapperboard } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StreamWithMember } from '@/types/database'
import { useVideoClipsCount } from '@/hooks/use-videos'

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

  // 查詢該影片是否有關聯的剪輯（使用 video_id 作為查詢條件）
  const { data: clipsCount = 0 } = useVideoClipsCount(stream.video_id, 'archive')
  const hasClipsCount = clipsCount > 0

  return (
    <Card className="group gap-0 overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-indigo-500/10">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
        <Link
          href={`https://www.youtube.com/watch?v=${stream.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src={thumbnailUrl}
            alt={stream.title || '直播存檔'}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </Link>
        {/* Platform Badge */}
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="bg-black/80 text-white">
            {stream.platform.toUpperCase()}
          </Badge>
        </div>
        {/* Clips Icon - 右下角 */}
        <div className="absolute bottom-2 right-2 z-10">
          <div
            className={`flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 transition-all ${
              hasClipsCount
                ? '!text-purple-500 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)] hover:!text-purple-400 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]'
                : '!text-muted-foreground !opacity-50'
            }`}
            title={hasClipsCount ? `查看相關精華 (${clipsCount} 部)` : '尚無精華'}
          >
            <Clapperboard className={`h-4 w-4 ${hasClipsCount ? 'text-purple-500' : 'text-muted-foreground opacity-50'}`} />
            {hasClipsCount && clipsCount > 0 && (
              <span className="text-xs font-bold text-purple-500">
                {clipsCount > 99 ? '99+' : clipsCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm md:text-base font-semibold leading-tight">
          {stream.title || '無標題'}
        </h3>

        {/* Member Info */}
        <div className="flex items-center space-x-2">
          <Avatar className="h-6 w-6 transition-transform duration-200 group-hover:scale-110 active:scale-95">
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

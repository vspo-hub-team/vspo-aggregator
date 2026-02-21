'use client'

import { VideoCard } from '@/components/video-card'
import { StreamCard } from '@/components/stream-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClips, useStreams, useStreamHasClips } from '@/hooks/use-videos'
import { Card } from '@/components/ui/card'
import { Clip, StreamWithMember } from '@/types/database'

interface VideoGridProps {
  type: 'clips' | 'streams'
  memberId?: string | null
  isShorts?: boolean | null
  filter?: 'clips_zh' | 'clips_jp' | 'archives'
}

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        </Card>
      ))}
    </div>
  )
}

// Helper function to filter clips by language
function filterClipsByLanguage(
  clips: Clip[],
  filter: 'clips_zh' | 'clips_jp'
): Clip[] {
  return clips.filter((clip) => {
    const channelName = clip.translate_channels?.channel_name || ''
    if (filter === 'clips_zh') {
      // Filter for Chinese channels (contains "中文" or "CN")
      return channelName.includes('中文') || channelName.includes('CN')
    } else {
      // Filter for Japanese channels (contains "日文" or "JP")
      return channelName.includes('日文') || channelName.includes('JP')
    }
  })
}

export function VideoGrid({ type, memberId, isShorts, filter }: VideoGridProps) {
  const clipsQuery = useClips({ memberId, isShorts })
  const streamsQuery = useStreams(memberId)

  if (type === 'clips') {
    if (clipsQuery.isLoading) {
      return <VideoGridSkeleton />
    }

    if (clipsQuery.isError) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          載入錯誤：{clipsQuery.error instanceof Error ? clipsQuery.error.message : '未知錯誤'}
        </div>
      )
    }

    if (!clipsQuery.data || clipsQuery.data.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          目前沒有精華影片
        </div>
      )
    }

    // Filter clips by language if filter is provided
    let filteredClips = clipsQuery.data
    if (filter === 'clips_zh' || filter === 'clips_jp') {
      filteredClips = filterClipsByLanguage(clipsQuery.data, filter)
    }

    if (filteredClips.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          目前沒有{filter === 'clips_zh' ? '中文' : '日文'}精華影片
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredClips.map((clip) => (
          <VideoCard key={clip.id} clip={clip} />
        ))}
      </div>
    )
  }

  // type === 'streams'
  if (streamsQuery.isLoading) {
    return <VideoGridSkeleton />
  }

  if (streamsQuery.isError) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        載入錯誤：{streamsQuery.error instanceof Error ? streamsQuery.error.message : '未知錯誤'}
      </div>
    )
  }

  if (!streamsQuery.data || streamsQuery.data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        目前沒有直播存檔
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {streamsQuery.data.map((stream) => (
        <StreamCardWithClips key={stream.id} stream={stream} />
      ))}
    </div>
  )
}

// Component to check if stream has clips and pass to StreamCard
function StreamCardWithClips({ stream }: { stream: StreamWithMember }) {
  const { data: hasClips, isLoading } = useStreamHasClips(stream.id)

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <Skeleton className="aspect-video w-full" />
        <div className="p-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-full" />
        </div>
      </Card>
    )
  }

  return <StreamCard stream={stream} hasClips={hasClips || false} />
}

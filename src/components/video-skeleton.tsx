'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** 對齊 LatestVideoCard：縮圖 16:9、標題兩行、meta 列、頭像 + 名稱 + 右側按鈕區 */
export function VideoSkeleton({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        'overflow-hidden border-slate-200 dark:border-gray-800',
        className
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted/50 dark:bg-slate-900/50">
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      </div>
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[85%]" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
            <Skeleton className="h-3 flex-1 max-w-[140px]" />
          </div>
          <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
        </div>
      </div>
    </Card>
  )
}

const gridClass =
  'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

export function VideoSkeletonGrid({
  count = 10,
  className,
}: {
  count?: number
  className?: string
}) {
  const n = Math.min(12, Math.max(8, count))
  return (
    <div className={cn(gridClass, className)}>
      {Array.from({ length: n }).map((_, i) => (
        <VideoSkeleton key={i} />
      ))}
    </div>
  )
}

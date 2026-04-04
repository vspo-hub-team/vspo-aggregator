import { Skeleton } from '@/components/ui/skeleton'
import { VideoSkeletonGrid } from '@/components/video-skeleton'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-gray-950 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <VideoSkeletonGrid count={10} />
      </div>
    </main>
  )
}

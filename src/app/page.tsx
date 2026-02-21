'use client'

import { useMembers } from '@/hooks/use-members'
import { LiveNowBar } from '@/components/live-now-bar'
import { LatestVideoGrid } from '@/components/latest-video-grid'

export const revalidate = 60

export default function Home() {
  const { data: members } = useMembers()

  return (
    <main className="min-h-screen bg-gray-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 正在直播快速列 */}
        {members && <LiveNowBar members={members} />}

        {/* 標題 */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">
          最新影片 / Latest Videos
        </h1>

        {/* 最新影片牆 */}
        <LatestVideoGrid />
      </div>
    </main>
  )
}

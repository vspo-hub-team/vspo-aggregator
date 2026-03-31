'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Member } from '@/types/database'
import { LatestVideoGrid } from '@/components/latest-video-grid'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Youtube, Twitch } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { TWITCH_CHANNEL_MAPPING } from '@/config/members'

function MemberProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </div>
  )
}

function MemberProfileHeader({ member }: { member: Member }) {
  const youtubeUrl = member.channel_id_yt
    ? `https://www.youtube.com/channel/${member.channel_id_yt}`
    : null

  // Twitch 链接：使用 mapping 获取正确的 login name
  const twitchLogin = TWITCH_CHANNEL_MAPPING[member.name_jp] || TWITCH_CHANNEL_MAPPING[member.name_zh]
  const twitchUrl = twitchLogin
    ? `https://www.twitch.tv/${twitchLogin}`
    : null

  return (
    <Card className="p-6 bg-gray-900/50 backdrop-blur-sm border-gray-700">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* 頭像 */}
        <div className="relative">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt={member.name_jp || member.name_zh}
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-gray-700 object-cover"
            />
          ) : (
            <div
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-gray-700 flex items-center justify-center text-4xl md:text-5xl"
              style={{
                backgroundColor: `${member.color_hex || '#888888'}20`,
              }}
            >
              📺
            </div>
          )}
          {/* LIVE 狀態指示器 */}
          {member.is_live && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse" />
          )}
        </div>

        {/* 成員資訊 */}
        <div className="flex-1 space-y-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              {member.name_jp}
            </h1>
          </div>

          {/* 社群連結 */}
          <div className="flex flex-wrap gap-3">
            {youtubeUrl && (
              <Button
                asChild
                variant="outline"
                className="bg-red-600/20 hover:bg-red-600/30 border-red-500 text-white"
              >
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Youtube className="h-4 w-4" />
                  YouTube 頻道
                </a>
              </Button>
            )}
            {twitchUrl && (
              <Button
                asChild
                variant="outline"
                className="bg-purple-600/20 hover:bg-purple-600/30 border-purple-500 text-white"
              >
                <a
                  href={twitchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Twitch className="h-4 w-4" />
                  Twitch 頻道
                </a>
              </Button>
            )}
            {!youtubeUrl && !twitchUrl && (
              <p className="text-sm text-gray-500">暫無社群連結</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function MemberProfilePage() {
  const params = useParams()
  const router = useRouter()
  const memberId = params.id as string

  // 獲取成員資料
  const { data: member, isLoading, isError } = useQuery({
    queryKey: ['member', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single()

      if (error) throw error
      return data as Member
    },
  })

  if (isLoading) {
    return (
      <main className="min-h-screen p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首頁
          </Button>
          <MemberProfileSkeleton />
        </div>
      </main>
    )
  }

  if (isError || !member) {
    return (
      <main className="min-h-screen p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首頁
          </Button>
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">找不到成員</h2>
            <p className="text-gray-400">該成員不存在或已被移除</p>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 返回按鈕 */}
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回首頁
        </Button>

        {/* 成員個人資訊 */}
        <MemberProfileHeader member={member} />

        {/* 成員的影片列表 */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
            {member.name_jp} 的影片
          </h2>
          <LatestVideoGrid 
            memberId={memberId}
            channelIds={[
              ...(member.channel_id_yt ? [member.channel_id_yt] : []),
              ...(member.channel_id_twitch ? [member.channel_id_twitch] : []),
            ]}
            memberNames={{
              name_jp: member.name_jp,
              name_zh: member.name_zh,
            }}
          />
        </div>
      </div>
    </main>
  )
}

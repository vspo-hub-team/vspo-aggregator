'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Video, Clipper, Member } from '@/types/database'
import { Card } from '@/components/ui/card'

type LeaderboardVideo = Video & {
  members?: Member | null
  clipper?: Clipper | null
}

interface AggregatedStat {
  id: string | number
  name: string
  avatarUrl: string | null
  totalViews: number
  videoCount: number
}

export default function LeaderboardPage() {
  const { data, isLoading, isError, error } = useQuery<{
    officialHallOfFame: LeaderboardVideo[]
    clipperHallOfFame: LeaderboardVideo[]
    recentVideos: LeaderboardVideo[]
  }>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      // 1) Hall of Fame：拆成官方頻道與烤肉精華兩個榜單（平行查詢）
      const [officialRes, clipperRes] = await Promise.all([
        supabase
          .from('videos')
          .select(
            'id, member_id, clipper_id, platform, title, thumbnail_url, published_at, view_count, video_type, duration_sec, members(*), clippers(*)'
          )
          .is('clipper_id', null)
          .gt('view_count', 0)
          .order('view_count', { ascending: false })
          .limit(10),
        supabase
          .from('videos')
          .select(
            'id, member_id, clipper_id, platform, title, thumbnail_url, published_at, view_count, video_type, duration_sec, members(*), clippers(*)'
          )
          .not('clipper_id', 'is', null)
          .gt('view_count', 0)
          .order('view_count', { ascending: false })
          .limit(10),
      ])

      if (officialRes.error) {
        console.error('載入官方 Hall of Fame 失敗:', officialRes.error)
        throw officialRes.error
      }
      if (clipperRes.error) {
        console.error('載入剪輯 Hall of Fame 失敗:', clipperRes.error)
        throw clipperRes.error
      }

      const officialHallOfFame: LeaderboardVideo[] = (officialRes.data || []).map((v: any) => ({
        ...(v as Video),
        members: v.members ?? null,
        clipper: v.clippers ?? null,
      }))

      const clipperHallOfFame: LeaderboardVideo[] = (clipperRes.data || []).map((v: any) => ({
        ...(v as Video),
        members: v.members ?? null,
        clipper: v.clippers ?? null,
      }))

      // 2) 近 30 天內所有影片，之後在前端分組
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: recentData, error: recentError } = await supabase
        .from('videos')
        .select(
          'id, member_id, clipper_id, platform, title, thumbnail_url, published_at, view_count, video_type, duration_sec, members(*), clippers(*)'
        )
        .gte('published_at', thirtyDaysAgo)

      if (recentError) {
        console.error('載入近 30 天影片失敗:', recentError)
        throw recentError
      }

      const recentVideos: LeaderboardVideo[] = (recentData || []).map((v: any) => ({
        ...(v as Video),
        members: v.members ?? null,
        clipper: v.clippers ?? null,
      }))

      return { officialHallOfFame, clipperHallOfFame, recentVideos }
    },
  })

  const officialHallOfFame = data?.officialHallOfFame ?? []
  const clipperHallOfFame = data?.clipperHallOfFame ?? []
  const recentVideos = data?.recentVideos ?? []

  // Hall of Fame Tab 狀態：官方 / 剪輯
  const [hofTab, setHofTab] = useState<'official' | 'clip'>('official')

  // 近期最強烤肉 Man：以 clipper_id 分組
  const topClippers: AggregatedStat[] = useMemo(() => {
    const map = new Map<number, AggregatedStat>()

    for (const v of recentVideos) {
      if (!v.clipper_id || !v.clipper) continue
      const key = v.clipper_id
      const prev = map.get(key)
      const views = v.view_count ?? 0

      if (!prev) {
        map.set(key, {
          id: key,
          name: v.clipper.name,
          avatarUrl: v.clipper.avatar_url,
          totalViews: views,
          videoCount: 1,
        })
      } else {
        prev.totalViews += views
        prev.videoCount += 1
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 5)
  }, [recentVideos])

  // 近期人氣王：以 member_id 分組
  const topMembers: AggregatedStat[] = useMemo(() => {
    const map = new Map<string, AggregatedStat>()

    for (const v of recentVideos) {
      if (!v.member_id || !v.members) continue
      const key = v.member_id
      const prev = map.get(key)
      const views = v.view_count ?? 0
      const member = v.members

      const name = member.name_jp || member.name_zh || '成員'
      const avatar = member.avatar_url

      if (!prev) {
        map.set(key, {
          id: key,
          name,
          avatarUrl: avatar,
          totalViews: views,
          videoCount: 1,
        })
      } else {
        prev.totalViews += views
        prev.videoCount += 1
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 5)
  }, [recentVideos])

  return (
    <main className="min-h-screen py-8 md:py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* 頁面標題區 */}
        <header className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <span className="text-4xl md:text-5xl">🏆</span>
            <span>
              趣味數據排行榜
              <span className="block text-base md:text-lg font-normal text-slate-500 dark:text-slate-400">
                VSPO 社群觀測：誰是你的本命，誰又是最強烤肉 Man？
              </span>
            </span>
          </h1>
        </header>

        {isLoading && (
          <p className="text-sm text-slate-600 dark:text-slate-300">載入排行榜中...</p>
        )}

        {isError && (
          <p className="text-sm text-red-400">
            載入失敗：{error instanceof Error ? error.message : '未知錯誤'}
          </p>
        )}

        {!isLoading && !isError && (
          <div className="space-y-10">
            {/* Hall of Fame */}
            <section className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold text-yellow-400 flex items-center gap-2">
                <span>🏆 傳說級精華殿堂 (Hall of Fame)</span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                全站觀看數最高的傳說級影片，一起朝聖這些歷史名場面。
              </p>
              {/* Hall of Fame Tabs */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setHofTab('official')}
                  className={`px-4 py-1.5 text-xs md:text-sm rounded-full border transition-colors ${
                    hofTab === 'official'
                      ? 'text-white border-transparent'
                      : 'border-slate-600 text-slate-300 hover:bg-slate-800'
                  }`}
                  style={
                    hofTab === 'official'
                      ? {
                          backgroundColor: 'var(--theme-color, #8b5cf6)',
                          borderColor: 'var(--theme-color, #8b5cf6)',
                        }
                      : undefined
                  }
                >
                  官方頻道殿堂
                </button>
                <button
                  type="button"
                  onClick={() => setHofTab('clip')}
                  className={`px-4 py-1.5 text-xs md:text-sm rounded-full border transition-colors ${
                    hofTab === 'clip'
                      ? 'text-white border-transparent'
                      : 'border-slate-600 text-slate-300 hover:bg-slate-800'
                  }`}
                  style={
                    hofTab === 'clip'
                      ? {
                          backgroundColor: 'var(--theme-color, #8b5cf6)',
                          borderColor: 'var(--theme-color, #8b5cf6)',
                        }
                      : undefined
                  }
                >
                  烤肉精華殿堂
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(hofTab === 'official' ? officialHallOfFame : clipperHallOfFame).map((video, index) => {
                  const href =
                    video.platform === 'twitch'
                      ? `https://www.twitch.tv/videos/${video.id}`
                      : `https://www.youtube.com/watch?v=${video.id}`

                  return (
                    <a
                      key={video.id}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <Card className="flex overflow-hidden bg-slate-900/80 border-slate-800 group-hover:border-yellow-400/70 group-hover:shadow-[0_0_25px_rgba(250,204,21,0.3)] transition-all">
                        <div className="relative w-40 md:w-48 flex-shrink-0">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt={video.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-800 text-3xl">
                              📺
                            </div>
                          )}
                          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                            <span className="text-yellow-300">#{index + 1}</span>
                            <span>ALL TIME</span>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col justify-between p-3 md:p-4 space-y-2">
                          <div className="space-y-1">
                            <p className="line-clamp-2 text-sm md:text-base font-semibold text-slate-50">
                              {video.title}
                            </p>
                            <p className="text-xs text-slate-400">
                              {video.members?.name_jp ||
                                video.members?.name_zh ||
                                video.clipper?.name ||
                                'VSPO 相關影片'}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>👁 {video.view_count?.toLocaleString() ?? 0} views</span>
                            {video.published_at && (
                              <span>
                                發布於 {new Date(video.published_at).toLocaleDateString('ja-JP')}
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>
                    </a>
                  )
                })}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Clippers */}
              <section className="space-y-4">
                <h2 className="text-xl md:text-2xl font-bold text-pink-400 flex items-center gap-2">
                  <span>🔥 近期最強烤肉 Man (Top Clippers)</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  過去 30 天內，哪幾位剪輯師用愛與肝撐起了 VSPO 的同接與話題？
                </p>
                <Card className="bg-slate-900/80 border-slate-800 overflow-hidden">
                  <div className="divide-y divide-slate-800">
                    {topClippers.length === 0 && (
                      <div className="p-4 text-sm text-slate-400">暫無資料，稍後再來看看。</div>
                    )}
                    {topClippers.map((clipper, index) => (
                      <div
                        key={clipper.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500/20 text-pink-300 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 flex items-center gap-3">
                          {clipper.avatarUrl ? (
                            <img
                              src={clipper.avatarUrl}
                              alt={clipper.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-lg">
                              🎬
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-50">{clipper.name}</p>
                            <p className="text-xs text-slate-400">
                              👁 {clipper.totalViews.toLocaleString()} views ・
                              <span className="ml-1">{clipper.videoCount} videos</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>

              {/* Top VTubers */}
              <section className="space-y-4">
                <h2 className="text-xl md:text-2xl font-bold text-emerald-400 flex items-center gap-2">
                  <span>👑 近期人氣王 (Top VTubers)</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  過去 30 天內，哪幾位 VSPO 成員最常出現在你的時間軸上？
                </p>
                <Card className="bg-slate-900/80 border-slate-800 overflow-hidden">
                  <div className="divide-y divide-slate-800">
                    {topMembers.length === 0 && (
                      <div className="p-4 text-sm text-slate-400">暫無資料，稍後再來看看。</div>
                    )}
                    {topMembers.map((member, index) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 flex items-center gap-3">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-lg">
                              📺
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-50">{member.name}</p>
                            <p className="text-xs text-slate-400">
                              👁 {member.totalViews.toLocaleString()} views ・
                              <span className="ml-1">{member.videoCount} videos</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}


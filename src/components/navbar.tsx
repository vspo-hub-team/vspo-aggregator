'use client'

import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { useMembers } from '@/hooks/use-members'
import { getNearestUpcomingBirthdayWithinWeek } from '@/lib/birthday-utils'
import { getOptimizedImageUrl } from '@/lib/utils'

export function Navbar() {
  const { data: members = [] } = useMembers()
  const upcomingBirthday = getNearestUpcomingBirthdayWithinWeek(members)
  const birthdayNames = upcomingBirthday?.members
    .map((member) => member.name_jp || member.name_zh)
    .join(', ')

  return (
    <nav className="relative overflow-hidden flex flex-col items-center justify-center w-full py-12 md:py-16 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-background">
      {/* 主題切換按鈕 - 右上角 */}
      <div className="absolute top-4 right-4 md:top-6 md:right-8 flex items-center gap-2">
        {upcomingBirthday && birthdayNames && (
          <div className="max-w-[320px] rounded-full border border-pink-300/70 dark:border-pink-400/40 bg-gradient-to-r from-pink-100/90 via-rose-100/90 to-fuchsia-100/90 dark:from-pink-500/20 dark:via-rose-500/20 dark:to-fuchsia-500/20 px-3 py-1.5 text-[11px] md:text-xs font-semibold text-pink-900 dark:text-pink-100 shadow-[0_0_18px_rgba(236,72,153,0.35)] backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {upcomingBirthday.members.map((member) => (
                  member.avatar_url ? (
                    <img
                      key={member.id}
                      src={getOptimizedImageUrl(member.avatar_url, 128)}
                      alt={member.name_jp || member.name_zh}
                      className="w-6 h-6 rounded-full border border-white/70 dark:border-slate-900/70 object-cover"
                    />
                  ) : (
                    <div
                      key={member.id}
                      className="w-6 h-6 rounded-full border border-white/70 dark:border-slate-900/70 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px]"
                    >
                      🎂
                    </div>
                  )
                ))}
              </div>
              <span>
                {upcomingBirthday.daysUntil === 0
                  ? `🎉 今天是 ${birthdayNames} 的生日！`
                  : `🎂 ${birthdayNames} 生日倒數 ${upcomingBirthday.daysUntil} 天！`}
              </span>
            </div>
          </div>
        )}
        <ThemeToggle />
      </div>

      {/* Aurora Glow 背景效果 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 blur-[100px] pointer-events-none -z-10 rounded-full" />

      {/* 主標題與副標題 */}
      <div className="flex flex-col items-center text-center">
        <Link href="/" className="flex items-center space-x-2">
          <h1 className="text-4xl md:text-5xl font-black text-cyan-400 tracking-widest drop-shadow-lg">
            VSPO 觀測站
          </h1>
        </Link>
        <p className="text-slate-500 dark:text-slate-400/80 text-xs md:text-sm tracking-[0.3em] font-medium mt-2 text-center">
          ぶいすぽっ！非公式クリップ & アーカイブ
        </p>
      </div>

      {/* 導覽連結 */}
      <div className="mt-6 flex items-center gap-3 text-sm">
        <Link
          href="/"
          className="px-4 py-1.5 rounded-full bg-slate-900 text-slate-50 border border-slate-700 hover:bg-slate-800 transition-colors"
        >
          🏠 首頁 / Home
        </Link>
        <Link
          href="/leaderboard"
          prefetch={false}
          className="px-4 py-1.5 rounded-full bg-slate-800 text-slate-100 border border-yellow-400/70 hover:bg-slate-700 hover:border-yellow-300 transition-colors flex items-center gap-2"
        >
          <span>🏆 排行榜</span>
          <span className="hidden md:inline text-xs text-yellow-200/80">Leaderboard</span>
        </Link>
      </div>
    </nav>
  )
}

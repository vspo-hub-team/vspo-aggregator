'use client'

import { useMembers } from '@/hooks/use-members'
import { getNearestUpcomingBirthdayWithinWeek } from '@/lib/birthday-utils'

export function BirthdayAmbientBackground() {
  const { data: members = [] } = useMembers()
  const upcoming = getNearestUpcomingBirthdayWithinWeek(members)
  const avatarUrl = upcoming?.members[0]?.avatar_url

  if (!avatarUrl) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[1]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 dark:opacity-35 blur-2xl scale-125"
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
      <div className="absolute inset-0 bg-slate-50/35 dark:bg-slate-950/45" />
    </div>
  )
}

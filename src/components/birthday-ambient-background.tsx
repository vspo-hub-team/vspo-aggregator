'use client'

import { useMembers } from '@/hooks/use-members'
import { getNearestUpcomingBirthdayWithinWeek } from '@/lib/birthday-utils'

export function BirthdayAmbientBackground() {
  const { data: members = [] } = useMembers()
  const upcoming = getNearestUpcomingBirthdayWithinWeek(members)
  const avatarUrl = upcoming?.members[0]?.avatar_url

  if (!avatarUrl) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 blur-md scale-110"
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
      <div className="absolute inset-0 bg-slate-100/70 dark:bg-slate-950/75" />
    </div>
  )
}

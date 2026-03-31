'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMembers } from '@/hooks/use-members'
import { getNearestUpcomingBirthdayWithinWeek } from '@/lib/birthday-utils'

export function BirthdayAmbientBackground() {
  const { data: members = [] } = useMembers()
  const upcoming = getNearestUpcomingBirthdayWithinWeek(members)
  const birthdayMembers = upcoming?.members ?? []
  const avatarUrls = useMemo(
    () => birthdayMembers.map((member) => member.avatar_url).filter((url): url is string => !!url),
    [birthdayMembers]
  )
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    setCurrentIndex(0)
  }, [avatarUrls.length])

  useEffect(() => {
    if (avatarUrls.length < 2) return

    const intervalId = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % avatarUrls.length)
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [avatarUrls.length])

  const avatarUrl = avatarUrls[currentIndex] || avatarUrls[0]

  if (!avatarUrl) return null

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25 dark:opacity-30 grayscale-[50%] mix-blend-luminosity blur-xl scale-110 transition-all duration-1000 ease-in-out"
        style={{
          backgroundImage: `url(${avatarUrl})`,
          WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 70%)',
          maskImage: 'radial-gradient(circle at center, black 30%, transparent 70%)',
        }}
      />
      <div className="absolute inset-0 bg-slate-50/15 dark:bg-slate-950/20" />
    </div>
  )
}

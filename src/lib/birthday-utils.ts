import { Member } from '@/types/database'

export interface UpcomingBirthdayGroup {
  daysUntil: number
  members: Member[]
}

function parseBirthday(birthday: string): { month: number; day: number } | null {
  const matched = /^(\d{2})-(\d{2})$/.exec(birthday)
  if (!matched) return null

  const month = Number(matched[1])
  const day = Number(matched[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  return { month, day }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysUntilBirthday(birthday: string, today: Date): number | null {
  const parsed = parseBirthday(birthday)
  if (!parsed) return null

  const { month, day } = parsed
  const todayStart = startOfDay(today)

  let target = new Date(todayStart.getFullYear(), month - 1, day)
  if (target < todayStart) {
    target = new Date(todayStart.getFullYear() + 1, month - 1, day)
  }

  const msPerDay = 1000 * 60 * 60 * 24
  return Math.floor((target.getTime() - todayStart.getTime()) / msPerDay)
}

export function getNearestUpcomingBirthdayWithinWeek(
  members: Member[],
  today: Date = new Date()
): UpcomingBirthdayGroup | null {
  let nearestDays: number | null = null
  let nearestMembers: Member[] = []

  for (const member of members) {
    if (!member.birthday) continue

    const days = daysUntilBirthday(member.birthday, today)
    if (days === null) continue
    if (days > 7) continue

    if (nearestDays === null || days < nearestDays) {
      nearestDays = days
      nearestMembers = [member]
      continue
    }

    if (days === nearestDays) {
      nearestMembers.push(member)
    }
  }

  if (nearestDays === null || nearestMembers.length === 0) return null
  return { daysUntil: nearestDays, members: nearestMembers }
}

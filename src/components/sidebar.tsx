'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { Member } from '@/types/database'
import { cn } from '@/lib/utils'

// Mock data for development
const mockMembers: Partial<Member>[] = [
  {
    id: '1',
    name_jp: '胡桃のあ',
    name_zh: '胡桃諾亞',
    channel_id_yt: 'UC1suqwovbL1kzsoaZgFZLKg',
    channel_id_twitch: null,
    color_hex: '#FF6B9D',
    avatar_url: 'https://via.placeholder.com/64',
    is_live: true,
    last_live_at: new Date().toISOString(),
  },
  {
    id: '2',
    name_jp: '花芽なずな',
    name_zh: '花芽薺',
    channel_id_yt: 'UC2hx0xVkMoHGWijwr_lA01w',
    channel_id_twitch: null,
    color_hex: '#FFD700',
    avatar_url: 'https://via.placeholder.com/64',
    is_live: false,
    last_live_at: null,
  },
  {
    id: '3',
    name_jp: '小雀とと',
    name_zh: '小雀鳥',
    channel_id_yt: 'UCgRqGV1gBf2FAxhXsc76Vng',
    channel_id_twitch: null,
    color_hex: '#00CED1',
    avatar_url: 'https://via.placeholder.com/64',
    is_live: true,
    last_live_at: new Date().toISOString(),
  },
  {
    id: '4',
    name_jp: '藍沢エマ',
    name_zh: '藍澤艾瑪',
    channel_id_yt: 'UCz6vnIbgiqFT9xOcEEdkdQw',
    channel_id_twitch: null,
    color_hex: '#4169E1',
    avatar_url: 'https://via.placeholder.com/64',
    is_live: false,
    last_live_at: null,
  },
  {
    id: '5',
    name_jp: '八雲べに',
    name_zh: '八雲紅',
    channel_id_yt: 'UCvzVB-EYuHFXHZrObB8a_Og',
    channel_id_twitch: null,
    color_hex: '#FF4500',
    avatar_url: 'https://via.placeholder.com/64',
    is_live: false,
    last_live_at: null,
  },
]

function MemberList({ onMemberClick }: { onMemberClick?: () => void }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const selectedMemberId = searchParams.get('member')

  const handleMemberClick = (memberId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (selectedMemberId === memberId) {
      params.delete('member')
    } else {
      params.set('member', memberId)
    }
    router.push(`${pathname}?${params.toString()}`)
    onMemberClick?.()
  }

  return (
    <div className="space-y-1 p-2">
      <div className="px-3 py-2 text-sm font-semibold text-muted-foreground">
        成員篩選
      </div>
      {mockMembers.map((member) => {
        const memberId = member.id || 'unknown'
        const isActive = selectedMemberId === memberId
        const color = member.color_hex || '#888888'

        return (
          <Button
            key={memberId}
            variant={isActive ? 'default' : 'ghost'}
            className={cn(
              'w-full justify-start',
              isActive && 'font-semibold'
            )}
            style={
              isActive && color
                ? {
                    backgroundColor: color,
                    color: '#ffffff',
                  }
                : undefined
            }
            onClick={() => handleMemberClick(memberId)}
          >
            {member.name_zh || '未知'}
          </Button>
        )
      })}
    </div>
  )
}

// Desktop Sidebar
export function Sidebar() {
  return (
    <aside className="hidden w-64 border-r border-border bg-card md:block">
      <div className="sticky top-0 h-[calc(100vh-4rem)] overflow-y-auto">
        <MemberList />
      </div>
    </aside>
  )
}

// Mobile Sidebar (Sheet)
export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <MemberList onMemberClick={() => {}} />
      </SheetContent>
    </Sheet>
  )
}

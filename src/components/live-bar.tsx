'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Member } from '@/types/database'

// Mock data for development
const mockMembers: Partial<Member>[] = [
  {
    id: '1',
    name_jp: '胡桃のあ',
    name_zh: '胡桃諾亞',
    channel_id_yt: 'UC1suqwovbL1kzsoaZgFZLKg',
    channel_id_twitch: null,
    color_hex: '#FF6B9D',
    avatar_url: 'https://placehold.co/64/1a1a1a/ffffff?text=Avatar',
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
    avatar_url: 'https://placehold.co/64/1a1a1a/ffffff?text=Avatar',
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
    avatar_url: 'https://placehold.co/64/1a1a1a/ffffff?text=Avatar',
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
    avatar_url: 'https://placehold.co/64/1a1a1a/ffffff?text=Avatar',
    is_live: false,
    last_live_at: null,
  },
]

export function LiveBar() {
  return (
    <div className="border-b border-border/40 bg-card">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center space-x-4 px-4 py-3">
          {mockMembers.map((member) => (
            <div
              key={member.id || 'unknown'}
              className="relative flex flex-col items-center space-y-2"
            >
              <div className="relative">
                <Avatar
                  className={`h-14 w-14 ${
                    member.is_live === true
                      ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-background animate-pulse'
                      : ''
                  }`}
                >
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback>
                    {member.name_zh?.slice(0, 2) || 'VS'}
                  </AvatarFallback>
                </Avatar>
                {member.is_live === true && (
                  <div className="absolute -top-1 -right-1">
                    <Badge
                      variant="destructive"
                      className="h-5 px-1.5 text-xs animate-pulse"
                    >
                      LIVE
                    </Badge>
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground max-w-[64px] truncate">
                {member.name_zh || '未知'}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

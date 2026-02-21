'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Member } from '@/types/database'

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('id', { ascending: true })

      if (error) throw error

      return (data || []) as Member[]
    },
    // 每 60 秒自動刷新一次，確保直播狀態即時更新
    refetchInterval: 60000,
    // 當視窗重新獲得焦點時也自動刷新
    refetchOnWindowFocus: true,
  })
}

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
  })
}

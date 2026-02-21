'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Clip, StreamWithMember } from '@/types/database'

interface UseClipsFilter {
  memberId?: string | null
  isShorts?: boolean | null
}

export function useClips(filter?: UseClipsFilter) {
  return useQuery({
    queryKey: ['clips', filter],
    queryFn: async () => {
      let query = supabase
        .from('clips')
        .select('*, translate_channels(*)')
        .order('published_at', { ascending: false })

      // Filter by isShorts if provided
      if (filter?.isShorts !== null && filter?.isShorts !== undefined) {
        query = query.eq('is_shorts', filter.isShorts)
      }

      const { data, error } = await query

      if (error) throw error

      let clips = (data || []) as Clip[]

      // Filter by memberId if provided (via related_stream_id -> member_id)
      if (filter?.memberId) {
        // First, get all streams for this member
        const { data: memberStreams } = await supabase
          .from('streams')
          .select('id')
          .eq('member_id', filter.memberId)

        if (memberStreams) {
          const streamIds = memberStreams.map((s) => s.id)

          // Filter clips that are related to these streams
          clips = clips.filter(
            (clip) => clip.related_stream_id && streamIds.includes(clip.related_stream_id)
          )
        } else {
          // If no streams found for this member, return empty array
          clips = []
        }
      }

      return clips
    },
  })
}

export function useStreams(memberId?: string | null) {
  return useQuery({
    queryKey: ['streams', memberId],
    queryFn: async () => {
      let query = supabase
        .from('streams')
        .select('*, members(*)')
        .order('published_at', { ascending: false })

      if (memberId) {
        query = query.eq('member_id', memberId)
      }

      const { data, error } = await query

      if (error) throw error

      return (data || []) as StreamWithMember[]
    },
  })
}

// Helper hook to check if a stream has clips
export function useStreamHasClips(streamId: string) {
  return useQuery({
    queryKey: ['stream-has-clips', streamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clips')
        .select('id')
        .eq('related_stream_id', streamId)
        .limit(1)

      if (error) throw error

      return (data?.length || 0) > 0
    },
  })
}

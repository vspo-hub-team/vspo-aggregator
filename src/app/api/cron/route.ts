import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export const runtime = 'edge'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

interface YouTubeVideo {
  id: {
    videoId: string
  }
  snippet: {
    title: string
    description: string
    publishedAt: string
    thumbnails: {
      high: {
        url: string
      }
    }
    channelId: string
  }
}

interface YouTubeSearchResponse {
  items: YouTubeVideo[]
}

// Helper function to detect language from title/description
function detectLanguage(title: string, description: string): {
  isJP: boolean
  isCN: boolean
} {
  const text = `${title} ${description}`.toLowerCase()
  const jpKeywords = ['日文', 'jp', '切り抜き', 'japanese']
  const cnKeywords = ['中文', 'cn', 'chinese', '簡體', '繁體']

  const isJP = jpKeywords.some((keyword) => text.includes(keyword))
  const isCN = cnKeywords.some((keyword) => text.includes(keyword))

  return { isJP, isCN }
}

// Helper function to parse duration from ISO 8601 format
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

// Fetch video details (duration, view count)
async function fetchVideoDetails(videoId: string): Promise<{
  duration: number | null
  viewCount: number | null
}> {
  if (!YOUTUBE_API_KEY) {
    return { duration: null, viewCount: null }
  }

  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/videos?part=contentDetails,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
    )

    if (!response.ok) {
      return { duration: null, viewCount: null }
    }

    const data = await response.json()
    if (!data.items || data.items.length === 0) {
      return { duration: null, viewCount: null }
    }

    const item = data.items[0]
    const duration = item.contentDetails?.duration
      ? parseDuration(item.contentDetails.duration)
      : null
    const viewCount = item.statistics?.viewCount
      ? parseInt(item.statistics.viewCount, 10)
      : null

    return { duration, viewCount }
  } catch (error) {
    console.error('Error fetching video details:', error)
    return { duration: null, viewCount: null }
  }
}

// Main function to update clips from YouTube
async function updateClips() {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY is not set')
  }

  // Step A: Get all translate channels
  const { data: channels, error: channelsError } = await supabaseServer
    .from('translate_channels')
    .select('id, channel_id, channel_name')
    .eq('is_banned', false)

  if (channelsError) {
    throw new Error(`Failed to fetch channels: ${channelsError.message}`)
  }

  if (!channels || channels.length === 0) {
    return { message: 'No channels to process', processed: 0 }
  }

  let totalProcessed = 0
  const errors: string[] = []

  // Step B: Process each channel
  for (const channel of channels) {
    try {
      // Fetch latest 5 videos from YouTube API
      const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`)
      searchUrl.searchParams.set('part', 'snippet')
      searchUrl.searchParams.set('order', 'date')
      searchUrl.searchParams.set('type', 'video')
      searchUrl.searchParams.set('maxResults', '5')
      searchUrl.searchParams.set('channelId', channel.channel_id)
      searchUrl.searchParams.set('key', YOUTUBE_API_KEY)

      const response = await fetch(searchUrl.toString())

      if (!response.ok) {
        const errorText = await response.text()
        errors.push(
          `Channel ${channel.channel_name}: HTTP ${response.status} - ${errorText}`
        )
        continue
      }

      const data: YouTubeSearchResponse = await response.json()

      if (!data.items || data.items.length === 0) {
        continue
      }

      // Step C: Process each video
      for (const video of data.items) {
        try {
          // Fetch video details (duration, view count)
          const { duration, viewCount } = await fetchVideoDetails(
            video.id.videoId
          )

          // Detect language
          const { isJP, isCN } = detectLanguage(
            video.snippet.title,
            video.snippet.description
          )

          // Check if it's a Short (duration < 60 seconds)
          const isShorts = duration !== null && duration < 60

          // Step D: Upsert to database
          const { error: upsertError } = await supabaseServer
            .from('clips')
            .upsert(
              {
                video_id: video.id.videoId,
                title: video.snippet.title,
                thumbnail_url: video.snippet.thumbnails.high.url,
                published_at: video.snippet.publishedAt,
                duration_sec: duration,
                view_count: viewCount,
                channel_id: channel.id,
                is_shorts: isShorts,
              },
              {
                onConflict: 'video_id',
              }
            )

          if (upsertError) {
            errors.push(
              `Video ${video.id.videoId}: ${upsertError.message}`
            )
          } else {
            totalProcessed++
          }
        } catch (error) {
          errors.push(
            `Video ${video.id.videoId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      // Update last_scraped_at
      await supabaseServer
        .from('translate_channels')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('id', channel.id)
    } catch (error) {
      errors.push(
        `Channel ${channel.channel_name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  return {
    message: 'Clips updated successfully',
    processed: totalProcessed,
    errors: errors.length > 0 ? errors : undefined,
  }
}

// Function to update live status
async function updateLiveStatus() {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY is not set')
  }

  // Get all members with YouTube channel IDs
  const { data: members, error: membersError } = await supabaseServer
    .from('members')
    .select('id, channel_id_yt, name_zh')
    .not('channel_id_yt', 'is', null)

  if (membersError) {
    throw new Error(`Failed to fetch members: ${membersError.message}`)
  }

  if (!members || members.length === 0) {
    return { message: 'No members to check', updated: 0 }
  }

  let totalUpdated = 0
  const errors: string[] = []

  for (const member of members) {
    try {
      if (!member.channel_id_yt) continue

      // Check for live streams
      const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`)
      searchUrl.searchParams.set('part', 'snippet')
      searchUrl.searchParams.set('eventType', 'live')
      searchUrl.searchParams.set('type', 'video')
      searchUrl.searchParams.set('channelId', member.channel_id_yt)
      searchUrl.searchParams.set('key', YOUTUBE_API_KEY)

      const response = await fetch(searchUrl.toString())

      if (!response.ok) {
        const errorText = await response.text()
        errors.push(
          `Member ${member.name_zh}: HTTP ${response.status} - ${errorText}`
        )
        continue
      }

      const data: YouTubeSearchResponse = await response.json()
      const isLive = data.items && data.items.length > 0

      // Update member status
      const { error: updateError } = await supabaseServer
        .from('members')
        .update({
          is_live: isLive,
          last_live_at: isLive ? new Date().toISOString() : null,
        })
        .eq('id', member.id)

      if (updateError) {
        errors.push(`Member ${member.name_zh}: ${updateError.message}`)
      } else {
        totalUpdated++
      }
    } catch (error) {
      errors.push(
        `Member ${member.name_zh}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  return {
    message: 'Live status updated successfully',
    updated: totalUpdated,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    // Update clips
    const clipsResult = await updateClips()

    // Update live status
    const liveResult = await updateLiveStatus()

    return NextResponse.json({
      success: true,
      clips: clipsResult,
      liveStatus: liveResult,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

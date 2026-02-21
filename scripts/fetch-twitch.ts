/**
 * fetch-twitch.ts
 * 
 * Twitch 平台抓取腳本
 * 
 * 功能：
 * 1. 檢查成員是否在 Twitch 直播
 * 2. 抓取 Twitch 直播存檔 (Videos)
 * 3. 更新資料庫的 is_live 狀態和 videos 表
 * 
 * 使用方法：
 * npx tsx scripts/fetch-twitch.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// 載入 .env.local 檔案
config({ path: resolve(process.cwd(), '.env.local') })

// 環境變數檢查
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const twitchClientId = process.env.TWITCH_CLIENT_ID
const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ 錯誤：缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 環境變數')
  process.exit(1)
}

if (!twitchClientId || !twitchClientSecret) {
  console.error('❌ 錯誤：缺少 TWITCH_CLIENT_ID 或 TWITCH_CLIENT_SECRET 環境變數')
  process.exit(1)
}

// 初始化 Supabase Client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const TWITCH_API_BASE = 'https://api.twitch.tv/helix'

interface Member {
  id: string
  name_jp: string
  name_zh: string
  twitch_user_id: string | null
  channel_id_twitch: string | null
}

interface TwitchStream {
  id: string
  user_id: string
  user_name: string
  game_id: string
  game_name: string
  type: string
  title: string
  viewer_count: number
  started_at: string
  thumbnail_url: string
  tag_ids: string[]
}

interface TwitchVideo {
  id: string
  stream_id: string | null
  user_id: string
  user_login: string
  user_name: string
  title: string
  description: string
  created_at: string
  published_at: string
  url: string
  thumbnail_url: string
  viewable: string
  view_count: number
  language: string
  type: string
  duration: string
}

/**
 * 獲取 Twitch Access Token
 */
async function getTwitchAccessToken(): Promise<string | null> {
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: twitchClientId!,
        client_secret: twitchClientSecret!,
        grant_type: 'client_credentials',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Twitch Token 獲取失敗:', errorText)
      return null
    }

    const data: any = await response.json()
    return data.access_token
  } catch (error) {
    console.error('❌ Twitch Token 獲取錯誤:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * 檢查成員是否在直播
 */
async function checkTwitchLive(
  userId: string,
  token: string
): Promise<{ isLive: boolean; stream: TwitchStream | null }> {
  try {
    const url = new URL(`${TWITCH_API_BASE}/streams`)
    url.searchParams.set('user_id', userId)

    const response = await fetch(url.toString(), {
      headers: {
        'Client-ID': twitchClientId!,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`  ⚠️ 查詢直播狀態失敗:`, errorText)
      return { isLive: false, stream: null }
    }

    const data: any = await response.json()
    if (data.data && data.data.length > 0) {
      return { isLive: true, stream: data.data[0] as TwitchStream }
    }

    return { isLive: false, stream: null }
  } catch (error) {
    console.error(`  ⚠️ 查詢直播狀態錯誤:`, error instanceof Error ? error.message : error)
    return { isLive: false, stream: null }
  }
}

/**
 * 獲取成員的 Twitch 直播存檔
 */
async function fetchTwitchVideos(
  userId: string,
  token: string,
  limit: number = 50
): Promise<TwitchVideo[]> {
  try {
    const url = new URL(`${TWITCH_API_BASE}/videos`)
    url.searchParams.set('user_id', userId)
    url.searchParams.set('type', 'archive') // 只抓取存檔
    url.searchParams.set('first', limit.toString())

    const response = await fetch(url.toString(), {
      headers: {
        'Client-ID': twitchClientId!,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`  ⚠️ 查詢存檔失敗:`, errorText)
      return []
    }

    const data: any = await response.json()
    return (data.data || []) as TwitchVideo[]
  } catch (error) {
    console.error(`  ⚠️ 查詢存檔錯誤:`, error instanceof Error ? error.message : error)
    return []
  }
}

/**
 * 處理縮圖 URL（替換 %{width}x%{height}）
 */
function processThumbnailUrl(url: string, width: number = 1280, height: number = 720): string {
  return url.replace('%{width}', width.toString()).replace('%{height}', height.toString())
}

/**
 * 解析時長字串 (例如 "1h30m15s" -> 秒數)
 */
function parseDuration(duration: string): number {
  let totalSeconds = 0

  // 匹配小時
  const hoursMatch = duration.match(/(\d+)h/)
  if (hoursMatch) {
    totalSeconds += parseInt(hoursMatch[1], 10) * 3600
  }

  // 匹配分鐘
  const minutesMatch = duration.match(/(\d+)m/)
  if (minutesMatch) {
    totalSeconds += parseInt(minutesMatch[1], 10) * 60
  }

  // 匹配秒數
  const secondsMatch = duration.match(/(\d+)s/)
  if (secondsMatch) {
    totalSeconds += parseInt(secondsMatch[1], 10)
  }

  return totalSeconds
}

/**
 * 處理單一成員
 */
async function processMember(member: Member, index: number, total: number, token: string) {
  console.log(`\n[${index + 1}/${total}] 👤 ${member.name_jp} (${member.name_zh})`)

  if (!member.twitch_user_id) {
    console.log(`  ⏭️  跳過：沒有 twitch_user_id`)
    return
  }

  try {
    // 1. 檢查是否在直播
    console.log(`  🔍 檢查直播狀態...`)
    const { isLive, stream } = await checkTwitchLive(member.twitch_user_id, token)

    if (isLive && stream) {
      console.log(`  🟣 Twitch LIVE: ${stream.title}`)
      console.log(`     觀看人數: ${stream.viewer_count.toLocaleString()}`)

      // 更新 members 表的直播狀態
      const thumbnailUrl = processThumbnailUrl(stream.thumbnail_url)
      await supabase.from('members').update({
        is_live: true,
        live_status: 'live',
        live_video_id: stream.id,
        live_title: stream.title,
        live_thumbnail: thumbnailUrl,
        last_live_at: new Date().toISOString(),
      }).eq('id', member.id)

      // 寫入 videos 表（作為正在直播的影片）
      // 注意：使用 stream.id 作為 id（Twitch ID 是數字字串，不會與 YouTube ID 衝突）
      await supabase.from('videos').upsert({
        id: stream.id, // Twitch stream ID (數字字串)
        member_id: member.id,
        clipper_id: null,
        title: stream.title,
        thumbnail_url: thumbnailUrl,
        published_at: stream.started_at,
        view_count: stream.viewer_count,
        video_type: 'live',
        duration_sec: null, // 直播中，時長未知
        platform: 'twitch',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    } else {
      // 沒有直播，更新狀態為 none
      await supabase.from('members').update({
        is_live: false,
        live_status: 'none',
        live_video_id: null,
        live_title: null,
        live_thumbnail: null,
      }).eq('id', member.id)
      console.log(`  ⚪ 目前沒有直播`)
    }

    // 2. 抓取直播存檔
    console.log(`  📹 抓取直播存檔...`)
    const videos = await fetchTwitchVideos(member.twitch_user_id, token, 50)

    if (videos.length === 0) {
      console.log(`  ⚠️  沒有找到存檔`)
      return
    }

    console.log(`  ✅ 找到 ${videos.length} 個存檔`)

    // 3. 批次寫入 videos 表
    const videosToInsert = videos.map((video) => ({
      id: video.id, // Twitch video ID (數字字串，不會與 YouTube ID 衝突)
      member_id: member.id,
      clipper_id: null,
      title: video.title || '無標題',
      thumbnail_url: processThumbnailUrl(video.thumbnail_url),
      published_at: video.published_at || video.created_at,
      view_count: video.view_count || 0,
      video_type: 'archive' as const,
      duration_sec: parseDuration(video.duration),
      platform: 'twitch' as const,
      updated_at: new Date().toISOString(),
    }))

    // 批次寫入（每 50 筆）
    const BATCH_SIZE = 50
    for (let i = 0; i < videosToInsert.length; i += BATCH_SIZE) {
      const batch = videosToInsert.slice(i, i + BATCH_SIZE)
      const { error: upsertError } = await supabase.from('videos').upsert(batch, {
        onConflict: 'id',
      })

      if (upsertError) {
        console.error(`  ⚠️ 批次寫入失敗 (第 ${i / BATCH_SIZE + 1} 批):`, upsertError.message)
      }
    }

    console.log(`  💾 已儲存 ${videosToInsert.length} 個存檔`)
  } catch (error) {
    console.error(`  ❌ 處理失敗:`, error instanceof Error ? error.message : error)
  }
}

/**
 * 主函數
 */
async function fetchTwitch() {
  console.log('🚀 開始 Twitch 平台抓取...\n')
  console.log('='.repeat(60))

  try {
    // 1. 獲取 Twitch Access Token
    console.log('🔑 正在獲取 Twitch Access Token...')
    const token = await getTwitchAccessToken()
    if (!token) {
      console.error('❌ 無法獲取 Twitch Access Token，結束執行。')
      process.exit(1)
    }
    console.log('✅ Token 獲取成功\n')

    // 2. 從 Supabase 取得所有有 twitch_user_id 的成員
    console.log('📋 正在取得成員列表...')
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, name_jp, name_zh, twitch_user_id, channel_id_twitch')
      .not('twitch_user_id', 'is', null)

    if (membersError) {
      console.error('❌ 取得成員列表失敗:', membersError.message)
      process.exit(1)
    }

    if (!members || members.length === 0) {
      console.log('⚠️ 沒有找到任何有 Twitch User ID 的成員，結束執行。')
      return
    }

    console.log(`✅ 找到 ${members.length} 個成員\n`)

    // 3. 遍歷每個成員
    for (let i = 0; i < members.length; i++) {
      await processMember(members[i] as Member, i + 1, members.length, token)

      // 延遲避免 API 限流
      if (i < members.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    // 4. 總結
    console.log('\n' + '='.repeat(60))
    console.log('✨ Twitch 抓取完成！')
  } catch (error) {
    console.error('\n❌ 執行失敗:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// 執行主函數
fetchTwitch()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 未預期的錯誤:', error)
    process.exit(1)
  })

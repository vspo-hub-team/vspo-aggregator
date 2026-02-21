/**
 * update-members.ts
 * 
 * 腳本功能：從 YouTube API 獲取成員頭像並更新到 Supabase
 * 同時偵測直播狀態（live 和 upcoming）
 * 
 * 使用方法：
 *   npm run update-members
 *   或
 *   npx tsx scripts/update-members.ts
 * 
 * 環境變數需求：
 *   SUPABASE_URL - Supabase 專案 URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase Service Role Key (用於寫入權限)
 *   YOUTUBE_API_KEY - YouTube Data API v3 金鑰
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// 載入 .env.local 檔案
config({ path: resolve(process.cwd(), '.env.local') })

// 環境變數檢查
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const youtubeApiKey = process.env.YOUTUBE_API_KEY

if (!supabaseUrl) {
  console.error('❌ 錯誤：缺少 SUPABASE_URL 環境變數')
  process.exit(1)
}

if (!supabaseServiceRoleKey) {
  console.error('❌ 錯誤：缺少 SUPABASE_SERVICE_ROLE_KEY 環境變數')
  process.exit(1)
}

if (!youtubeApiKey) {
  console.error('❌ 錯誤：缺少 YOUTUBE_API_KEY 環境變數')
  process.exit(1)
}

// 初始化 Supabase Client (使用 Service Role Key 以獲得寫入權限)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// YouTube API 基礎 URL
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

interface YouTubeChannelResponse {
  items: Array<{
    id: string
    snippet: {
      thumbnails: {
        high: {
          url: string
        }
      }
    }
  }>
}

interface YouTubeSearchResponse {
  items: Array<{
    id: {
      videoId: string
    }
    snippet: {
      title: string
      thumbnails: {
        high: {
          url: string
        }
      }
      liveBroadcastContent: 'live' | 'upcoming' | 'none'
    }
  }>
}

interface Member {
  id: string
  name_jp: string
  name_zh: string
  channel_id_yt: string | null
}

/**
 * 從 YouTube API 獲取頻道頭像
 */
async function fetchChannelAvatar(channelId: string): Promise<string | null> {
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/channels`)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('id', channelId)
    url.searchParams.set('key', youtubeApiKey!)

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`  ⚠️  API 錯誤 (${response.status}): ${errorText}`)
      return null
    }

    const data: YouTubeChannelResponse = await response.json()

    if (!data.items || data.items.length === 0) {
      console.error(`  ⚠️  找不到頻道資料`)
      return null
    }

    const avatarUrl = data.items[0].snippet.thumbnails.high.url
    return avatarUrl
  } catch (error) {
    console.error(`  ❌ 獲取頭像失敗:`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * 偵測直播狀態（live 或 upcoming）
 */
async function detectLiveStatus(channelId: string): Promise<{
  isLive: boolean
  videoId: string | null
  title: string | null
  thumbnail: string | null
}> {
  try {
    // 搜尋 live 和 upcoming 的影片
    const url = new URL(`${YOUTUBE_API_BASE}/search`)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('channelId', channelId)
    url.searchParams.set('eventType', 'live') // 這會同時包含 live 和 upcoming
    url.searchParams.set('type', 'video')
    url.searchParams.set('maxResults', '1')
    url.searchParams.set('key', youtubeApiKey!)

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`  ⚠️  直播狀態 API 錯誤 (${response.status}): ${errorText}`)
      return { isLive: false, videoId: null, title: null, thumbnail: null }
    }

    const data: YouTubeSearchResponse = await response.json()

    if (!data.items || data.items.length === 0) {
      return { isLive: false, videoId: null, title: null, thumbnail: null }
    }

    const item = data.items[0]
    const isLive = item.snippet.liveBroadcastContent === 'live' || item.snippet.liveBroadcastContent === 'upcoming'

    return {
      isLive,
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high.url,
    }
  } catch (error) {
    console.error(`  ❌ 偵測直播狀態失敗:`, error instanceof Error ? error.message : error)
    return { isLive: false, videoId: null, title: null, thumbnail: null }
  }
}

/**
 * 批量更新成員頭像和直播狀態
 */
async function updateMembersAvatars() {
  console.log('🚀 開始更新成員資料...\n')

  // 步驟 1: 從 Supabase 獲取所有成員
  console.log('📥 正在從 Supabase 獲取成員資料...')
  const { data: members, error: fetchError } = await supabase
    .from('members')
    .select('id, name_jp, name_zh, channel_id_yt')
    .not('channel_id_yt', 'is', null)

  if (fetchError) {
    console.error('❌ 獲取成員資料失敗:', fetchError.message)
    process.exit(1)
  }

  if (!members || members.length === 0) {
    console.log('⚠️  沒有找到任何成員資料')
    return
  }

  console.log(`✅ 找到 ${members.length} 位成員\n`)

  // 步驟 2: 批量處理每個成員
  let successCount = 0
  let failCount = 0
  let avatarUpdatedCount = 0
  let liveUpdatedCount = 0

  for (let i = 0; i < members.length; i++) {
    const member = members[i] as Member
    const progress = `[${i + 1}/${members.length}]`

    if (!member.channel_id_yt) {
      console.log(`${progress} ⏭️  跳過 ${member.name_zh} (${member.name_jp}) - 沒有 YouTube 頻道 ID`)
      failCount++
      continue
    }

    console.log(`${progress} 🔍 處理 ${member.name_zh} (${member.name_jp})...`)

    // 步驟 3: 從 YouTube API 獲取頭像
    const avatarUrl = await fetchChannelAvatar(member.channel_id_yt)

    // 步驟 4: 偵測直播狀態
    const liveStatus = await detectLiveStatus(member.channel_id_yt)

    // 步驟 5: 準備更新資料
    const updateData: {
      avatar_url?: string | null
      is_live: boolean
      live_video_id: string | null
      live_title: string | null
      live_thumbnail: string | null
      last_live_at?: string | null
    } = {
      is_live: liveStatus.isLive,
      live_video_id: liveStatus.videoId,
      live_title: liveStatus.title,
      live_thumbnail: liveStatus.thumbnail,
    }

    // 如果有頭像，加入更新
    if (avatarUrl) {
      updateData.avatar_url = avatarUrl
      avatarUpdatedCount++
    }

    // 如果直播中，更新 last_live_at
    if (liveStatus.isLive) {
      updateData.last_live_at = new Date().toISOString()
      liveUpdatedCount++
      console.log(`     📺 直播狀態: ${liveStatus.videoId ? 'LIVE' : 'UPCOMING'}`)
      if (liveStatus.title) {
        console.log(`     📝 標題: ${liveStatus.title.substring(0, 50)}...`)
      }
    }

    // 步驟 6: 更新 Supabase
    const { error: updateError } = await supabase
      .from('members')
      .update(updateData)
      .eq('id', member.id)

    if (updateError) {
      console.log(`     ❌ 更新失敗: ${updateError.message}`)
      failCount++
    } else {
      console.log(`     ✅ 更新成功`)
      successCount++
    }

    // 避免 API 配額限制，每次請求間隔 200ms
    if (i < members.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    console.log('')
  }

  // 步驟 7: 顯示總結
  console.log('='.repeat(60))
  console.log('📊 更新總結')
  console.log('='.repeat(60))
  console.log(`✅ 成功: ${successCount} 位成員`)
  console.log(`❌ 失敗: ${failCount} 位成員`)
  console.log(`📸 頭像更新: ${avatarUpdatedCount} 位成員`)
  console.log(`📺 直播狀態更新: ${liveUpdatedCount} 位成員`)
  console.log(`📝 總計: ${members.length} 位成員\n`)

  console.log('✨ 更新完成！')
}

// 執行腳本
updateMembersAvatars()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 腳本執行失敗:', error)
    process.exit(1)
  })

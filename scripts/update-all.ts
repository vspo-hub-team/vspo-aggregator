/**
 * update-all.ts
 * * 全能爬蟲腳本 v6 (Playlist 策略 - 低配額版)
 * * 功能：
 * 1. [優化] 成員直播偵測改用 Playlist 策略 (channels -> playlistItems -> videos，約3點配額)
 * 2. [保留] 烤肉頻道繼續使用 RSS 輕量化策略 (省配額)
 * 3. [保留] 自動清理髒資料 & 訂閱數更新
 * 4. [修正] 顯示日文名稱
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import RSSParser from 'rss-parser'

// 載入 .env.local 檔案
config({ path: resolve(process.cwd(), '.env.local') })

// 環境變數檢查
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const youtubeApiKey = process.env.YOUTUBE_API_KEY
const twitchClientId = process.env.TWITCH_CLIENT_ID
const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ 錯誤：缺少 SUPABASE_URL 環境變數')
  process.exit(1)
}

if (!youtubeApiKey) {
  console.error('❌ 錯誤：缺少 YOUTUBE_API_KEY 環境變數')
  process.exit(1)
}

// 初始化 Supabase Client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
const parser = new RSSParser()

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const TWITCH_API_BASE = 'https://api.twitch.tv/helix'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

interface Member {
  id: string
  name_jp: string
  name_zh: string
  channel_id_yt: string | null
  channel_id_twitch: string | null
}

interface Clipper {
  id: number
  name: string
  lang: 'ja' | 'zh'
  avatar_url: string | null
  channel_id: string
  subscriber_count?: number
}

interface YouTubeVideoResponse {
  items: Array<{
    id: string
    snippet: {
      title: string
      description?: string
      publishedAt: string
      thumbnails: {
        high: { url: string }
      }
      liveBroadcastContent: 'live' | 'upcoming' | 'none'
    }
    statistics?: {
      viewCount: string
    }
    contentDetails?: {
      duration: string
    }
    liveStreamingDetails?: {
      scheduledStartTime?: string
      actualStartTime?: string
      actualEndTime?: string
      concurrentViewers?: string
    }
  }>
}

// --- Helper Functions ---

async function getTwitchAccessToken(): Promise<string | null> {
  if (!twitchClientId || !twitchClientSecret) return null
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: twitchClientId,
        client_secret: twitchClientSecret,
        grant_type: 'client_credentials',
      }),
    })
    if (!response.ok) return null
    const data: any = await response.json()
    return data.access_token
  } catch {
    return null
  }
}

async function checkTwitchLive(channelId: string, token: string) {
  try {
    const url = new URL(`${TWITCH_API_BASE}/streams`)
    url.searchParams.set('user_id', channelId)
    const res = await fetch(url.toString(), {
      headers: { 'Client-ID': twitchClientId!, Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.data?.length > 0) {
      const s = data.data[0]
      return { isLive: s.type === 'live', title: s.title, thumbnail: s.thumbnail_url?.replace('{width}x{height}', '1280x720') }
    }
    return { isLive: false, title: null, thumbnail: null }
  } catch {
    return null
  }
}

function extractVideoId(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  return match ? match[1] : url
}

function parseDuration(duration: string): number | null {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return null
  return (parseInt(match[1] || '0') * 3600) + (parseInt(match[2] || '0') * 60) + parseInt(match[3] || '0')
}

function isValidUpcoming(time: string | undefined): boolean {
  if (!time) return false
  const t = new Date(time).getTime()
  const now = Date.now()
  return t > now && t <= now + SEVEN_DAYS_MS
}

// --- Main Fetching Logic ---

async function fetchRSSItems(channelId: string): Promise<any[]> {
  try {
    const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)
    return feed.items || []
  } catch {
    return []
  }
}

async function fetchChannelData(channelId: string) {
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/channels`)
    url.searchParams.set('part', 'snippet,statistics,contentDetails')
    url.searchParams.set('id', channelId)
    url.searchParams.set('key', youtubeApiKey!)
    
    const res = await fetch(url.toString())
    const data = await res.json()
    
    if (data.items?.length > 0) {
      const ch = data.items[0]
      const avatarUrl = ch.snippet?.thumbnails?.high?.url || ch.snippet?.thumbnails?.default?.url || null
      const subscriberCount = ch.statistics?.subscriberCount && !ch.statistics.hiddenSubscriberCount 
        ? parseInt(ch.statistics.subscriberCount, 10) 
        : null
      const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads || null
      return { avatarUrl, subscriberCount, uploadsPlaylistId }
    }
    return { avatarUrl: null, subscriberCount: null, uploadsPlaylistId: null }
  } catch (e) {
    console.error(`❌ 頻道資料失敗 ${channelId}:`, e)
    return { avatarUrl: null, subscriberCount: null, uploadsPlaylistId: null }
  }
}

/**
 * 從 Playlist 取得最新影片 ID 列表
 */
async function fetchPlaylistItems(playlistId: string): Promise<string[]> {
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('maxResults', '5')
    url.searchParams.set('key', youtubeApiKey!)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const errorData = await res.json()
      console.error(`  ❌ PlaylistItems API 錯誤:`, errorData.error?.message)
      return []
    }

    const data = await res.json()
    if (data.items && data.items.length > 0) {
      return data.items.map((item: any) => item.contentDetails.videoId).filter((id: string) => id)
    }
    return []
  } catch (e) {
    console.error(`  ❌ 取得 Playlist Items 失敗:`, e)
    return []
  }
}

async function fetchVideoDetails(videoIds: string[]): Promise<YouTubeVideoResponse['items']> {
  if (!videoIds.length) return []
  const allVideos: YouTubeVideoResponse['items'] = []
  const batchSize = 50
  
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const ids = videoIds.slice(i, i + batchSize).join(',')
    const url = new URL(`${YOUTUBE_API_BASE}/videos`)
    url.searchParams.set('part', 'snippet,statistics,contentDetails,liveStreamingDetails')
    url.searchParams.set('id', ids)
    url.searchParams.set('key', youtubeApiKey!)
    
    try {
      const res = await fetch(url.toString())
      if (!res.ok) {
        const errorData = await res.json()
        console.error(`  ❌ Videos API 錯誤:`, errorData.error?.message)
        continue
      }
      const data = await res.json()
      if (data.items) allVideos.push(...data.items)
    } catch (e) {
      console.error('❌ 影片詳情失敗:', e)
    }
  }
  return allVideos
}

// --- Process Functions ---

async function processMember(member: Member, idx: number, total: number, twitchToken: string | null) {
  console.log(`[${idx + 1}/${total}] 👤 ${member.name_jp}...`)
  
  if (!member.channel_id_yt) return

  // 1. 取得頻道資料（包含 uploadsPlaylistId）
  const { avatarUrl, uploadsPlaylistId } = await fetchChannelData(member.channel_id_yt)
  
  // 更新成員頭像
  if (avatarUrl) {
    await supabase.from('members').update({ avatar_url: avatarUrl }).eq('id', member.id)
  }

  // 如果沒有 uploadsPlaylistId，無法繼續
  if (!uploadsPlaylistId) {
    console.warn(`  ⚠️ 無法取得 uploadsPlaylistId`)
    return
  }

  // 2. 從 Playlist 取得最新影片 ID 列表
  const videoIds = await fetchPlaylistItems(uploadsPlaylistId)
  if (videoIds.length === 0) {
    console.log(`  ⚠️ 沒有找到影片`)
    await supabase.from('members').update({ live_status: 'none', is_live: false }).eq('id', member.id)
    return
  }

  // 3. 取得影片詳情
  const videos = await fetchVideoDetails(videoIds)

  // 4. 檢查直播狀態
  let liveV = videos.find(v => v.snippet.liveBroadcastContent === 'live')
  let upcomingV = videos.find(v => 
    v.snippet.liveBroadcastContent === 'upcoming' && 
    isValidUpcoming(v.liveStreamingDetails?.scheduledStartTime)
  )

  // 5. 更新資料庫
  if (liveV) {
    console.log(`  🔴 YouTube LIVE: ${liveV.snippet.title}`)
    await supabase.from('members').update({
      live_status: 'live',
      is_live: true,
      live_video_id: liveV.id,
      live_title: liveV.snippet.title,
      live_thumbnail: liveV.snippet.thumbnails.high.url,
      last_live_at: new Date().toISOString()
    }).eq('id', member.id)
  } else if (upcomingV) {
    console.log(`  ⏰ 待機: ${upcomingV.snippet.title}`)
    await supabase.from('members').update({
      live_status: 'upcoming',
      is_live: false,
      live_video_id: upcomingV.id,
      live_title: upcomingV.snippet.title,
      live_thumbnail: upcomingV.snippet.thumbnails.high.url,
      live_start_time: upcomingV.liveStreamingDetails?.scheduledStartTime
    }).eq('id', member.id)
  } else {
    await supabase.from('members').update({
      live_status: 'none',
      is_live: false
    }).eq('id', member.id)
  }

  // Twitch 檢查（如果 YouTube 沒有直播）
  if (!liveV && !upcomingV && member.channel_id_twitch && twitchToken) {
    const twitchStatus = await checkTwitchLive(member.channel_id_twitch, twitchToken)
    if (twitchStatus?.isLive) {
      console.log(`  🟣 Twitch LIVE: ${twitchStatus.title}`)
      await supabase.from('members').update({
        live_status: 'live', is_live: true, live_video_id: null,
        live_title: twitchStatus.title, live_thumbnail: twitchStatus.thumbnail,
        last_live_at: new Date().toISOString()
      }).eq('id', member.id)
    }
  }
}

async function processClipper(clipper: Clipper, idx: number, total: number) {
  console.log(`[${idx + 1}/${total}] 🎬 ${clipper.name}...`)
  
  // 1. 清理已存在的髒資料（以 yt:video: 開頭的錯誤 ID）
  const { error: deleteError } = await supabase
    .from('videos')
    .delete()
    .eq('clipper_id', clipper.id)
    .like('id', 'yt:video:%')
  
  if (deleteError) {
    console.warn(`  ⚠️ 清理髒資料時發生錯誤: ${deleteError.message}`)
  }

  // 2. 從 RSS 抓取影片資料
  const rssItems = await fetchRSSItems(clipper.channel_id)
  if (rssItems.length === 0) {
    console.log(`  ⚠️ 無影片`)
    return
  }

  // 3. 提取所有影片 ID，並過濾出資料庫中還沒有的新影片
  const allVideoIds: string[] = []
  const rssVideoMap = new Map<string, { title: string; publishedAt: string; thumbnailUrl: string }>()
  
  for (const item of rssItems) {
    const rawId = item.id || item.link || ''
    let videoId = extractVideoId(rawId)
    
    // 清洗 ID 前綴
    if (videoId.startsWith('yt:video:')) {
      videoId = videoId.replace('yt:video:', '')
    }
    
    if (!videoId) {
      console.warn(`  ⚠️ 無法提取影片 ID: ${item.link || item.id}`)
      continue
    }

    let publishedAt: string | null = null
    if (item.pubDate) {
      try {
        publishedAt = new Date(item.pubDate).toISOString()
      } catch {
        publishedAt = new Date().toISOString()
      }
    } else {
      publishedAt = new Date().toISOString()
    }

    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    
    allVideoIds.push(videoId)
    rssVideoMap.set(videoId, {
      title: item.title || '無標題',
      publishedAt,
      thumbnailUrl
    })
  }

  // 4. 檢查哪些影片是新的（資料庫中還沒有）
  const { data: existingVideos } = await supabase
    .from('videos')
    .select('id')
    .in('id', allVideoIds)
  
  const existingIds = new Set(existingVideos?.map(v => v.id) || [])
  const newVideoIds = allVideoIds.filter(id => !existingIds.has(id))

  if (newVideoIds.length === 0) {
    console.log(`  ✅ 沒有新影片`)
    return
  }

  console.log(`  📋 RSS 找到 ${allVideoIds.length} 部影片，其中 ${newVideoIds.length} 部是新影片`)

  // 5. 將新影片 ID 每 50 個切成一個批次，呼叫 YouTube API 取得統計資料
  const BATCH_SIZE = 50
  let totalSaved = 0
  
  for (let i = 0; i < newVideoIds.length; i += BATCH_SIZE) {
    const batchIds = newVideoIds.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(newVideoIds.length / BATCH_SIZE)
    
    console.log(`  🔍 [${batchNumber}/${totalBatches}] 正在查詢 ${batchIds.length} 部新影片的統計資料...`)
    
    try {
      // 呼叫 YouTube API videos.list 取得統計資料和時長
      const url = new URL(`${YOUTUBE_API_BASE}/videos`)
      url.searchParams.set('part', 'statistics,contentDetails,snippet')
      url.searchParams.set('id', batchIds.join(','))
      url.searchParams.set('key', youtubeApiKey!)
      
      const response = await fetch(url.toString())
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error(`  ❌ YouTube API 請求失敗:`, errorData.error?.message || JSON.stringify(errorData))
        
        // 如果配額用盡，停止處理
        if (response.status === 403 || response.status === 429) {
          console.error(`  ⚠️ API 配額可能已用盡，停止處理新影片`)
          break
        }
        
        // 其他錯誤：使用 RSS 資料儲存（沒有統計資料）
        console.warn(`  ⚠️ API 錯誤，使用 RSS 資料儲存（無統計資料）`)
        for (const videoId of batchIds) {
          const rssData = rssVideoMap.get(videoId)
          if (!rssData) continue
          
          await supabase.from('videos').upsert({
            id: videoId,
            clipper_id: clipper.id,
            member_id: null,
            platform: 'youtube',
            title: rssData.title,
            thumbnail_url: rssData.thumbnailUrl,
            published_at: rssData.publishedAt,
            view_count: 0,
            video_type: 'video',
            duration_sec: 0,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })
          totalSaved++
        }
        continue
      }

      const data = await response.json()
      const apiVideos = data.items || []
      
      console.log(`  📡 API 回傳 ${apiVideos.length} 筆資料`)

      // 6. 結合 RSS 資料與 API 資料，寫入資料庫
      const foundIds = new Set<string>()
      
      for (const apiVideo of apiVideos) {
        foundIds.add(apiVideo.id)
        
        const rssData = rssVideoMap.get(apiVideo.id)
        const viewCount = parseInt(apiVideo.statistics?.viewCount || '0', 10)
        const durationSec = parseDuration(apiVideo.contentDetails?.duration || '')
        
        // 優先使用 API 的縮圖，如果沒有則使用 RSS 的縮圖
        const thumbnailUrl = apiVideo.snippet?.thumbnails?.high?.url || 
                            apiVideo.snippet?.thumbnails?.default?.url || 
                            rssData?.thumbnailUrl || 
                            `https://img.youtube.com/vi/${apiVideo.id}/hqdefault.jpg`
        
        // 優先使用 API 的標題，如果沒有則使用 RSS 的標題
        const title = apiVideo.snippet?.title || rssData?.title || '無標題'
        
        // 優先使用 API 的發布時間，如果沒有則使用 RSS 的發布時間
        let publishedAt = rssData?.publishedAt || new Date().toISOString()
        if (apiVideo.snippet?.publishedAt) {
          try {
            publishedAt = new Date(apiVideo.snippet.publishedAt).toISOString()
          } catch {
            // 如果解析失敗，使用 RSS 的時間
          }
        }
        
        await supabase.from('videos').upsert({
          id: apiVideo.id,
          clipper_id: clipper.id,
          member_id: null,
          platform: 'youtube',
          title,
          thumbnail_url: thumbnailUrl,
          published_at: publishedAt,
          view_count: viewCount,
          video_type: 'video',
          duration_sec: durationSec,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        totalSaved++
      }

      // 處理 API 沒回傳的影片（可能已被刪除或設為私人）
      const missingIds = batchIds.filter(id => !foundIds.has(id))
      if (missingIds.length > 0) {
        console.warn(`  ⚠️ 有 ${missingIds.length} 部影片在 API 中找不到，使用 RSS 資料儲存`)
        for (const videoId of missingIds) {
          const rssData = rssVideoMap.get(videoId)
          if (!rssData) continue
          
          await supabase.from('videos').upsert({
            id: videoId,
            clipper_id: clipper.id,
            member_id: null,
            platform: 'youtube',
            title: rssData.title,
            thumbnail_url: rssData.thumbnailUrl,
            published_at: rssData.publishedAt,
            view_count: 0,
            video_type: 'video',
            duration_sec: 0,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })
          totalSaved++
        }
      }

      // 批次間延遲，避免 Rate Limit
      if (i + BATCH_SIZE < newVideoIds.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    } catch (err) {
      console.error(`  ❌ 處理批次 ${batchNumber} 時發生錯誤:`, err)
      // 發生錯誤時，使用 RSS 資料儲存
      for (const videoId of batchIds) {
        const rssData = rssVideoMap.get(videoId)
        if (!rssData) continue
        
        await supabase.from('videos').upsert({
          id: videoId,
          clipper_id: clipper.id,
          member_id: null,
          platform: 'youtube',
          title: rssData.title,
          thumbnail_url: rssData.thumbnailUrl,
          published_at: rssData.publishedAt,
          view_count: 0,
          video_type: 'video',
          duration_sec: 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        totalSaved++
      }
    }
  }
  
  console.log(`  ✅ 已儲存 ${totalSaved} 部新影片（包含完整統計資料）`)
}

// --- Main ---

async function updateAll() {
  console.log('🚀 開始更新 (v6: Playlist 策略 - 低配額版)...')
  let twitchToken = null
  if (twitchClientId && twitchClientSecret) twitchToken = await getTwitchAccessToken()

  const { data: members } = await supabase.from('members').select('*')
  
  // 處理成員
  if (members) {
    console.log('\n=== 成員狀態更新 ===')
    for (let i = 0; i < members.length; i++) {
      await processMember(members[i], i, members.length, twitchToken)
      if (i < members.length - 1) await new Promise(r => setTimeout(r, 200))
    }
  }

  // 處理烤肉
  const { data: clippers } = await supabase.from('clippers').select('*')
  if (clippers) {
    console.log('\n=== 烤肉頻道更新 ===')
    for (let i = 0; i < clippers.length; i++) {
      await processClipper(clippers[i] as Clipper, i, clippers.length)
      if (i < clippers.length - 1) await new Promise(r => setTimeout(r, 100))
    }
  }
  console.log('\n✨ 全部完成！')
}

updateAll().catch(e => { console.error(e); process.exit(1) })

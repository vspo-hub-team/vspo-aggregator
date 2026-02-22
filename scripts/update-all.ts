/**
 * update-all.ts
 * * 全能爬蟲腳本 v7 (Playlist 策略 + Fast 模式)
 * * 功能：
 * 1. [優化] 成員直播偵測改用 Playlist 策略 (channels -> playlistItems -> videos，約3點配額)
 * 2. [新增] --fast 模式：跳過 playlistItems API，僅執行 RSS 突發雷達 + 狀態更新
 * 3. [新增] 擷取即時觀看人數 (concurrent_viewers)
 * 4. [保留] 烤肉頻道繼續使用 RSS 輕量化策略 (省配額)
 * 5. [保留] 自動清理髒資料 & 訂閱數更新
 * 6. [修正] 顯示日文名稱
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import RSSParser from 'rss-parser'

// 載入 .env.local 檔案
config({ path: resolve(process.cwd(), '.env.local') })

// 檢查是否為 fast 模式
const isFastMode = process.argv.includes('--fast')

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
  twitch_user_id: string | null
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
  console.log('[Twitch] 正在獲取 Access Token...')
  
  if (!twitchClientId || !twitchClientSecret) {
    console.log('[Twitch] ❌ 失敗：缺少 TWITCH_CLIENT_ID 或 TWITCH_CLIENT_SECRET 環境變數')
    return null
  }
  
  try {
    const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${twitchClientId}&client_secret=${twitchClientSecret}&grant_type=client_credentials`
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log(`[Twitch] ❌ 獲取 Access Token 失敗: HTTP ${response.status} - ${errorText}`)
      return null
    }
    
    const data: any = await response.json()
    if (data.access_token) {
      console.log('[Twitch] ✅ 成功獲取 Access Token')
      return data.access_token
    } else {
      console.log(`[Twitch] ❌ 獲取 Access Token 失敗: 回應中沒有 access_token`, data)
      return null
    }
  } catch (error) {
    console.log(`[Twitch] ❌ 獲取 Access Token 時發生錯誤:`, error instanceof Error ? error.message : error)
    return null
  }
}

async function checkTwitchLive(channelId: string, token: string, memberName?: string) {
  try {
    const url = new URL(`${TWITCH_API_BASE}/streams`)
    url.searchParams.set('user_id', channelId)
    
    const res = await fetch(url.toString(), {
      headers: { 
        'Client-ID': twitchClientId!, 
        'Authorization': `Bearer ${token}` 
      }
    })
    
    if (!res.ok) {
      const errorText = await res.text()
      console.log(`  [Twitch] ⚠️ 查詢直播狀態失敗 (user_id: ${channelId}): HTTP ${res.status} - ${errorText}`)
      return { isLive: false, title: null, thumbnail: null, viewerCount: 0 }
    }
    
    const data = await res.json()
    if (data.data?.length > 0) {
      const s = data.data[0]
      // 處理 Twitch 縮圖 URL（可能使用 {width}x{height} 或 %{width}x%{height} 格式）
      let thumbnail = s.thumbnail_url || null
      if (thumbnail) {
        thumbnail = thumbnail.replace('{width}x{height}', '1280x720')
          .replace('%{width}x%{height}', '1280x720')
      }
      // 提取觀看人數
      const viewerCount = s.viewer_count ? parseInt(s.viewer_count.toString(), 10) : 0
      const isLive = s.type === 'live'
      
      if (isLive && memberName) {
        console.log(`  [Twitch] ✅ ${memberName} 正在直播: ${s.title} (👁️ ${viewerCount.toLocaleString()} 人)`)
      }
      
      return { isLive, title: s.title, thumbnail, viewerCount }
    }
    
    if (memberName) {
      console.log(`  [Twitch] ⚪ ${memberName} 目前沒有直播`)
    }
    
    return { isLive: false, title: null, thumbnail: null, viewerCount: 0 }
  } catch (error) {
    console.log(`  [Twitch] ❌ 查詢直播狀態時發生錯誤:`, error instanceof Error ? error.message : error)
    return { isLive: false, title: null, thumbnail: null, viewerCount: 0 }
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

/**
 * 安全過濾邏輯：檢查影片是否符合 VSPO 相關（三道防線）
 * 只要符合任一條件就允許存入
 */
async function isVSPORelated(
  title: string,
  description: string | null | undefined,
  memberNames: { name_jp: string; name_zh: string }[]
): Promise<boolean> {
  const titleLower = title.toLowerCase()
  const descLower = (description || '').toLowerCase()
  const combinedText = `${titleLower} ${descLower}`

  // 防線 1: 包含官方授權碼字眼
  if (title.includes('許諾番号') || (description && description.includes('許諾番号'))) {
    return true
  }

  // 防線 2: 包含通用關鍵字（忽略大小寫）
  const keywords = ['ぶいすぽ', 'ぶいすぽっ', 'vspo', 'VSPO']
  for (const keyword of keywords) {
    if (combinedText.includes(keyword.toLowerCase())) {
      return true
    }
  }

  // 防線 3: 包含資料庫中任一位成員的日文或中文名字
  for (const member of memberNames) {
    if (combinedText.includes(member.name_jp.toLowerCase()) || 
        combinedText.includes(member.name_zh.toLowerCase())) {
      return true
    }
  }

  // 三個條件都不符合，判定為非相關影片
  return false
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
      const thumbnails = ch.snippet?.thumbnails as any
      const avatarUrl = thumbnails?.high?.url || thumbnails?.default?.url || null
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
async function fetchPlaylistItems(playlistId: string, maxResults: number = 20): Promise<string[]> {
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('maxResults', maxResults.toString())
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

async function processMember(member: Member, idx: number, total: number, twitchToken: string | null, isFast: boolean = false) {
  const modeLabel = isFast ? '⚡ [FAST]' : '📋 [FULL]'
  console.log(`[${idx + 1}/${total}] ${modeLabel} 👤 ${member.name_jp}...`)
  
  // 重要：即使沒有 YouTube channel，也要檢查 Twitch
  const hasYouTube = !!member.channel_id_yt
  const hasTwitch = !!member.twitch_user_id

  let allVideoIds: string[] = []
  let playlistVideoIds: string[] = []

  if (isFast) {
    // Fast 模式：跳過 playlistItems API，只執行 RSS 抓取
    if (hasYouTube) {
      console.log(`  ⚡ Fast 模式：跳過 playlistItems API，僅執行 RSS 突發雷達`)
      
      // 2.5. 從 RSS Feed 抓取最新影片 ID（零配額且無延遲）
      let rssVideoIds: string[] = []
      try {
        const rssResponse = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${member.channel_id_yt}`)
        if (rssResponse.ok) {
          const rssText = await rssResponse.text()
          const matches = [...rssText.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)]
          rssVideoIds = matches.map(m => m[1])
          if (rssVideoIds.length > 0) {
            console.log(`  📡 RSS 抓取到 ${rssVideoIds.length} 部影片（包含突擊開台）`)
          }
        }
      } catch (error) {
        console.log(`  ⚠️ [RSS] 獲取 ${member.name_jp} 的 RSS 失敗，略過。`)
      }
      
      allVideoIds = rssVideoIds
      
      // Fast 模式：檢查資料庫中現有的 upcoming/live 影片狀態更新
      const { data: existingLiveVideos } = await supabase
        .from('videos')
        .select('id')
        .eq('member_id', member.id)
        .in('video_type', ['live', 'upcoming'])
      
      if (existingLiveVideos && existingLiveVideos.length > 0) {
        const existingLiveIds = existingLiveVideos.map(v => v.id)
        allVideoIds = Array.from(new Set([...allVideoIds, ...existingLiveIds]))
        console.log(`  🔍 檢查 ${existingLiveIds.length} 部現有 live/upcoming 影片狀態`)
      }
    } else {
      console.log(`  ⚡ Fast 模式：此成員沒有 YouTube 頻道，跳過 YouTube 相關處理`)
    }
  } else {
    // Full 模式：維持現有完整邏輯
    if (hasYouTube) {
      // 1. 取得頻道資料（包含 uploadsPlaylistId）
      const { avatarUrl, uploadsPlaylistId } = await fetchChannelData(member.channel_id_yt)
      
      // 更新成員頭像
      if (avatarUrl) {
        await supabase.from('members').update({ avatar_url: avatarUrl }).eq('id', member.id)
      }

      // 如果沒有 uploadsPlaylistId，無法繼續 YouTube 處理
      if (!uploadsPlaylistId) {
        console.warn(`  ⚠️ 無法取得 uploadsPlaylistId`)
        // 但繼續處理 Twitch
      } else {

        // 2. 從 Playlist 取得最新影片 ID 列表（增加到 20 筆，避免 Shorts 擠掉直播存檔）
        playlistVideoIds = await fetchPlaylistItems(uploadsPlaylistId, 20)
        
        // 2.5. 同時從 RSS Feed 抓取最新影片 ID（零配額且無延遲，填補 API 快取盲區）
        let rssVideoIds: string[] = []
        try {
          const rssResponse = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${member.channel_id_yt}`)
          if (rssResponse.ok) {
            const rssText = await rssResponse.text()
            // 使用正則表達式提取最新的 videoId，免裝套件
            const matches = [...rssText.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)]
            rssVideoIds = matches.map(m => m[1])
            if (rssVideoIds.length > 0) {
              console.log(`  📡 RSS 抓取到 ${rssVideoIds.length} 部影片（包含突擊開台）`)
            }
          }
        } catch (error) {
          console.log(`  ⚠️ [RSS] 獲取 ${member.name_jp} 的 RSS 失敗，略過。`)
        }
        
        // 2.6. 合併並去重 Video IDs（Playlist + RSS）
        allVideoIds = Array.from(new Set([...playlistVideoIds, ...rssVideoIds]))
        
        // 如果有 RSS 額外抓到的影片，特別標註
        const rssOnlyIds = rssVideoIds.filter(id => !playlistVideoIds.includes(id))
        if (rssOnlyIds.length > 0) {
          console.log(`  🎯 RSS 額外抓到 ${rssOnlyIds.length} 部突擊開台影片: ${rssOnlyIds.join(', ')}`)
        }
      }
    } else {
      console.log(`  📋 Full 模式：此成員沒有 YouTube 頻道，跳過 YouTube 相關處理`)
    }
  }
  
  // 處理 YouTube 影片（如果有）
  let videos: YouTubeVideoResponse['items'] = []
  if (allVideoIds.length > 0) {
    // 3. 取得影片詳情（使用合併後的完整 Video IDs 列表）
    videos = await fetchVideoDetails(allVideoIds)
  } else if (!hasTwitch) {
    // 如果既沒有 YouTube 也沒有 Twitch，直接返回
    console.log(`  ⚠️ 沒有找到影片，且沒有 Twitch 頻道`)
    await supabase.from('members').update({ live_status: 'none', is_live: false }).eq('id', member.id)
    return
  }

  // 4. 檢查直播狀態
  let liveV = videos.find(v => v.snippet.liveBroadcastContent === 'live')
  let upcomingV = videos.find(v => 
    v.snippet.liveBroadcastContent === 'upcoming' && 
    isValidUpcoming(v.liveStreamingDetails?.scheduledStartTime)
  )

  // 5. 將所有成員影片存入 videos 表（不套用過濾器，成員頻道所有影片都應該存入）
  // 先檢查資料庫中現有的影片類型，以便正確更新從 live/upcoming 轉為 archive 的影片
  const existingVideoMap = new Map<string, string>()
  const existingVideoIds = new Set<string>()
  
  if (allVideoIds.length > 0) {
    const { data: existingVideos } = await supabase
      .from('videos')
      .select('id, video_type')
      .in('id', allVideoIds)
      .eq('member_id', member.id)
    
    if (existingVideos) {
      for (const ev of existingVideos) {
        existingVideoMap.set(ev.id, ev.video_type || 'video')
        existingVideoIds.add(ev.id)
      }
    }

    // 檢查是否有原本是 upcoming 的影片在這次查詢中消失了
    // 如果消失，需要強制去撈取一次該影片的詳細資訊
    const missingUpcomingVideos: string[] = []
    for (const [videoId, videoType] of existingVideoMap.entries()) {
      if ((videoType === 'live' || videoType === 'upcoming') && !allVideoIds.includes(videoId)) {
        missingUpcomingVideos.push(videoId)
      }
    }

    // 如果有消失的 upcoming/live 影片，強制查詢一次
    if (missingUpcomingVideos.length > 0) {
      console.log(`  🔍 發現 ${missingUpcomingVideos.length} 部狀態改變的影片，強制查詢詳細資訊...`)
      const missingVideosDetails = await fetchVideoDetails(missingUpcomingVideos)
      if (missingVideosDetails.length > 0) {
        videos.push(...missingVideosDetails)
      }
    }
  }

  const videosToInsert = videos.map((v) => {
    const viewCount = parseInt(v.statistics?.viewCount || '0', 10)
    const durationSec = parseDuration(v.contentDetails?.duration || '')
    
    // 提取即時觀看人數 (concurrent_viewers)
    const concurrentViewers = v.liveStreamingDetails?.concurrentViewers
      ? parseInt(v.liveStreamingDetails.concurrentViewers, 10)
      : 0
    
    // 根據 liveBroadcastContent 判斷 video_type
    // 如果原本是 live 但現在是 none，應該更新為 archive
    let videoType: 'live' | 'archive' | 'video' = 'video'
    const existingType = existingVideoMap.get(v.id)
    
    if (v.snippet.liveBroadcastContent === 'live') {
      videoType = 'live'
    } else if (v.snippet.liveBroadcastContent === 'upcoming') {
      videoType = 'live' // 待機室也視為 live
    } else if (v.snippet.liveBroadcastContent === 'none') {
      if (v.liveStreamingDetails) {
        // 如果曾經是直播但現在結束了，歸類為 archive
        videoType = 'archive'
      } else if (existingType === 'live') {
        // 如果資料庫中原本是 live，現在結束了，更新為 archive
        videoType = 'archive'
      } else {
        videoType = 'video'
      }
    }
    
    const thumbnails = v.snippet?.thumbnails as any
    const thumbnailUrl = thumbnails?.high?.url || 
                        thumbnails?.default?.url || 
                        thumbnails?.medium?.url ||
                        `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`
    
    // 優先使用 actualStartTime（直播實際開始時間），特別是對於已結束的直播存檔
    let publishedAt = new Date().toISOString()
    if (v.snippet.liveBroadcastContent === 'none' && v.liveStreamingDetails?.actualStartTime) {
      // 對於已結束的直播，優先使用實際開始時間
      try {
        publishedAt = new Date(v.liveStreamingDetails.actualStartTime).toISOString()
      } catch {
        // 如果解析失敗，繼續使用 publishedAt
      }
    }
    
    // 如果沒有 actualStartTime，使用 publishedAt
    if (publishedAt === new Date().toISOString() && v.snippet?.publishedAt) {
      try {
        publishedAt = new Date(v.snippet.publishedAt).toISOString()
      } catch {
        // 如果解析失敗，使用當前時間
      }
    }

    return {
      id: v.id,
      member_id: member.id,
      clipper_id: null,
      platform: 'youtube' as const,
      title: v.snippet?.title || '無標題',
      thumbnail_url: thumbnailUrl,
      published_at: publishedAt,
      view_count: viewCount,
      video_type: videoType,
      duration_sec: durationSec,
      concurrent_viewers: concurrentViewers,
      updated_at: new Date().toISOString()
    }
  })

  // 批次寫入 videos 表（每 50 筆）
  const BATCH_SIZE = 50
  let totalUpdated = 0
  let totalInserted = 0
  
  for (let i = 0; i < videosToInsert.length; i += BATCH_SIZE) {
    const batch = videosToInsert.slice(i, i + BATCH_SIZE)
    const { error: upsertError } = await supabase.from('videos').upsert(batch, {
      onConflict: 'id'
    })
    
    if (upsertError) {
      console.warn(`  ⚠️ 批次寫入影片失敗 (第 ${Math.floor(i / BATCH_SIZE) + 1} 批):`, upsertError.message)
    } else {
      // 計算新增和更新的數量
      for (const video of batch) {
        const existing = existingVideoMap.has(video.id)
        if (existing) {
          totalUpdated++
          // 如果是從 live 轉為 archive，特別標註
          const oldType = existingVideoMap.get(video.id)
          if (oldType === 'live' && video.video_type === 'archive') {
            console.log(`  [Member] 成功更新存檔: ${video.title} (live → archive)`)
          } else {
            console.log(`  [Member] 成功更新存檔: ${video.title}`)
          }
        } else {
          totalInserted++
          console.log(`  [Member] 成功新增存檔: ${video.title}`)
        }
      }
    }
  }
  console.log(`  💾 已處理 ${videosToInsert.length} 部成員影片 (新增: ${totalInserted}, 更新: ${totalUpdated})`)

  // 6. 更新 members 表的直播狀態（整合 YouTube 和 Twitch）
  // 優先級：YouTube live > YouTube upcoming > Twitch live > none
  
  let finalLiveStatus: 'live' | 'upcoming' | 'none' = 'none'
  let finalIsLive = false
  let finalLiveVideoId: string | null = null
  let finalLiveTitle: string | null = null
  let finalLiveThumbnail: string | null = null
  let finalLiveStartTime: string | null = null
  let finalLastLiveAt: string | null = null

  // 檢查 YouTube 狀態
  if (liveV) {
    const concurrentViewersNum = liveV.liveStreamingDetails?.concurrentViewers
      ? parseInt(liveV.liveStreamingDetails.concurrentViewers, 10)
      : 0
    const concurrentViewers = concurrentViewersNum.toLocaleString()
    console.log(`  🔴 YouTube LIVE: ${liveV.snippet.title} (👁️ ${concurrentViewers} 人觀看)`)
    finalLiveStatus = 'live'
    finalIsLive = true
    finalLiveVideoId = liveV.id
    finalLiveTitle = liveV.snippet.title
    finalLiveThumbnail = liveV.snippet.thumbnails.high.url
    finalLastLiveAt = new Date().toISOString()
  } else if (upcomingV) {
    console.log(`  ⏰ YouTube 待機: ${upcomingV.snippet.title}`)
    finalLiveStatus = 'upcoming'
    finalIsLive = false
    finalLiveVideoId = upcomingV.id
    finalLiveTitle = upcomingV.snippet.title
    finalLiveThumbnail = upcomingV.snippet.thumbnails.high.url
    finalLiveStartTime = upcomingV.liveStreamingDetails?.scheduledStartTime || null
  } else {
    // YouTube 沒有直播，檢查 Twitch
    if (hasTwitch && twitchToken) {
      console.log(`  [Twitch] 正在查詢 ${member.name_jp} 的直播狀態 (user_id: ${member.twitch_user_id})...`)
      const twitchStatus = await checkTwitchLive(member.twitch_user_id!, twitchToken, member.name_jp)
      if (twitchStatus?.isLive) {
        const viewerCount = twitchStatus.viewerCount ? twitchStatus.viewerCount.toLocaleString() : '0'
        console.log(`  🟣 [Twitch LIVE] 🎮 ${member.name_jp} 正在 Twitch 實況中！`)
        console.log(`     標題: ${twitchStatus.title}`)
        console.log(`     觀看人數: 👁️ ${viewerCount} 人`)
        finalLiveStatus = 'live'
        finalIsLive = true
        finalLiveVideoId = null // Twitch 直播沒有 video_id
        finalLiveTitle = twitchStatus.title
        finalLiveThumbnail = twitchStatus.thumbnail
        finalLastLiveAt = new Date().toISOString()
      }
    } else if (hasTwitch && !twitchToken) {
      console.log(`  [Twitch] ⚠️ 無法查詢 ${member.name_jp} 的直播狀態：缺少 Access Token`)
    }
  }

  // 更新資料庫
  await supabase.from('members').update({
    live_status: finalLiveStatus,
    is_live: finalIsLive,
    live_video_id: finalLiveVideoId,
    live_title: finalLiveTitle,
    live_thumbnail: finalLiveThumbnail,
    live_start_time: finalLiveStartTime,
    last_live_at: finalLastLiveAt
  }).eq('id', member.id)

  // Twitch 存檔抓取（無論是否直播都抓取）
  if (member.twitch_user_id && twitchToken) {

    // 抓取 Twitch 直播存檔
    try {
      console.log(`  📹 抓取 Twitch 直播存檔...`)
      const twitchVideosUrl = new URL(`${TWITCH_API_BASE}/videos`)
      twitchVideosUrl.searchParams.set('user_id', member.twitch_user_id)
      twitchVideosUrl.searchParams.set('first', '20') // 抓取最新 20 部存檔
      twitchVideosUrl.searchParams.set('type', 'archive') // 只抓取存檔，不包含 highlights

      const twitchVideosRes = await fetch(twitchVideosUrl.toString(), {
        headers: {
          'Client-ID': twitchClientId!,
          'Authorization': `Bearer ${twitchToken}`
        }
      })

      if (twitchVideosRes.ok) {
        const twitchVideosData = await twitchVideosRes.json()
        const twitchVideos = twitchVideosData.data || []

        if (twitchVideos.length > 0) {
          console.log(`  ✅ 找到 ${twitchVideos.length} 部 Twitch 存檔`)
          
          const videosToInsert = twitchVideos.map((tv: any) => {
            // 解析時長 (格式: "2h41m54s" 或 "1h30m" 等)
            let durationSec = 0
            if (tv.duration) {
              const durationMatch = tv.duration.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)
              if (durationMatch) {
                const hours = parseInt(durationMatch[1] || '0', 10)
                const minutes = parseInt(durationMatch[2] || '0', 10)
                const seconds = parseInt(durationMatch[3] || '0', 10)
                durationSec = hours * 3600 + minutes * 60 + seconds
              }
            }

            // 處理縮圖 URL（可能使用 {width}x{height} 或 %{width}x%{height} 格式）
            let thumbnailUrl = tv.thumbnail_url || null
            if (thumbnailUrl) {
              thumbnailUrl = thumbnailUrl.replace('{width}x{height}', '1280x720')
                .replace('%{width}x%{height}', '1280x720')
            }

            return {
              id: tv.id, // Twitch video ID (數字字串，不會與 YouTube ID 衝突)
              member_id: member.id,
              clipper_id: null,
              platform: 'twitch' as const,
              title: tv.title || '無標題',
              thumbnail_url: thumbnailUrl,
              published_at: tv.created_at || tv.published_at || new Date().toISOString(),
              view_count: tv.view_count || 0,
              video_type: 'archive' as const,
              duration_sec: durationSec,
              updated_at: new Date().toISOString()
            }
          })

          // 批次寫入 videos 表
          const BATCH_SIZE = 50
          for (let i = 0; i < videosToInsert.length; i += BATCH_SIZE) {
            const batch = videosToInsert.slice(i, i + BATCH_SIZE)
            const { error: upsertError } = await supabase.from('videos').upsert(batch, {
              onConflict: 'id'
            })
            
            if (upsertError) {
              console.warn(`  ⚠️ Twitch 存檔批次寫入失敗 (第 ${Math.floor(i / BATCH_SIZE) + 1} 批):`, upsertError.message)
            } else {
              for (const video of batch) {
                console.log(`  [Member] 成功更新 Twitch 存檔: ${video.title}`)
              }
            }
          }
          console.log(`  💾 已處理 ${videosToInsert.length} 部 Twitch 存檔`)
        }
      } else {
        console.warn(`  ⚠️ Twitch 存檔 API 請求失敗: ${twitchVideosRes.status}`)
      }
    } catch (error) {
      console.warn(`  ⚠️ 抓取 Twitch 存檔時發生錯誤:`, error)
    }
  }
}

async function processClipper(clipper: Clipper, idx: number, total: number) {
  console.log(`[${idx + 1}/${total}] 🎬 ${clipper.name}...`)
  
  // 0. 獲取所有成員名字列表（用於安全過濾）
  const { data: allMembers } = await supabase
    .from('members')
    .select('name_jp, name_zh')
  
  const memberNames = (allMembers || []).map(m => ({
    name_jp: m.name_jp,
    name_zh: m.name_zh
  }))
  
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
          
          // 安全過濾：檢查是否符合 VSPO 相關
          const isRelated = await isVSPORelated(rssData.title, null, memberNames)
          if (!isRelated) {
            console.log(`  [Skip] 非 VSPO 影片: ${rssData.title}`)
            continue
          }
          
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
        const thumbnails = apiVideo.snippet?.thumbnails as any
        const thumbnailUrl = thumbnails?.high?.url || 
                            thumbnails?.default?.url || 
                            thumbnails?.medium?.url ||
                            rssData?.thumbnailUrl || 
                            `https://img.youtube.com/vi/${apiVideo.id}/hqdefault.jpg`
        
        // 優先使用 API 的標題，如果沒有則使用 RSS 的標題
        const title = apiVideo.snippet?.title || rssData?.title || '無標題'
        const description = apiVideo.snippet?.description || null
        
        // 安全過濾：檢查是否符合 VSPO 相關
        const isRelated = await isVSPORelated(title, description, memberNames)
        if (!isRelated) {
          console.log(`  [Skip] 非 VSPO 影片: ${title}`)
          continue
        }
        
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
          
          // 安全過濾：檢查是否符合 VSPO 相關
          const isRelated = await isVSPORelated(rssData.title, null, memberNames)
          if (!isRelated) {
            console.log(`  [Skip] 非 VSPO 影片: ${rssData.title}`)
            continue
          }
          
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
        
        // 安全過濾：檢查是否符合 VSPO 相關
        const isRelated = await isVSPORelated(rssData.title, null, memberNames)
        if (!isRelated) {
          console.log(`  [Skip] 非 VSPO 影片: ${rssData.title}`)
          continue
        }
        
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
  const modeLabel = isFastMode ? '⚡ Fast 模式 (省配額)' : '📋 Full 模式 (完整同步)'
  console.log(`🚀 開始更新 (v7: Playlist 策略 + Fast 模式) - ${modeLabel}...`)
  
  // 獲取 Twitch Access Token
  let twitchToken = null
  if (twitchClientId && twitchClientSecret) {
    twitchToken = await getTwitchAccessToken()
  } else {
    console.log('[Twitch] ⚠️ 跳過 Twitch 相關處理：缺少環境變數')
  }

  const { data: members } = await supabase.from('members').select('id, name_jp, name_zh, channel_id_yt, channel_id_twitch, twitch_user_id')
  
  // 處理成員
  if (members) {
    console.log(`\n=== 成員狀態更新 (共 ${members.length} 位) ===`)
    
    // 統計有 Twitch 的成員
    const membersWithTwitch = members.filter(m => m.twitch_user_id)
    if (membersWithTwitch.length > 0 && twitchToken) {
      const twitchNames = membersWithTwitch.map(m => m.name_jp).join(', ')
      console.log(`[Twitch] 正在查詢以下成員的直播狀態: [${twitchNames}]`)
    } else if (membersWithTwitch.length > 0 && !twitchToken) {
      console.log(`[Twitch] ⚠️ 有 ${membersWithTwitch.length} 位成員有 Twitch 頻道，但無法獲取 Access Token，將跳過 Twitch 檢查`)
    }
    
    for (let i = 0; i < members.length; i++) {
      await processMember(members[i], i, members.length, twitchToken, isFastMode)
      if (i < members.length - 1) await new Promise(r => setTimeout(r, 200))
    }
    
    // 最後統計 Twitch 直播人數
    if (twitchToken) {
      const { data: liveMembers } = await supabase
        .from('members')
        .select('id, live_video_id')
        .eq('is_live', true)
        .is('live_video_id', null) // Twitch 直播的 live_video_id 為 null
      
      const twitchLiveCount = liveMembers?.length || 0
      console.log(`\n[Twitch] 查詢結果: 發現 ${twitchLiveCount} 人正在 Twitch 直播`)
    }
  }

  // 處理烤肉（Fast 模式下跳過，節省配額）
  if (!isFastMode) {
    const { data: clippers } = await supabase.from('clippers').select('*')
    if (clippers) {
      console.log('\n=== 烤肉頻道更新 ===')
      for (let i = 0; i < clippers.length; i++) {
        await processClipper(clippers[i] as Clipper, i, clippers.length)
        if (i < clippers.length - 1) await new Promise(r => setTimeout(r, 100))
      }
    }
  } else {
    console.log('\n⚡ Fast 模式：跳過烤肉頻道更新（節省配額）')
  }
  console.log('\n✨ 全部完成！')
}

updateAll().catch(e => { console.error(e); process.exit(1) })

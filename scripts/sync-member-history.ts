/**
 * sync-member-history.ts
 * 
 * 歷史同步腳本：深挖成員的所有過往直播存檔
 * 
 * 功能：
 * 1. 遍歷資料庫中所有 members
 * 2. 獲取其 YouTube 的「上傳播放清單 (uploads playlist)」
 * 3. 使用分頁 (nextPageToken) 獲取該頻道的所有歷史影片
 * 4. 將所有影片存入 videos 表，套用 live -> archive 判斷邏輯
 * 5. 安全機制：每位成員處理完後顯示新增數量
 * 
 * 使用方法：
 * npx tsx scripts/sync-member-history.ts
 * 
 * 注意：
 * - 此腳本會消耗大量 YouTube API 配額，請謹慎使用
 * - 建議在 API 配額充足時執行
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// 載入環境變數
config({ path: resolve(process.cwd(), '.env.local') })

// 環境變數檢查
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const youtubeApiKey = process.env.YOUTUBE_API_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ 錯誤：缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 環境變數')
  process.exit(1)
}

if (!youtubeApiKey) {
  console.error('❌ 錯誤：缺少 YOUTUBE_API_KEY 環境變數')
  process.exit(1)
}

// 初始化 Supabase Client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

interface Member {
  id: string
  name_jp: string
  name_zh: string
  channel_id_yt: string | null
}

interface YouTubePlaylistResponse {
  items: Array<{
    contentDetails: {
      videoId: string
    }
  }>
  nextPageToken?: string
  pageInfo: {
    totalResults: number
    resultsPerPage: number
  }
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

function parseDuration(duration: string): number | null {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return null
  return (parseInt(match[1] || '0') * 3600) + (parseInt(match[2] || '0') * 60) + parseInt(match[3] || '0')
}

async function fetchChannelData(channelId: string) {
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/channels`)
    url.searchParams.set('part', 'snippet,contentDetails')
    url.searchParams.set('id', channelId)
    url.searchParams.set('key', youtubeApiKey!)
    
    const res = await fetch(url.toString())
    const data = await res.json()
    
    if (data.items?.length > 0) {
      const ch = data.items[0]
      const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads || null
      return { uploadsPlaylistId }
    }
    return { uploadsPlaylistId: null }
  } catch (e) {
    console.error(`❌ 頻道資料失敗 ${channelId}:`, e)
    return { uploadsPlaylistId: null }
  }
}

/**
 * 從 Playlist 分頁獲取所有影片 ID（使用 nextPageToken）
 */
async function fetchAllPlaylistItems(playlistId: string): Promise<string[]> {
  const allVideoIds: string[] = []
  let nextPageToken: string | undefined = undefined
  const maxResults = 50 // 每次最多 50 筆

  console.log(`  📋 開始分頁獲取播放清單中的所有影片...`)

  while (true) {
    try {
      const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`)
      url.searchParams.set('part', 'contentDetails')
      url.searchParams.set('playlistId', playlistId)
      url.searchParams.set('maxResults', maxResults.toString())
      url.searchParams.set('key', youtubeApiKey!)
      
      if (nextPageToken) {
        url.searchParams.set('pageToken', nextPageToken)
      }

      const res = await fetch(url.toString())
      
      if (!res.ok) {
        const errorData = await res.json()
        console.error(`  ❌ PlaylistItems API 錯誤:`, errorData.error?.message)
        
        // 如果配額用盡，停止處理
        if (res.status === 403 || res.status === 429) {
          console.error(`  ⚠️ API 配額可能已用盡，停止處理`)
          break
        }
        
        // 其他錯誤，跳過
        break
      }

      const data: YouTubePlaylistResponse = await res.json()
      
      if (data.items && data.items.length > 0) {
        const videoIds = data.items
          .map((item: any) => item.contentDetails?.videoId)
          .filter((id: string) => id)
        
        allVideoIds.push(...videoIds)
        console.log(`  📥 已獲取 ${allVideoIds.length} 部影片...`)
      }

      // 檢查是否還有下一頁
      nextPageToken = data.nextPageToken
      if (!nextPageToken) {
        break
      }

      // 避免 Rate Limit，每頁之間延遲
      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      console.error(`  ❌ 取得 Playlist Items 失敗:`, e)
      break
    }
  }

  console.log(`  ✅ 共獲取 ${allVideoIds.length} 部影片`)
  return allVideoIds
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
        
        // 如果配額用盡，停止處理
        if (res.status === 403 || res.status === 429) {
          console.error(`  ⚠️ API 配額可能已用盡，停止處理`)
          break
        }
        
        continue
      }
      const data = await res.json()
      if (data.items) allVideos.push(...data.items)
      
      // 避免 Rate Limit
      if (i + batchSize < videoIds.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    } catch (e) {
      console.error('❌ 影片詳情失敗:', e)
    }
  }
  return allVideos
}

async function syncMemberHistory(member: Member, idx: number, total: number) {
  console.log(`\n[${idx + 1}/${total}] 👤 ${member.name_jp} (${member.name_zh})...`)
  
  if (!member.channel_id_yt) {
    console.log(`  ⏭️  跳過：沒有 YouTube 頻道 ID`)
    return { newVideos: 0, updatedVideos: 0 }
  }

  // 1. 取得頻道資料（包含 uploadsPlaylistId）
  const { uploadsPlaylistId } = await fetchChannelData(member.channel_id_yt)
  
  if (!uploadsPlaylistId) {
    console.warn(`  ⚠️ 無法取得 uploadsPlaylistId`)
    return { newVideos: 0, updatedVideos: 0 }
  }

  // 2. 分頁獲取所有歷史影片 ID
  const allVideoIds = await fetchAllPlaylistItems(uploadsPlaylistId)
  
  if (allVideoIds.length === 0) {
    console.log(`  ⚠️ 沒有找到影片`)
    return { newVideos: 0, updatedVideos: 0 }
  }

  // 3. 檢查資料庫中現有的影片
  const { data: existingVideos } = await supabase
    .from('videos')
    .select('id, video_type')
    .in('id', allVideoIds)
    .eq('member_id', member.id)
  
  const existingVideoMap = new Map<string, string>()
  const existingVideoIds = new Set<string>()
  if (existingVideos) {
    for (const ev of existingVideos) {
      existingVideoMap.set(ev.id, ev.video_type || 'video')
      existingVideoIds.add(ev.id)
    }
  }

  // 4. 過濾出新的影片（資料庫中還沒有的）
  const newVideoIds = allVideoIds.filter(id => !existingVideoIds.has(id))
  console.log(`  📊 統計：總共 ${allVideoIds.length} 部影片，其中 ${newVideoIds.length} 部是新影片`)

  // 5. 批次獲取影片詳情（新影片 + 現有影片都需要更新）
  console.log(`  🔍 正在獲取 ${allVideoIds.length} 部影片的詳細資訊...`)
  const videos = await fetchVideoDetails(allVideoIds)

  if (videos.length === 0) {
    console.log(`  ⚠️ 無法獲取影片詳情`)
    return { newVideos: 0, updatedVideos: 0 }
  }

  // 6. 處理影片資料並存入資料庫
  const videosToInsert = videos.map((v) => {
    const viewCount = parseInt(v.statistics?.viewCount || '0', 10)
    const durationSec = parseDuration(v.contentDetails?.duration || '')
    
    // 根據 liveBroadcastContent 判斷 video_type
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
      try {
        publishedAt = new Date(v.liveStreamingDetails.actualStartTime).toISOString()
      } catch {
        // 如果解析失敗，繼續使用 publishedAt
      }
    }
    
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
      updated_at: new Date().toISOString()
    }
  })

  // 7. 批次寫入 videos 表
  const BATCH_SIZE = 50
  let totalNew = 0
  let totalUpdated = 0
  
  for (let i = 0; i < videosToInsert.length; i += BATCH_SIZE) {
    const batch = videosToInsert.slice(i, i + BATCH_SIZE)
    const { error: upsertError } = await supabase.from('videos').upsert(batch, {
      onConflict: 'id'
    })
    
    if (upsertError) {
      console.warn(`  ⚠️ 批次寫入失敗 (第 ${Math.floor(i / BATCH_SIZE) + 1} 批):`, upsertError.message)
    } else {
      // 計算新增和更新的數量
      for (const video of batch) {
        if (existingVideoIds.has(video.id)) {
          totalUpdated++
        } else {
          totalNew++
        }
      }
    }
    
    // 避免 Rate Limit
    if (i + BATCH_SIZE < videosToInsert.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log(`  ✅ 完成！新增 ${totalNew} 部影片，更新 ${totalUpdated} 部影片`)
  return { newVideos: totalNew, updatedVideos: totalUpdated }
}

async function syncAllMembersHistory() {
  console.log('🚀 開始歷史同步：深挖所有成員的過往直播存檔...\n')
  console.log('⚠️  注意：此腳本會消耗大量 YouTube API 配額，請確保配額充足\n')

  // 獲取所有成員
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, name_jp, name_zh, channel_id_yt')
    .not('channel_id_yt', 'is', null)
    .order('name_jp', { ascending: true })

  if (membersError) {
    console.error('❌ 獲取成員列表失敗:', membersError.message)
    process.exit(1)
  }

  if (!members || members.length === 0) {
    console.log('✅ 資料庫中沒有成員，無需同步')
    return
  }

  console.log(`📋 找到 ${members.length} 位成員，開始同步...\n`)

  let totalNew = 0
  let totalUpdated = 0

  // 遍歷所有成員
  for (let i = 0; i < members.length; i++) {
    const result = await syncMemberHistory(members[i], i, members.length)
    totalNew += result.newVideos
    totalUpdated += result.updatedVideos

    // 每位成員處理完後休息 2 秒，避免 Rate Limit
    if (i < members.length - 1) {
      console.log(`  ⏳ 休息 2 秒後繼續下一位成員...\n`)
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✨ 歷史同步完成！')
  console.log(`📊 總計：新增 ${totalNew} 部影片，更新 ${totalUpdated} 部影片`)
  console.log('='.repeat(60))
}

syncAllMembersHistory()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 腳本執行失敗:', error)
    process.exit(1)
  })

/**
 * backfill-all.ts
 * 
 * 全歷史補完腳本
 * 
 * 功能：
 * 1. 從 Supabase 取得所有頻道（成員 + 剪輯師）
 * 2. 將頻道 ID (UCxxx) 轉換為上傳播放清單 ID (UUxxx)
 * 3. 使用 YouTube playlistItems.list API 遍歷所有歷史影片
 * 4. 批次寫入資料庫（只抓 snippet，不抓統計數據以節省配額）
 * 
 * 使用方法：
 * npx tsx scripts/backfill-all.ts
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
const MAX_VIDEOS_PER_CHANNEL = 3000 // 每個頻道最多抓取 3000 部影片（安全上限）
const BATCH_SIZE = 50 // 每批次寫入 50 筆資料

/**
 * VSPO 相關關鍵字清單（用於過濾剪輯師頻道的非相關影片）
 * 包含：團體名、成員日文名、成員英文名、常見變體
 */
const VSPO_KEYWORDS = [
  // 團體名稱
  'ぶいすぽ',
  'vspo',
  'ブイスポ',
  'VSPO',
  'Vspo',
  'VSPO!',
  'Lupinus Virtual Games',
  'LVG',
  'Iris Black Games',
  'IBG',
  'Cattleya Regina Games',
  'CRG',
  
  // 成員日文名（從 seed_members.sql）
  '神成きゅぴ',
  '猫汰つな',
  '八雲べに',
  '花芽すみれ',
  '花芽なずな',
  '一ノ瀬うるは',
  '小雀とと',
  '胡桃のあ',
  '橘ひなの',
  '如月れん',
  '兎咲ミミ',
  '空澄セナ',
  '英リサ',
  '藍沢エマ',
  '紫宮るな',
  '白波らむね',
  '小森めと',
  '夢野あかり',
  '夜乃くろむ',
  '紡木こかげ',
  '千燈ゆうひ',
  '蝶屋はなび',
  '甘結もか',
  '銀城サイネ',
  '龍巻ちせ',
  
  // 成員英文名
  'Remia Aotsuki',
  'Arya Kuroha',
  'Jira Jisaki',
  'Narin Mikure',
  'Riko Solari',
  'Eris Suzukami',
  
  // 常見變體和暱稱
  'きゅぴ',
  'つな',
  'べに',
  'すみれ',
  'なずな',
  'うるは',
  'とと',
  'のあ',
  'ひなの',
  'れん',
  'ミミ',
  'セナ',
  'リサ',
  'エマ',
  'るな',
  'らむね',
  'めと',
  'あかり',
  'くろむ',
  'こかげ',
  'ゆうひ',
  'はなび',
  'もか',
  'サイネ',
  'ちせ',
  
  // 中文關鍵字（用於識別中文翻譯/精華影片）
  'vspo中文',
  'vspo精華',
  'vtuber中文',
  'vtuber精華',
  '中文字幕',
  '翻譯',
  '烤肉',
  'vspo 中文',
  'vspo 精華',
  'vtuber 中文',
  'vtuber 精華',
]

interface ChannelInfo {
  id: string // channel_id
  name: string
  type: 'member' | 'clipper'
  memberId?: string | null
  clipperId?: number | null
}

interface PlaylistItem {
  id: string
  snippet: {
    title: string
    description?: string
    tags?: string[] // 影片標籤
    publishedAt: string
    thumbnails: {
      high?: { url: string }
      medium?: { url: string }
      default?: { url: string }
    }
    resourceId: {
      videoId: string
    }
  }
}

interface PlaylistItemsResponse {
  items: PlaylistItem[]
  nextPageToken?: string
  pageInfo: {
    totalResults: number
    resultsPerPage: number
  }
}

/**
 * 檢查影片是否包含 VSPO 相關關鍵字
 * 
 * 邏輯流程：
 * 1. 優先檢查：說明欄是否有「許諾番号」（最強判斷依據）
 * 2. 全面檢查：標題、描述、標籤是否包含 VSPO 關鍵字
 * 
 * @param title 影片標題
 * @param description 影片描述（選用）
 * @param tags 影片標籤陣列（選用）
 * @returns 是否為 VSPO 相關影片
 */
function isVSPORelated(title: string, description?: string, tags?: string[]): boolean {
  // 步驟 1：優先檢查「許諾番号」（最強判斷依據）
  // 說明欄中如果同時包含「ぶいすぽ」和「許諾番号」，幾乎可以確定是 VSPO 官方授權影片
  if (description) {
    const licensePattern = /ぶいすぽ.*許諾番号|許諾番号.*ぶいすぽ/
    if (licensePattern.test(description)) {
      return true // 直接通過，跳過後續檢查
    }
  }

  // 步驟 2：全面檢查標題、描述、標籤是否包含 VSPO 關鍵字
  const hasKeyword = (text: string): boolean => {
    if (!text) return false
    const textLower = text.toLowerCase()
    return VSPO_KEYWORDS.some((keyword) => {
      const keywordLower = keyword.toLowerCase()
      return textLower.includes(keywordLower)
    })
  }

  // 檢查標題
  if (hasKeyword(title)) {
    return true
  }

  // 檢查描述
  if (description && hasKeyword(description)) {
    return true
  }

  // 檢查標籤（如果有的話）
  if (tags && Array.isArray(tags) && tags.length > 0) {
    if (tags.some((tag) => hasKeyword(tag))) {
      return true
    }
  }

  // 都不符合，過濾掉
  return false
}

/**
 * 將頻道 ID (UCxxx) 轉換為上傳播放清單 ID (UUxxx)
 */
function getUploadsPlaylistId(channelId: string): string {
  if (channelId.startsWith('UC')) {
    return 'UU' + channelId.slice(2)
  }
  // 如果已經是 UU 開頭，直接返回
  if (channelId.startsWith('UU')) {
    return channelId
  }
  // 如果不符合格式，嘗試轉換
  return 'UU' + channelId.slice(2)
}

/**
 * 從 Supabase 取得所有頻道列表
 */
async function getAllChannels(): Promise<ChannelInfo[]> {
  const channels: ChannelInfo[] = []

  // 1. 取得所有成員頻道
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, name_jp, name_zh, channel_id_yt')
    .not('channel_id_yt', 'is', null)

  if (membersError) {
    console.error('❌ 取得成員頻道失敗:', membersError.message)
  } else if (members) {
    for (const member of members) {
      if (member.channel_id_yt) {
        channels.push({
          id: member.channel_id_yt,
          name: member.name_jp || member.name_zh || '未知成員',
          type: 'member',
          memberId: member.id,
        })
      }
    }
  }

  // 2. 取得所有剪輯師頻道
  const { data: clippers, error: clippersError } = await supabase
    .from('clippers')
    .select('id, name, channel_id')

  if (clippersError) {
    console.error('❌ 取得剪輯師頻道失敗:', clippersError.message)
  } else if (clippers) {
    for (const clipper of clippers) {
      channels.push({
        id: clipper.channel_id,
        name: clipper.name,
        type: 'clipper',
        clipperId: clipper.id,
      })
    }
  }

  return channels
}

/**
 * 取得播放清單的所有影片（分頁）
 * 注意：playlistItems.list API 不返回 tags，tags 需要透過 videos.list API 取得
 */
async function fetchPlaylistItems(
  playlistId: string,
  pageToken?: string
): Promise<PlaylistItemsResponse> {
  const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('playlistId', playlistId)
  url.searchParams.set('maxResults', '50')
  url.searchParams.set('key', youtubeApiKey!)

  if (pageToken) {
    url.searchParams.set('pageToken', pageToken)
  }

  const response = await fetch(url.toString())

  if (!response.ok) {
    const errorText = await response.text()
    let errorData: any
    try {
      errorData = JSON.parse(errorText)
    } catch {
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    throw new Error(`YouTube API 錯誤: ${JSON.stringify(errorData, null, 2)}`)
  }

  return await response.json()
}

/**
 * 處理單一頻道的所有影片
 */
async function processChannel(channel: ChannelInfo, index: number, total: number): Promise<number> {
  const uploadsPlaylistId = getUploadsPlaylistId(channel.id)
  let totalFetched = 0
  let pageCount = 0
  let nextPageToken: string | undefined = undefined

  console.log(`\n[${index + 1}/${total}] 📺 ${channel.name} (${channel.type === 'member' ? '成員' : '剪輯師'})`)
  console.log(`   播放清單 ID: ${uploadsPlaylistId}`)

  try {
    // 分頁迴圈，直到抓完所有影片或達到上限
    while (totalFetched < MAX_VIDEOS_PER_CHANNEL) {
      pageCount++

      // 取得當前頁的影片
      const response = await fetchPlaylistItems(uploadsPlaylistId, nextPageToken)

      if (!response.items || response.items.length === 0) {
        console.log(`   ✅ 已抓取所有影片 (共 ${totalFetched} 部)`)
        break
      }

      // 準備批次寫入的資料（先過濾，再轉換格式）
      const rawVideos = response.items.filter((item) => {
        const videoId = item.snippet.resourceId.videoId
        if (!videoId) return false

        // 情況 A：官方成員 - 不過濾，全部保留
        if (channel.type === 'member') {
          return true
        }

        // 情況 B：剪輯師 - 嚴格過濾，只保留包含 VSPO 關鍵字的影片
        if (channel.type === 'clipper') {
          const title = item.snippet.title || ''
          const description = item.snippet.description || ''
          // 注意：playlistItems.list API 不返回 tags
          // tags 需要透過 videos.list API 取得，但為了節省配額，我們先不取得
          // 目前先基於標題和描述（包含許諾番号檢查）進行過濾
          // 如果未來需要更精確的過濾，可以考慮在過濾後再批量查詢 videos.list 獲取 tags
          const tags: string[] = [] // 暫時為空，未來可以擴展
          return isVSPORelated(title, description, tags)
        }

        return false
      })

      // 轉換為資料庫格式
      const videosToInsert = rawVideos
        .map((item) => {
          const videoId = item.snippet.resourceId.videoId
          if (!videoId) return null

          const thumbnailUrl =
            item.snippet.thumbnails.high?.url ||
            item.snippet.thumbnails.medium?.url ||
            item.snippet.thumbnails.default?.url ||
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

          return {
            id: videoId, // 使用 videoId 作為主鍵
            member_id: channel.type === 'member' ? channel.memberId : null,
            clipper_id: channel.type === 'clipper' ? channel.clipperId : null,
            title: item.snippet.title || '無標題',
            thumbnail_url: thumbnailUrl,
            published_at: item.snippet.publishedAt
              ? new Date(item.snippet.publishedAt).toISOString()
              : new Date().toISOString(),
            view_count: 0, // 先設為 0，之後用 enrich-videos.ts 補完
            video_type: 'video' as const,
            duration_sec: 0, // 先設為 0，之後用 enrich-videos.ts 補完
            updated_at: new Date().toISOString(),
          }
        })
        .filter((v) => v !== null) as any[]

      // 顯示過濾結果（僅對剪輯師顯示）
      if (channel.type === 'clipper') {
        const originalCount = response.items.length
        const filteredCount = videosToInsert.length
        if (originalCount > filteredCount) {
          console.log(`   🔍 過濾: ${originalCount} 部 -> ${filteredCount} 部 (VSPO 相關)`)
        }
      }

      // 批次寫入（每 50 筆）
      for (let i = 0; i < videosToInsert.length; i += BATCH_SIZE) {
        const batch = videosToInsert.slice(i, i + BATCH_SIZE)
        const { error: upsertError } = await supabase.from('videos').upsert(batch, {
          onConflict: 'id',
        })

        if (upsertError) {
          console.error(`  ⚠️ 批次寫入失敗 (第 ${i / BATCH_SIZE + 1} 批):`, upsertError.message)
        }
      }

      totalFetched += videosToInsert.length
      console.log(`   📄 第 ${pageCount} 頁: 抓取 ${videosToInsert.length} 部影片 (累計: ${totalFetched})`)

      // 檢查是否還有下一頁
      nextPageToken = response.nextPageToken
      if (!nextPageToken) {
        console.log(`   ✅ 已抓取所有影片 (共 ${totalFetched} 部)`)
        break
      }

      // 檢查是否達到上限
      if (totalFetched >= MAX_VIDEOS_PER_CHANNEL) {
        console.log(`   ⚠️ 已達到上限 (${MAX_VIDEOS_PER_CHANNEL} 部)，停止抓取`)
        break
      }

      // 簡單延遲，避免 API 限流
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    return totalFetched
  } catch (error) {
    console.error(`  ❌ 處理頻道失敗:`, error instanceof Error ? error.message : error)
    return totalFetched
  }
}

/**
 * 主函數
 */
async function backfillAll() {
  console.log('🚀 開始全歷史補完計畫...\n')
  console.log('='.repeat(60))

  try {
    // 1. 取得所有頻道
    console.log('📋 正在取得頻道列表...')
    const channels = await getAllChannels()
    console.log(`✅ 找到 ${channels.length} 個頻道 (${channels.filter(c => c.type === 'member').length} 個成員 + ${channels.filter(c => c.type === 'clipper').length} 個剪輯師)\n`)

    if (channels.length === 0) {
      console.log('⚠️ 沒有找到任何頻道，結束執行。')
      return
    }

    // 2. 遍歷每個頻道
    let totalVideos = 0
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i]
      const count = await processChannel(channel, i + 1, channels.length)
      totalVideos += count

      // 頻道之間的延遲
      if (i < channels.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    // 3. 總結
    console.log('\n' + '='.repeat(60))
    console.log('✨ 全歷史補完完成！')
    console.log(`📊 統計：`)
    console.log(`   - 處理頻道數：${channels.length}`)
    console.log(`   - 總影片數：${totalVideos}`)
    console.log(`\n💡 提示：執行 'npx tsx scripts/enrich-videos.ts' 來補完觀看次數和時長。`)
  } catch (error) {
    console.error('\n❌ 執行失敗:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// 執行主函數
backfillAll()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 未預期的錯誤:', error)
    process.exit(1)
  })

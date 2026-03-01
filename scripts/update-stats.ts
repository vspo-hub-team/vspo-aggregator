/**
 * update-stats.ts
 * 
 * 近期影片觀看次數更新腳本：高效更新過去 14 天內 YouTube 影片的觀看次數
 * 
 * 功能：
 * 1. 從 Supabase 的 videos 表中，撈出 platform = 'youtube' 且 published_at 在「過去 14 天內」的所有影片
 * 2. 將影片 ID 以 50 個為一組 (Chunk) 進行分割（YouTube API 每次最多支援查詢 50 個 ID）
 * 3. 使用 YouTube Data API 查詢最新數據（每查 50 部影片只會消耗 1 點 Quota）
 * 4. 將取得的最新 view_count 寫回 Supabase 的 videos 表
 * 
 * 使用方法：
 * npx tsx scripts/update-stats.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// 載入環境變數
config({ path: resolve(process.cwd(), '.env.local') })

// 環境變數檢查
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const youtubeApiKey = process.env.YOUTUBE_API_KEY

if (!supabaseUrl) {
  console.error('❌ 錯誤：缺少 SUPABASE_URL 環境變數')
  throw new Error('Missing SUPABASE_URL environment variable')
}

if (!supabaseServiceRoleKey) {
  console.error('❌ 錯誤：缺少 SUPABASE_SERVICE_ROLE_KEY 環境變數')
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

if (!youtubeApiKey) {
  console.error('❌ 錯誤：缺少 YOUTUBE_API_KEY 環境變數')
  throw new Error('Missing YOUTUBE_API_KEY environment variable')
}

// 初始化 Supabase Client (使用 Service Role Key 以獲得寫入權限)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// YouTube API 基礎 URL
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

// 每個 Chunk 的影片數量（YouTube API 限制）
const BATCH_SIZE = 50

// 過去 14 天的毫秒數
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

// 將陣列切成指定大小的 Chunks
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

interface YouTubeVideoResponse {
  items: Array<{
    id: string
    statistics: {
      viewCount?: string
      likeCount?: string
    }
  }>
}

/**
 * 從 YouTube API 獲取影片統計資料
 */
async function fetchVideoStatistics(videoIds: string[]): Promise<YouTubeVideoResponse['items']> {
  if (videoIds.length === 0) return []

  try {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`)
    url.searchParams.set('part', 'statistics')
    url.searchParams.set('id', videoIds.join(','))
    url.searchParams.set('key', youtubeApiKey as string)

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorData = await response.json()
      console.error(`  ❌ YouTube API 請求失敗:`, JSON.stringify(errorData, null, 2))
      
      // 如果配額用盡或其他嚴重錯誤，拋出錯誤
      if (response.status === 403 || response.status === 429) {
        throw new Error('API 配額可能已用盡或達到 Rate Limit')
      }
      
      throw new Error(`YouTube API 請求失敗: ${response.status}`)
    }

    const data: YouTubeVideoResponse = await response.json()
    return data.items || []
  } catch (error) {
    console.error(`  ❌ 獲取影片統計資料時發生錯誤:`, error)
    throw error
  }
}

/**
 * 主函數：更新近期影片的觀看次數
 */
async function updateStats() {
  console.log('🚀 開始更新近期影片觀看次數...\n')

  try {
    // 1. 計算過去 14 天的時間範圍
    const fourteenDaysAgo = new Date(Date.now() - FOURTEEN_DAYS_MS)
    const fourteenDaysAgoISO = fourteenDaysAgo.toISOString()

    console.log(`📅 查詢範圍：過去 14 天內（${fourteenDaysAgoISO} 之後）`)
    console.log('='.repeat(60))

    // 2. 從 Supabase 查詢符合條件的影片
    // platform = 'youtube' 且 published_at 在過去 14 天內
    console.log('📋 正在從資料庫查詢近期 YouTube 影片...')
    
    const { data: videos, error: queryError } = await supabase
      .from('videos')
      .select('id, title, published_at, view_count')
      .eq('platform', 'youtube')
      .gte('published_at', fourteenDaysAgoISO)
      .order('published_at', { ascending: false })

    if (queryError) {
      console.error('❌ 資料庫查詢失敗:', queryError.message)
      throw queryError
    }

    if (!videos || videos.length === 0) {
      console.log('✅ 過去 14 天內沒有 YouTube 影片需要更新')
      return
    }

    console.log(`📋 找到 ${videos.length} 部近期影片需要更新`)
    console.log(`📦 將分成 ${Math.ceil(videos.length / BATCH_SIZE)} 個批次處理...\n`)

    // 3. 將影片 ID 每 50 個切成一個 Chunk
    // 注意：videos 表的 id 欄位就是 YouTube Video ID
    const videoIds = videos.map(v => v.id)
    const chunks = chunkArray(videoIds, BATCH_SIZE)
    const totalChunks = chunks.length

    let totalUpdated = 0
    let totalProcessed = 0

    // 4. 逐個 Chunk 處理
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      const chunkNumber = chunkIndex + 1

      console.log(`[${chunkNumber}/${totalChunks}] 🔍 正在查詢 ${chunk.length} 部影片的統計資料...`)

      try {
        // 5. 呼叫 YouTube API videos.list 獲取統計資料
        const items = await fetchVideoStatistics(chunk)

        console.log(`  📡 YouTube API 回傳 ${items.length} 筆資料`)

        if (items.length === 0) {
          console.warn(`  ⚠️ 本批次沒有取得任何資料，跳過`)
          totalProcessed += chunk.length
          continue
        }

        // 6. 解析回傳的資料並建立更新 Promise
        const updatePromises: PromiseLike<any>[] = []
        let firstViewCount = 0

        for (const item of items) {
          // 解析觀看數
          const viewCount = parseInt(item.statistics?.viewCount || '0', 10)

          // 記錄第一筆資料用於顯示範例
          if (updatePromises.length === 0) {
            firstViewCount = viewCount
          }

          // 使用 .update() 進行局部更新，只更新 view_count
          const updatePromise = supabase
            .from('videos')
            .update({
              view_count: viewCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          updatePromises.push(updatePromise)
        }

        // 7. 批次執行更新（使用 Promise.all 平行處理）
        if (updatePromises.length > 0) {
          const results = await Promise.all(updatePromises)

          // 檢查是否有錯誤
          const errors = results.filter(r => r.error)
          const successCount = results.length - errors.length

          if (errors.length > 0) {
            console.error(`  ⚠️ 部分更新失敗: ${errors.length} 筆`)
            if (errors[0]?.error) {
              console.error(`     錯誤範例:`, errors[0].error.message)
            }
          }

          if (successCount > 0) {
            totalUpdated += successCount
            console.log(`  ✅ 已更新 ${successCount} 部影片的觀看次數`)
            if (items.length > 0) {
              console.log(`     範例: 觀看次數 ${firstViewCount.toLocaleString()}`)
            }
          }
        }

        totalProcessed += chunk.length

        // 8. 每個 Chunk 執行完後延遲 500ms 避免 Rate Limit
        if (chunkIndex < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 500))
        }

      } catch (err) {
        console.error(`  ❌ 處理 Chunk ${chunkNumber} 時發生錯誤:`, err)
        
        // 如果 API 配額用盡，停止執行
        if (err instanceof Error && err.message.includes('配額')) {
          console.error('⚠️ API 配額可能已用盡，停止執行')
          break
        }
        
        // 其他錯誤等待後繼續下一個 Chunk
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 更新統計：')
    console.log(`   處理影片數：${totalProcessed} 部`)
    console.log(`   成功更新數：${totalUpdated} 部`)
    console.log('='.repeat(60))
    console.log('\n✨ 更新任務完成！')

  } catch (error) {
    console.error('\n❌ 腳本執行失敗:', error)
    throw error
  }
}

// 執行主函數
updateStats()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 腳本執行失敗:', error)
    process.exit(1)
  })

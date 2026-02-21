/**
 * enrich-videos.ts
 * 
 * 歷史資料補完腳本：補充 YouTube 影片的觀看次數與時長
 * 
 * 功能：
 * 1. 從資料庫中找出需要更新的 YouTube 影片（view_count 為 null/0 或 duration_sec 為 null/0）
 * 2. 透過 YouTube API 補齊資料
 * 3. 批次更新回 Supabase
 * 
 * 使用方法：
 * npx tsx scripts/enrich-videos.ts
 * npx tsx scripts/enrich-videos.ts --once  # 單次模式
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// 載入環境變數
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const youtubeApiKey = process.env.YOUTUBE_API_KEY

if (!supabaseUrl || !supabaseServiceKey || !youtubeApiKey) {
  console.error('❌ 錯誤：缺少必要的環境變數 (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl as string, supabaseServiceKey as string)
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

const BATCH_SIZE = 50 // 每個 Chunk 的影片數量（YouTube API 限制）
const FETCH_LIMIT = 5000 // 每次從資料庫撈取的影片數量上限

// 解析 ISO 8601 時長 (PT1H2M10S -> 秒數)
function parseDuration(duration: string): number {
  if (!duration) return 0
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

// 將陣列切成指定大小的 Chunks
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

async function enrichVideos() {
  const RUN_ONCE = process.argv.includes('--once')

  console.log(
    RUN_ONCE
      ? '🚀 開始影片數據補完計畫 (Enrich Videos - 單次模式 --once)...\n'
      : '🚀 開始影片數據補完計畫 (Enrich Videos - 自動循環模式)...\n'
  )

  let totalProcessed = 0
  let totalUpdated = 0

  // 自動循環執行，直到補完所有影片
  while (true) {
    console.log(`\n${'='.repeat(60)}`)
    console.log('📋 正在從資料庫查詢需要補完的影片...')
    console.log('='.repeat(60))

    // 計算 24 小時前的時間（用於時間冷卻機制，避免無限迴圈）
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // 1. 從資料庫選取需要補完的影片
    // platform = 'youtube' 且 (view_count IS NULL/0 或 duration_sec IS NULL/0)
    // 並且 (updated_at < 24小時前 或 updated_at IS NULL) - 時間冷卻機制
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title')
      .eq('platform', 'youtube')
      .or('view_count.is.null,view_count.eq.0,duration_sec.is.null,duration_sec.eq.0')
      .or(`updated_at.lt.${yesterday},updated_at.is.null`) // 時間冷卻：只處理 24 小時前更新的或從未更新的
      .order('updated_at', { ascending: true }) // 優先處理最久沒更新的
      .limit(FETCH_LIMIT)

    if (error) {
      console.error('❌ 資料庫查詢失敗:', error.message)
      break
    }

    if (!videos || videos.length === 0) {
      console.log('✅ 所有影片數據皆已完整，無需補完。')
      break
    }

    console.log(`📋 找到 ${videos.length} 部需要補完的影片`)
    console.log(`📦 將分成 ${Math.ceil(videos.length / BATCH_SIZE)} 個批次處理...\n`)

    // 2. 將影片 ID 每 50 個切成一個 Chunk
    // 注意：videos 表的 id 欄位就是 YouTube Video ID
    const videoIds = videos.map(v => v.id)
    const chunks = chunkArray(videoIds, BATCH_SIZE)
    const totalChunks = chunks.length

    // 3. 逐個 Chunk 處理
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      const chunkNumber = chunkIndex + 1

      console.log(`[${chunkNumber}/${totalChunks}] 🔍 正在查詢 ${chunk.length} 部影片的資料...`)

      try {
        // 4. 呼叫 YouTube API videos.list
        const url = new URL(`${YOUTUBE_API_BASE}/videos`)
        url.searchParams.set('part', 'statistics,contentDetails')
        url.searchParams.set('id', chunk.join(','))
        url.searchParams.set('key', youtubeApiKey as string)

        const response = await fetch(url.toString())

        if (!response.ok) {
          const errorData = await response.json()
          console.error(`  ❌ YouTube API 請求失敗:`, JSON.stringify(errorData, null, 2))
          
          // 如果配額用盡或其他嚴重錯誤，跳出循環
          if (response.status === 403 || response.status === 429) {
            console.error('⚠️ API 配額可能已用盡，停止執行')
            return
          }
          
          // 其他錯誤等待後繼續下一個 Chunk
          await new Promise(r => setTimeout(r, 2000))
          continue
        }

        const data = await response.json()
        const items = data.items || []

        console.log(`  📡 YouTube API 回傳 ${items.length} 筆資料`)

        // 5. 解析回傳的資料並建立更新 Promise
        const foundIds = new Set<string>()
        const updatePromises: PromiseLike<any>[] = []
        let firstViewCount = 0
        let firstDurationSec = 0

        for (const item of items) {
          foundIds.add(item.id)

          // 解析觀看數與時長
          const viewCount = parseInt(item.statistics?.viewCount || '0', 10)
          const durationSec = parseDuration(item.contentDetails?.duration || '')

          // 記錄第一筆資料用於顯示範例
          if (updatePromises.length === 0) {
            firstViewCount = viewCount
            firstDurationSec = durationSec
          }

          // 使用 .update() 進行局部更新，只更新 view_count 和 duration_sec
          const updatePromise = supabase
            .from('videos')
            .update({
              view_count: viewCount,
              duration_sec: durationSec,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          updatePromises.push(updatePromise)
        }

        // 處理失效影片（API 沒回傳的 ID）
        const missingIds = chunk.filter(id => !foundIds.has(id))
        if (missingIds.length > 0) {
          console.warn(`  ⚠️ 有 ${missingIds.length} 部影片在 YouTube 找不到 (可能已刪除或轉私人)`)
          console.log(`  🗑️  將這些無效影片從資料庫中刪除，保持資料庫乾淨`)
          
          // 直接刪除這些無效影片，避免無限迴圈
          const { error: deleteError, data: deletedData } = await supabase
            .from('videos')
            .delete()
            .in('id', missingIds)
            .select()
          
          if (deleteError) {
            console.error(`  ❌ 刪除無效影片時發生錯誤:`, deleteError.message)
          } else {
            const deletedCount = deletedData?.length || missingIds.length
            console.log(`  ✅ 已刪除 ${deletedCount} 部無效影片`)
          }
        }

        // 6. 批次執行更新（使用 Promise.all 平行處理）
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
            console.log(`  ✅ 已更新 ${successCount} 部影片的觀看數與時長`)
            if (items.length > 0) {
              console.log(`     範例: 觀看數 ${firstViewCount.toLocaleString()}, 時長 ${firstDurationSec}秒`)
            }
          }
        }

        totalProcessed += chunk.length

        // 7. 每個 Chunk 執行完後延遲 500ms 避免 Rate Limit
        if (chunkIndex < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 500))
        }

      } catch (err) {
        console.error(`  ❌ 處理 Chunk ${chunkNumber} 時發生錯誤:`, err)
        // 發生錯誤時等待後繼續下一個 Chunk
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
    }

    console.log(`\n📊 本輪統計：處理 ${totalProcessed} 部影片，成功更新 ${totalUpdated} 部`)

    // 檢查是否還有需要更新的影片（同樣加入時間冷卻條件）
    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'youtube')
      .or('view_count.is.null,view_count.eq.0,duration_sec.is.null,duration_sec.eq.0')
      .or(`updated_at.lt.${yesterday},updated_at.is.null`) // 時間冷卻：只計算 24 小時前更新的或從未更新的

    // 單次模式：只跑一輪就結束
    if (RUN_ONCE) {
      console.log(`\n🛑 單次模式結束：本次已處理 ${totalProcessed} 部影片（剩餘約 ${count ?? '未知'} 部影片待補完）`)
      break
    }

    if (count === 0) {
      console.log('\n✅ 所有影片數據補完完成！')
      break
    }

    // 休息 2 秒後繼續下一輪
    console.log(`\n⏳ 休息 2 秒後繼續下一輪... (剩餘約 ${count} 部影片)`)
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log('\n✨ 補完任務全部完成！')
  console.log(`📊 總計：處理 ${totalProcessed} 部影片，成功更新 ${totalUpdated} 部`)
}

enrichVideos()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 腳本執行失敗:', error)
    process.exit(1)
  })

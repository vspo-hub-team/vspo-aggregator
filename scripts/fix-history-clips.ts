/**
 * fix-history-clips.ts
 * 全自動分頁掃描修復歷史精華影片的 related_stream_id
 * 
 * 功能：
 * 1. 使用分頁循環自動掃描所有 related_stream_id IS NULL 的精華/短影音（每次 1000 筆）
 * 2. 使用 YouTube API 批量獲取 description（每 50 個一批，避免配額爆炸）
 * 3. 從 description 中提取原直播 ID 並綁定到 related_stream_id
 * 4. 自動創建空殼 stream（Skeleton Stream）以實現群組化
 * 5. 輸出詳細的進度報告和統計資訊
 * 
 * 特點：
 * - 全自動執行：一鍵啟動，自動翻頁直到全部處理完畢
 * - 分頁穩定：使用 created_at 排序確保分頁一致性
 * - 智能匹配：找不到記錄時自動創建空殼 stream，實現群組化
 * 
 * 注意：精華影片存在 videos 表中，透過 video_type 欄位區分（'clip', 'short', 'video' 等）
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

// 延遲函數（避免 Rate Limit）
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 從 description 中提取原直播的 Video ID（支援 YouTube 和 Twitch）
 * 智慧計算距離「關鍵字」最近的正確來源，支援多個網址與特殊符號關鍵字
 * 返回格式：{ id: string, platform: 'youtube' | 'twitch' } | null
 */
function extractSourceVideoId(description: string | null | undefined): { id: string; platform: 'youtube' | 'twitch' } | null {
  if (!description) return null;

  // 1. 防呆正則表達式 (每次執行重新配對，避免 lastIndex Bug)
  const ytRegex = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|shorts\/|v\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi;
  const twitchRegex = /twitch\.tv\/videos\/(\d+)/gi;

  // 2. 擴充關鍵字清單 (加入所有可能的變體與符號)
  const keywords = ['元配信', '元動画', '本編', 'アーカイブ', '配信元', '📺', '▽', '■'];

  // 3. 找出所有 YouTube 與 Twitch ID 及其在文章中的位置
  const ytMatches = [...description.matchAll(ytRegex)];
  const twitchMatches = [...description.matchAll(twitchRegex)];

  const allLinks = [
    ...ytMatches.map(m => ({ id: m[1], platform: 'youtube' as const, index: m.index! })),
    ...twitchMatches.map(m => ({ id: m[1], platform: 'twitch' as const, index: m.index! }))
  ];

  if (allLinks.length === 0) return null;
  if (allLinks.length === 1) return { id: allLinks[0].id, platform: allLinks[0].platform };

  // 4. 如果有多個網址，尋找距離「關鍵字」最近的那個網址
  let bestLink = allLinks[0];
  let minDistance = Infinity;

  for (const link of allLinks) {
    for (const keyword of keywords) {
      const keywordIndex = description.lastIndexOf(keyword, link.index);
      if (keywordIndex !== -1) {
        const distance = link.index - keywordIndex;
        // 限制在 300 字元內，避免抓到毫不相干的網址
        if (distance > 0 && distance < minDistance && distance < 300) {
          minDistance = distance;
          bestLink = link;
        }
      }
    }
  }

  return { id: bestLink.id, platform: bestLink.platform };
}

/**
 * 根據 Video ID 和平台查找對應的 stream UUID
 * 先在 streams 表中查找，如果找不到則嘗試在 videos 表中查找並自動創建 stream 記錄
 * 如果都找不到，則創建一個空殼 stream（Skeleton Stream）以實現群組化
 * @param sourceInfo - { id: string, platform: 'youtube' | 'twitch' }
 */
async function findStreamIdByVideoId(sourceInfo: { id: string; platform: 'youtube' | 'twitch' }): Promise<string | null> {
  const { id: videoId, platform } = sourceInfo
  // 1. 先在 streams 表中查找
  const { data: streamData } = await supabase
    .from('streams')
    .select('id')
    .eq('video_id', videoId)
    .maybeSingle()
  
  if (streamData?.id) {
    return streamData.id
  }
  
  // 2. 如果 streams 表中找不到，在 videos 表中查找（嘗試獲取更多資訊）
  // 注意：videos 表的 id 就是 YouTube Video ID
  const { data: videoData } = await supabase
    .from('videos')
    .select('id, member_id, title, published_at, platform')
    .eq('id', videoId)
    .in('video_type', ['live', 'archive'])
    .maybeSingle()
  
  if (videoData?.id) {
    if (videoData.member_id) {
      // 如果找到對應的 video 且有 member_id，自動在 streams 表中創建完整的記錄
      const { data: newStreamData, error: streamCreateError } = await supabase
        .from('streams')
        .insert({
          video_id: videoId,
          platform: (videoData.platform as any) || 'youtube',
          title: videoData.title || null,
          published_at: videoData.published_at || null,
          member_id: videoData.member_id
        })
        .select('id')
        .single()
      
      if (streamCreateError) {
        console.warn(`  ⚠️ 創建 stream 記錄失敗: ${streamCreateError.message}`)
        return null
      }
      
      if (newStreamData?.id) {
        return newStreamData.id
      }
    } else {
      // 如果找到 video 但沒有 member_id，創建空殼 stream（使用 video 表中的 platform 資訊）
      const { data: newStreamData, error: streamCreateError } = await supabase
        .from('streams')
        .insert({
          video_id: videoId,
          platform: (videoData.platform as any) || 'youtube',
          title: videoData.title || null,
          published_at: videoData.published_at || null,
          member_id: null
        })
        .select('id')
        .single()
      
      if (streamCreateError) {
        console.warn(`  ⚠️ 創建空殼 stream 失敗: ${streamCreateError.message}`)
        return null
      }
      
      if (newStreamData?.id) {
        return newStreamData.id
      }
    }
  }
  
  // 3. 如果 streams 和 videos 表中都找不到，創建一個空殼 stream（Skeleton Stream）
  // 這樣可以讓同一個 source_video_id 的精華影片獲得相同的 related_stream_id，實現群組化
  const { data: skeletonStreamData, error: skeletonStreamError } = await supabase
    .from('streams')
    .insert({
      video_id: videoId,
      platform: platform, // 使用提取到的平台資訊（youtube 或 twitch）
      title: null,
      published_at: null,
      member_id: null
    })
    .select('id')
    .single()
  
  if (skeletonStreamError) {
    console.warn(`  ⚠️ 創建空殼 stream 失敗: ${skeletonStreamError.message}`)
    return null
  }
  
  if (skeletonStreamData?.id) {
    return skeletonStreamData.id
  }
  
  return null
}

/**
 * 將陣列切割成指定大小的 Chunk
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * 批量獲取 YouTube 影片的 description
 */
async function fetchVideoDescriptions(videoIds: string[]): Promise<Map<string, string | null>> {
  const descriptions = new Map<string, string | null>()
  
  if (videoIds.length === 0) return descriptions
  
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('id', videoIds.join(','))
    url.searchParams.set('key', youtubeApiKey!)
    
    const response = await fetch(url.toString())
    
    if (!response.ok) {
      const errorData = await response.json()
      console.error(`  ❌ YouTube API 請求失敗:`, errorData.error?.message || JSON.stringify(errorData))
      // 如果配額用盡，返回空 Map
      if (response.status === 403 || response.status === 429) {
        console.error(`  ⚠️ API 配額可能已用盡，停止處理`)
        return descriptions
      }
      return descriptions
    }
    
    const data = await response.json()
    const items = data.items || []
    
    // 建立 video_id -> description 的映射
    for (const item of items) {
      const videoId = item.id
      const description = item.snippet?.description || null
      descriptions.set(videoId, description)
    }
    
    // 對於 API 沒回傳的影片，設為 null
    for (const videoId of videoIds) {
      if (!descriptions.has(videoId)) {
        descriptions.set(videoId, null)
      }
    }
  } catch (error) {
    console.error(`  ❌ 獲取影片描述時發生錯誤:`, error)
  }
  
  return descriptions
}

/**
 * 主函數：修復歷史精華影片的 related_stream_id
 * 使用分頁循環自動掃描所有記錄，直到全部處理完畢
 */
async function fixHistoryClips() {
  console.log('🚀 開始修復歷史精華影片的 related_stream_id...\n')
  
  // 先檢查 videos 表的總數
  const { count: totalVideosCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
  
  console.log(`📊 videos 表總記錄數：${totalVideosCount || 0}\n`)
  
  // 分頁參數
  const PAGE_SIZE = 1000 // 每次從資料庫撈取 1000 筆
  const API_BATCH_SIZE = 50 // 每 50 筆發送一次 YouTube API
  
  // 統計變數（跨所有分頁）
  let totalProcessed = 0
  let totalMatched = 0
  let totalUpdated = 0
  let totalErrors = 0
  let totalSkipped = 0 // 無法匹配的記錄數（description 中沒有 URL）
  let pageNumber = 0
  
  // 記錄每個分頁開始時的統計值（用於計算本分頁統計）
  let pageStartProcessed = 0
  let pageStartMatched = 0
  let pageStartUpdated = 0
  
  // 分頁循環：自動翻頁直到全部處理完畢
  while (true) {
    pageNumber++
    const startIndex = (pageNumber - 1) * PAGE_SIZE
    const endIndex = startIndex + PAGE_SIZE - 1
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📄 [分頁 ${pageNumber}] 正在處理第 ${startIndex + 1}~${endIndex + 1} 筆記錄...`)
    console.log('='.repeat(60))
    
    // 查詢當前分頁的記錄
    // 注意：必須使用 .order() 確保分頁穩定，使用 created_at 作為排序依據
    const { data: orphanVideos, error: fetchError } = await supabase
      .from('videos')
      .select('id, title, video_type, related_stream_id, clipper_id')
      .is('related_stream_id', null)
      .not('clipper_id', 'is', null) // 只取精華（有 clipper_id）
      // 包含所有精華類型：video, short, clip（無視大小寫）
      .or('video_type.eq.video,video_type.eq.Video,video_type.eq.VIDEO,video_type.eq.short,video_type.eq.Short,video_type.eq.SHORT,video_type.eq.clip,video_type.eq.Clip,video_type.eq.CLIP')
      .order('created_at', { ascending: false }) // 使用 created_at 確保分頁穩定
      .range(startIndex, endIndex)
    
    if (fetchError) {
      console.error('❌ 查詢 videos 表失敗:', fetchError.message)
      console.error('錯誤詳情:', JSON.stringify(fetchError, null, 2))
      process.exit(1)
    }
    
    // 如果本次查詢返回 0 筆記錄，代表已經全部處理完畢
    if (!orphanVideos || orphanVideos.length === 0) {
      console.log(`\n✅ 已處理完所有記錄！本分頁無資料，結束循環。`)
      break
    }
    
    console.log(`  🔍 本分頁查詢結果：找到 ${orphanVideos.length} 筆記錄`)
    
    // 記錄本分頁開始時的統計值
    pageStartProcessed = totalProcessed
    pageStartMatched = totalMatched
    pageStartUpdated = totalUpdated
    
    // 提取所有 video_id（videos 表的 id 就是 YouTube Video ID）
    const videoIds = orphanVideos.map(video => video.id).filter(Boolean)
    
    if (videoIds.length === 0) {
      console.log('  ⚠️ 本分頁沒有有效的 video_id，跳過')
      continue
    }
    
    // 將 video_id 陣列切割成每 50 個一組的 Chunk（YouTube API 批次限制）
    const chunks = chunkArray(videoIds, API_BATCH_SIZE)
    const totalBatches = chunks.length
    
    console.log(`  📦 將 ${videoIds.length} 部影片分成 ${totalBatches} 個 API 批次（每批 ${API_BATCH_SIZE} 部）\n`)
    
    // 逐批次處理（每批 50 個發送一次 YouTube API）
    for (let batchIndex = 0; batchIndex < chunks.length; batchIndex++) {
      const chunk = chunks[batchIndex]
      const startIndexInPage = batchIndex * API_BATCH_SIZE + 1
      const endIndexInPage = Math.min((batchIndex + 1) * API_BATCH_SIZE, videoIds.length)
      
      console.log(`  📦 [API 批次 ${batchIndex + 1}/${totalBatches}] 正在處理第 ${startIndexInPage}~${endIndexInPage} 部影片...`)
      
      // 發送 API 請求獲取 description
      const descriptions = await fetchVideoDescriptions(chunk)
      
      // 遍歷每個影片，提取原直播 ID 並查找 UUID
      const updates: Array<{ video_id: string; related_stream_id: string }> = []
      let batchMatched = 0
      let batchSkipped = 0
      
      for (const videoId of chunk) {
        totalProcessed++
        const description = descriptions.get(videoId)
        
        // 提取原直播 ID（支援 YouTube 和 Twitch）
        const sourceInfo = extractSourceVideoId(description)
        if (sourceInfo) {
          batchMatched++
          totalMatched++
          
          // 查找對應的 stream UUID（會自動創建空殼 stream）
          const streamId = await findStreamIdByVideoId(sourceInfo)
          if (streamId) {
            updates.push({ video_id: videoId, related_stream_id: streamId })
          } else {
            console.log(`    ⚠️ 找不到 stream UUID (source: ${sourceInfo.platform}://${sourceInfo.id})`)
            totalErrors++
          }
        } else {
          // 無法從 description 中提取 sourceVideoId
          // 為了避免重複處理，我們可以選擇：
          // 1. 跳過（下次執行時仍會被查詢出來）
          // 2. 創建一個特殊的空殼 stream 來標記（但這可能不太合理）
          // 目前選擇跳過，但記錄統計
          batchSkipped++
          totalSkipped++
        }
      }
      
      // 批量更新 videos 表
      if (updates.length > 0) {
        console.log(`    ✅ 成功萃取 ${batchMatched} 個關聯，準備更新 ${updates.length} 筆記錄...`)
        
        // 逐筆更新 videos 表（因為 Supabase 的批量更新可能有限制，且需要精確匹配 id）
        // 注意：videos 表的 id 就是 YouTube Video ID（不是 UUID）
        let batchUpdated = 0
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('videos')
            .update({ related_stream_id: update.related_stream_id })
            .eq('id', update.video_id)
          
          if (updateError) {
            console.warn(`    ⚠️ 更新失敗 (video_id: ${update.video_id}): ${updateError.message}`)
            totalErrors++
          } else {
            batchUpdated++
            totalUpdated++
          }
        }
        
        console.log(`    🎉 成功更新 ${batchUpdated}/${updates.length} 筆記錄！`)
      } else {
        console.log(`    ⚠️ 本批次未找到任何關聯`)
      }
      
      if (batchSkipped > 0) {
        console.log(`    ⚠️ 本批次有 ${batchSkipped} 筆無法匹配（description 中沒有 URL）`)
      }
      
      // 輸出當前進度
      const processedInPage = totalProcessed - pageStartProcessed
      console.log(`    📊 本分頁進度：${processedInPage}/${orphanVideos.length} | 累計匹配：${totalMatched} | 累計更新：${totalUpdated} | 累計跳過：${totalSkipped} | 累計錯誤：${totalErrors}`)
      
      // 延遲 0.5 秒，避免 Rate Limit（最後一批不需要延遲）
      if (batchIndex < chunks.length - 1) {
        await delay(500)
      }
    }
    
    // 分頁處理完成，輸出本分頁統計
    const pageProcessed = totalProcessed - pageStartProcessed
    const pageMatched = totalMatched - pageStartMatched
    const pageUpdated = totalUpdated - pageStartUpdated
    console.log(`\n  ✅ [分頁 ${pageNumber}] 處理完成！`)
    console.log(`  📊 本分頁統計：處理 ${pageProcessed} 筆 | 匹配 ${pageMatched} 個 | 更新 ${pageUpdated} 筆`)
    
    // 如果本分頁查詢到的記錄數少於 PAGE_SIZE，代表已經是最後一頁
    if (orphanVideos.length < PAGE_SIZE) {
      console.log(`\n✅ 已處理完所有記錄！本分頁記錄數少於 ${PAGE_SIZE}，結束循環。`)
      break
    }
    
    // 分頁之間的延遲（避免資料庫壓力）
    await delay(1000)
  }
  
  // 輸出最終統計
  console.log('\n' + '='.repeat(60))
  console.log('✨ 修復完成！')
  console.log('='.repeat(60))
  console.log(`📊 最終統計：`)
  console.log(`  總分頁數：${pageNumber} 頁`)
  console.log(`  總處理數：${totalProcessed} 部影片`)
  console.log(`  成功匹配：${totalMatched} 個關聯`)
  console.log(`  成功更新：${totalUpdated} 筆記錄`)
  console.log(`  無法匹配：${totalSkipped} 筆（description 中沒有 URL）`)
  console.log(`  錯誤數量：${totalErrors} 筆`)
  console.log(`  匹配成功率：${totalProcessed > 0 ? ((totalMatched / totalProcessed) * 100).toFixed(1) : 0}%`)
  console.log(`  更新成功率：${totalProcessed > 0 ? ((totalUpdated / totalProcessed) * 100).toFixed(1) : 0}%`)
  console.log('='.repeat(60))
}

// 執行主函數
fixHistoryClips()
  .then(() => {
    console.log('\n✅ 腳本執行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 腳本執行失敗:', error)
    process.exit(1)
  })

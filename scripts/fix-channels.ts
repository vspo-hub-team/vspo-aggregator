/**
 * fix-channels.ts
 * * 一次性專用腳本：強制更新所有烤肉頻道的頭像和訂閱數
 * * 使用方法：
 * npx tsx scripts/fix-channels.ts
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
  console.error('❌ 錯誤：缺少 SUPABASE_URL 環境變數')
  process.exit(1)
}

if (!youtubeApiKey) {
  console.error('❌ 錯誤：缺少 YOUTUBE_API_KEY 環境變數')
  process.exit(1)
}

// 初始化 Supabase Client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

interface Clipper {
  id: number
  name: string
  channel_id: string
  avatar_url: string | null
  subscriber_count: number | null
}

/**
 * 從 YouTube API 獲取頻道資料（頭像和訂閱數）
 */
async function fetchChannelData(channelId: string) {
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/channels`)
    url.searchParams.set('part', 'snippet,statistics')
    url.searchParams.set('id', channelId)
    url.searchParams.set('key', youtubeApiKey!)
    
    const res = await fetch(url.toString())
    
    if (!res.ok) {
      let errorData: any = null
      try {
        const errorText = await res.text()
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText, status: res.status, statusText: res.statusText }
        }
      } catch (parseError) {
        errorData = { status: res.status, statusText: res.statusText, parseError: '無法讀取錯誤內容' }
      }
      
      console.error(`  ❌ 頻道資料失敗: HTTP ${res.status} ${res.statusText}`)
      console.error('詳細錯誤內容:', JSON.stringify(errorData, null, 2))
      return { avatarUrl: null, subscriberCount: null }
    }

    const data = await res.json()
    
    if (data.items?.length > 0) {
      const ch = data.items[0]
      const avatarUrl = ch.snippet?.thumbnails?.high?.url || ch.snippet?.thumbnails?.default?.url || null
      const subscriberCount = ch.statistics?.subscriberCount && !ch.statistics.hiddenSubscriberCount 
        ? parseInt(ch.statistics.subscriberCount, 10) 
        : null
      return { avatarUrl, subscriberCount }
    }
    return { avatarUrl: null, subscriberCount: null }
  } catch (e) {
    console.error(`  ❌ 頻道資料失敗 ${channelId}:`, e)
    return { avatarUrl: null, subscriberCount: null }
  }
}

async function fixChannels() {
  console.log('🚀 開始更新所有烤肉頻道的頭像和訂閱數...\n')

  // 1. 從 Supabase 獲取所有頻道
  const { data: clippers, error: fetchError } = await supabase
    .from('clippers')
    .select('id, name, channel_id, avatar_url, subscriber_count')
    .order('id', { ascending: true })

  if (fetchError) {
    console.error('❌ 獲取頻道資料失敗:', fetchError.message)
    process.exit(1)
  }

  if (!clippers || clippers.length === 0) {
    console.log('⚠️ 沒有找到任何頻道')
    return
  }

  console.log(`📋 找到 ${clippers.length} 個頻道，開始更新...\n`)

  let successCount = 0
  let failCount = 0

  // 2. 遍歷每個頻道
  for (let i = 0; i < clippers.length; i++) {
    const clipper = clippers[i] as Clipper
    const progress = `[${i + 1}/${clippers.length}]`

    console.log(`${progress} 🔍 更新 ${clipper.name}...`)

    try {
      // 3. 呼叫 YouTube API 獲取頻道資料
      const { avatarUrl, subscriberCount } = await fetchChannelData(clipper.channel_id)

      // 4. 準備更新資料
      const updateData: any = {}
      if (avatarUrl) {
        updateData.avatar_url = avatarUrl
      }
      if (subscriberCount !== null) {
        updateData.subscriber_count = subscriberCount
        console.log(`  📈 訂閱: ${subscriberCount.toLocaleString()}`)
      }

      // 5. 更新資料庫
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('clippers')
          .update(updateData)
          .eq('id', clipper.id)

        if (updateError) {
          console.error(`  ❌ 更新失敗: ${updateError.message}`)
          failCount++
        } else {
          console.log(`  ✅ 更新成功`)
          successCount++
        }
      } else {
        console.log(`  ⚠️ 沒有資料可更新`)
        failCount++
      }

    } catch (err) {
      console.error(`  ❌ 處理失敗:`, err)
      failCount++
    }

    // 避免 API 配額過快消耗，每次請求間隔 200ms
    if (i < clippers.length - 1) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  // 6. 顯示總結
  console.log('\n' + '='.repeat(60))
  console.log('📊 更新總結')
  console.log('='.repeat(60))
  console.log(`✅ 成功: ${successCount} 個頻道`)
  console.log(`❌ 失敗: ${failCount} 個頻道`)
  console.log(`📝 總計: ${clippers.length} 個頻道`)
  console.log('='.repeat(60))
  console.log('\n✨ 更新完成！')
}

// 執行腳本
fixChannels()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 腳本執行失敗:', error)
    process.exit(1)
  })

/**
 * clean-non-vspo.ts
 * 
 * 安全清理腳本：清理資料庫中不符合 VSPO 相關的精華影片
 * 
 * 功能：
 * 1. 從資料庫撈出所有 clipper_id 不為 null 的精華影片
 * 2. 使用「兩道防線邏輯」（僅檢查標題）檢查每一部影片
 * 3. 將不符合的影片整理成列表
 * 4. Dry Run 模式：只列出準備刪除的影片，不實際刪除
 * 5. 正式模式：真正刪除不符合的影片
 * 
 * 使用方法：
 * npx tsx scripts/clean-non-vspo.ts
 * 
 * 注意：預設為 Dry Run 模式，請先檢查名單後再將 DRY_RUN 改為 false
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// 載入環境變數
config({ path: resolve(process.cwd(), '.env.local') })

// 環境變數檢查
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ 錯誤：缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 環境變數')
  process.exit(1)
}

// 初始化 Supabase Client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// ===== 設定區 =====
const DRY_RUN = false // 預設為模擬模式，改為 false 才會真正刪除

/**
 * 安全過濾邏輯：檢查影片是否符合 VSPO 相關（僅檢查標題）
 * 使用最嚴格的比對邏輯，避免誤殺和遺漏
 */
function isVSPORelated(title: string, members: any[]): boolean {
  if (!title) return false
  const t = title.toLowerCase()

  // 1. 強制寫死的通用關鍵字
  const keywords = ['ぶいすぽ', 'vspo', 'ビタースイート']
  for (const k of keywords) {
    if (t.includes(k.toLowerCase())) return true
  }

  // 2. 暱稱與常見組合名 (新增 おれあぽ, 橘 等)
  const nicknames = [
    'うるは', 'とと', 'ととち', 'すみれ', 'すーちゃん', 'なずな', 'なずぴ', 
    'のあ', 'ひなの', 'ひなーの', '橘', 'おれあぽ', 'れん', 'れんくん', 'みみ', 'セナ', 
    'リサ', 'きゅぴ', 'べに', 'エマ', 'るな', 'つな', 'ねこたつ', 
    'らむね', 'めと', 'めたん', 'あかり', 'んご', 'くろむ', 'こかげ', 
    'ゆうひ', 'はなび', 'もか', 'サイネ', 'ツナ'
  ]
  for (const n of nicknames) {
    if (t.includes(n.toLowerCase())) return true
  }

  // 3. 資料庫成員名單 (防呆：確保去除所有空白再比對)
  if (members && members.length > 0) {
    for (const m of members) {
      const jp = m.name_jp ? m.name_jp.replace(/\s+/g, '').toLowerCase() : ''
      const zh = m.name_zh ? m.name_zh.replace(/\s+/g, '').toLowerCase() : ''
      if ((jp && t.includes(jp)) || (zh && t.includes(zh))) {
        return true
      }
    }
  }

  return false
}

async function cleanNonVSPOVideos() {
  console.log('🚀 開始清理非 VSPO 相關的精華影片...\n')
  
  if (DRY_RUN) {
    console.log('⚠️ 目前為 Dry Run 模式（模擬模式），不會真正刪除資料')
    console.log('   如需正式刪除，請將腳本中的 DRY_RUN 改為 false\n')
  } else {
    console.log('⚠️⚠️⚠️ 正式刪除模式已啟用！將真正刪除不符合的影片！\n')
  }

  // 1. 獲取所有成員名字列表
  console.log('📋 正在獲取成員列表...')
  const { data: allMembers, error: membersError } = await supabase
    .from('members')
    .select('name_jp, name_zh')
  
  if (membersError) {
    console.error('❌ 獲取成員列表失敗:', membersError.message)
    process.exit(1)
  }

  const memberNames = (allMembers || []).map(m => ({
    name_jp: m.name_jp,
    name_zh: m.name_zh
  }))
  console.log(`✅ 已獲取 ${memberNames.length} 位成員的名字\n`)

  // 2. 從資料庫分批撈出所有 clipper_id 不為 null 的精華影片（分頁獲取）
  console.log('📋 正在分批查詢所有精華影片 (每次 1000 筆)...')
  let allVideos: Array<{ id: string; title: string | null; clipper_id: number }> = []
  let hasMore = true
  let start = 0
  const limit = 1000

  while (hasMore) {
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('id, title, clipper_id')
      .not('clipper_id', 'is', null)
      .range(start, start + limit - 1)
    
    if (videosError) {
      console.error('❌ 查詢影片失敗:', videosError.message)
      process.exit(1)
    }
    
    if (videos && videos.length > 0) {
      allVideos.push(...videos)
      start += limit
      console.log(`  📥 已撈取 ${allVideos.length} 部影片...`)
    }
    
    // 如果回傳的數量少於 limit，代表已經抓到底了
    if (!videos || videos.length < limit) {
      hasMore = false
    }
  }

  console.log(`✅ 成功撈取共 ${allVideos.length} 部精華影片！準備開始檢查...\n`)

  if (allVideos.length === 0) {
    console.log('✅ 資料庫中沒有精華影片，無需清理')
    return
  }

  // 3. 使用「兩道防線邏輯」（僅檢查標題）檢查每一部影片
  console.log('🔍 正在檢查每一部影片...')
  const nonVSPOVideos: Array<{ id: string; title: string; clipper_id: number }> = []

  for (let i = 0; i < allVideos.length; i++) {
    const video = allVideos[i]
    const title = video.title || '無標題'

    // 檢查是否符合 VSPO 相關（僅檢查標題）
    const isRelated = isVSPORelated(title, memberNames)
    
    if (!isRelated) {
      nonVSPOVideos.push({
        id: video.id,
        title,
        clipper_id: video.clipper_id as number
      })
    }

    // 顯示進度
    if ((i + 1) % 100 === 0 || i === allVideos.length - 1) {
      console.log(`  已檢查 ${i + 1}/${allVideos.length} 部影片...`)
    }
  }

  console.log(`\n✅ 檢查完成\n`)

  // 4. 顯示結果
  if (nonVSPOVideos.length === 0) {
    console.log('✨ 所有影片都符合 VSPO 相關，無需清理！')
    return
  }

  console.log(`⚠️ 準備刪除的非 VSPO 影片名單（共 ${nonVSPOVideos.length} 部）：\n`)
  console.log('='.repeat(80))
  
  for (let i = 0; i < nonVSPOVideos.length; i++) {
    const video = nonVSPOVideos[i]
    console.log(`${i + 1}. [${video.id}] ${video.title}`)
  }
  
  console.log('='.repeat(80))
  console.log(`\n總計：${nonVSPOVideos.length} 部影片\n`)

  // 5. 根據 DRY_RUN 模式決定是否刪除
  if (DRY_RUN) {
    console.log('💡 目前為 Dry Run 模式，未執行實際刪除')
    console.log('   如需正式刪除，請將腳本中的 DRY_RUN 改為 false 後重新執行')
  } else {
    // --- 安全備份機制 ---
    if (nonVSPOVideos.length > 0) {
      // 使用時間戳記命名，避免覆蓋舊檔案
      const backupFileName = `deleted_videos_backup_${Date.now()}.json`
      fs.writeFileSync(backupFileName, JSON.stringify(nonVSPOVideos, null, 2), 'utf-8')
      console.log(`\n💾 【安全備份】已將 ${nonVSPOVideos.length} 部準備刪除的影片資料完整備份至：${backupFileName}！`)
    }
    // --------------------
    
    console.log('🗑️  開始刪除不符合的影片...')
    
    // 批次刪除（每 50 筆）
    const BATCH_SIZE = 50
    let deletedCount = 0
    
    for (let i = 0; i < nonVSPOVideos.length; i += BATCH_SIZE) {
      const batch = nonVSPOVideos.slice(i, i + BATCH_SIZE)
      const videoIds = batch.map(v => v.id)
      
      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .in('id', videoIds)
      
      if (deleteError) {
        console.error(`  ❌ 刪除批次 ${Math.floor(i / BATCH_SIZE) + 1} 時發生錯誤:`, deleteError.message)
      } else {
        deletedCount += batch.length
        console.log(`  ✅ 已刪除 ${deletedCount}/${nonVSPOVideos.length} 部影片...`)
      }
    }
    
    console.log(`\n✨ 清理完成！共刪除 ${deletedCount} 部非 VSPO 相關影片`)
  }
}

cleanNonVSPOVideos()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 腳本執行失敗:', error)
    process.exit(1)
  })

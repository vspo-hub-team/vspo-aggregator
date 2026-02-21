/**
 * seed-twitch-ids.ts
 * 
 * 更新成員的 Twitch User ID
 * 
 * 功能：
 * 1. 使用 Twitch API 的 Get Users 接口，根據 login name 獲取 user_id
 * 2. 更新 Supabase members 表的 twitch_user_id 欄位
 * 
 * 使用方法：
 * npx tsx scripts/seed-twitch-ids.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// 載入 .env.local 檔案
config({ path: resolve(process.cwd(), '.env.local') })

// 環境變數檢查
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const twitchClientId = process.env.TWITCH_CLIENT_ID
const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ 錯誤：缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 環境變數')
  process.exit(1)
}

if (!twitchClientId || !twitchClientSecret) {
  console.error('❌ 錯誤：缺少 TWITCH_CLIENT_ID 或 TWITCH_CLIENT_SECRET 環境變數')
  process.exit(1)
}

// 初始化 Supabase Client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const TWITCH_API_BASE = 'https://api.twitch.tv/helix'

/**
 * VSPO 成員 Twitch Login Name 清單
 * 格式：{ 成員日文名: Twitch login name }
 * 注意：Key 必須與 Supabase members 表的 name_jp 欄位完全一致
 */
const MEMBER_TWITCH_LOGINS: Record<string, string> = {
  // --- Lupinus ---
  '花芽すみれ': 'kagasumire',
  '花芽なずな': 'nazunakaga',
  '一ノ瀬うるは': 'ichinose_uruha',
  // 小雀とと 確認沒有 Twitch，已移除

  // --- Iris ---
  '胡桃のあ': 'kurumi_noa',
  '橘ひなの': 'hinano_tachiba7', 

  // --- Cattleya ---
  '兎咲ミミ': 'tosaki_mimi',      
  '空澄セナ': 'asumisena',        // ✅ 感謝你的確認！無底線
  '英リサ': 'lisahanabusa',

  // --- VGaming (原) ---
  '八雲べに': 'yakumo_beni',
  '小森めと': 'met_komori',

  // --- 2022~2023 加入 ---
  '神成きゅぴ': 'kaminariqpi',    // ✅ 感謝你的確認！無底線
  '猫汰つな': 'tsuna_nekota',
  '紫宮るな': 'shinomiya_runa',   // ✅ 感謝你的確認！Runa且姓在前
  '白波らむね': 'ramune_shiranami',
  '如月れん': 'ren_kisaragi',
  '藍沢エマ': 'ema_aizawa',
  '夢野あかり': 'akarindao',      // ✅ 感謝你的確認！特殊ID

  // --- 2023~2024 加入 ---
  '夜乃くろむ': 'kuromu_yano',
  '紡木こかげ': 'kokage_tsumugi',
  '千燈ゆうひ': 'yuuhi_sendo',
  '銀城サイネ': 'saine_ginjo',
  '龍巻ちせ': 'chise_tatsumaki',
  '甘結もか': 'amayui_moka',

  // --- EN ---
  'Arya Kuroha': 'aryakuroha',
  'Jira Jisaki': 'jirajisaki',
  'Remia Aotsuki': 'remiaaotsuki',
  'Riko Solari': 'rikosolari',
  'Narin Mikure': 'narinmikure',
}

/**
 * 獲取 Twitch Access Token
 */
async function getTwitchAccessToken(): Promise<string | null> {
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: twitchClientId!,
        client_secret: twitchClientSecret!,
        grant_type: 'client_credentials',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Twitch Token 獲取失敗:', errorText)
      return null
    }

    const data: any = await response.json()
    return data.access_token
  } catch (error) {
    console.error('❌ Twitch Token 獲取錯誤:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * 根據 login name 獲取 Twitch User ID
 */
async function getTwitchUserId(login: string, token: string): Promise<string | null> {
  try {
    const url = new URL(`${TWITCH_API_BASE}/users`)
    url.searchParams.set('login', login)

    const response = await fetch(url.toString(), {
      headers: {
        'Client-ID': twitchClientId!,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`  ⚠️ 查詢失敗 (${login}):`, errorText)
      return null
    }

    const data: any = await response.json()
    if (data.data && data.data.length > 0) {
      return data.data[0].id // Twitch user_id (數字字串)
    }

    return null
  } catch (error) {
    console.error(`  ⚠️ 查詢錯誤 (${login}):`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * 主函數
 */
async function seedTwitchIds() {
  console.log('🚀 開始更新成員 Twitch User ID...\n')
  console.log('='.repeat(60))

  try {
    // 1. 獲取 Twitch Access Token
    console.log('🔑 正在獲取 Twitch Access Token...')
    const token = await getTwitchAccessToken()
    if (!token) {
      console.error('❌ 無法獲取 Twitch Access Token，結束執行。')
      process.exit(1)
    }
    console.log('✅ Token 獲取成功\n')

    // 2. 從 Supabase 取得所有成員
    console.log('📋 正在取得成員列表...')
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, name_jp, name_zh, channel_id_twitch, twitch_user_id')

    if (membersError) {
      console.error('❌ 取得成員列表失敗:', membersError.message)
      process.exit(1)
    }

    if (!members || members.length === 0) {
      console.log('⚠️ 沒有找到任何成員，結束執行。')
      return
    }

    console.log(`✅ 找到 ${members.length} 個成員\n`)

    // 3. 遍歷成員並更新 Twitch User ID
    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (let i = 0; i < members.length; i++) {
      const member = members[i]
      const loginName = MEMBER_TWITCH_LOGINS[member.name_jp]

      console.log(`[${i + 1}/${members.length}] 👤 ${member.name_jp} (${member.name_zh})`)

      // 如果沒有對應的 login name，跳過
      if (!loginName) {
        console.log(`  ⏭️  跳過：未找到 Twitch login name`)
        skipCount++
        continue
      }

      // 如果已經有 twitch_user_id，詢問是否要更新
      if (member.twitch_user_id) {
        console.log(`  ℹ️  已有 twitch_user_id: ${member.twitch_user_id}`)
        // 可以選擇跳過或強制更新，這裡選擇跳過
        skipCount++
        continue
      }

      // 獲取 Twitch User ID
      const userId = await getTwitchUserId(loginName, token)
      if (!userId) {
        console.log(`  ❌ 無法獲取 User ID`)
        errorCount++
        continue
      }

      // 更新資料庫
      const { error: updateError } = await supabase
        .from('members')
        .update({ twitch_user_id: userId })
        .eq('id', member.id)

      if (updateError) {
        console.error(`  ❌ 更新失敗:`, updateError.message)
        errorCount++
      } else {
        console.log(`  ✅ 更新成功: ${userId}`)
        successCount++
      }

      // 延遲避免 API 限流
      if (i < members.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    // 4. 總結
    console.log('\n' + '='.repeat(60))
    console.log('✨ 更新完成！')
    console.log(`📊 統計：`)
    console.log(`   ✅ 成功：${successCount} 個成員`)
    console.log(`   ⏭️  跳過：${skipCount} 個成員`)
    if (errorCount > 0) {
      console.log(`   ❌ 錯誤：${errorCount} 個成員`)
    }
  } catch (error) {
    console.error('\n❌ 執行失敗:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// 執行主函數
seedTwitchIds()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 未預期的錯誤:', error)
    process.exit(1)
  })

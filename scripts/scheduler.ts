import { spawn } from 'child_process'
import path from 'path'

// 取得當前 Node.js 執行檔的路徑 (這樣最準確)
const nodeExecutable = process.execPath

async function runScript(scriptName: string, args: string[] = []) {
  return new Promise<void>((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', scriptName)
    const prefix = `[${scriptName.replace('.ts', '')}]`

    console.log(`${prefix} 🚀 啟動...`)

    // 關鍵修改：不使用 npx，改用 node 直接執行
    // 等同於指令: node --import tsx scripts/xxx.ts
    const child = spawn(nodeExecutable, [
      '--no-warnings',  // 隱藏雜訊
      '--import', 'tsx', // 載入 tsx 模組來讀取 TypeScript
      scriptPath, 
      ...args
    ], {
      stdio: 'inherit', // 讓子程序的 log 直接輸出到主程序
      shell: false      // ❌ 關閉 shell 模式 (這就是解決 Windows 崩潰的關鍵)
    })

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`${prefix} ✅ 完成`)
        resolve()
      } else {
        console.error(`${prefix} ❌ 失敗 code=${code}`)
        // 這裡我們不 reject，讓排程器繼續跑下一個任務，不要崩潰
        resolve() 
      }
    })

    child.on('error', (err) => {
      console.error(`${prefix} ❌ 啟動錯誤: ${err.message}`)
      resolve()
    })
  })
}

async function startSchedule() {
  console.log(`\n🕒 [排程] 開始執行 YouTube 與 Twitch 抓取... ${new Date().toLocaleString()}`)
  console.log('='.repeat(60))

  // 並發執行 YouTube 和 Twitch 抓取
  const [youtubeResult, twitchResult] = await Promise.allSettled([
    // YouTube 抓取任務（包含 update-all 和 enrich-videos）
    (async () => {
      try {
        console.log('📺 [YouTube] 開始執行...')
        // 1. 執行 update-all
        await runScript('update-all.ts')
        // 2. 執行 enrich-videos (單次模式)
        await runScript('enrich-videos.ts', ['--once'])
        console.log('✅ [YouTube] 抓取完成')
      } catch (error) {
        console.error('❌ [YouTube] 抓取發生錯誤:', error instanceof Error ? error.message : error)
        throw error // 重新拋出以便 Promise.allSettled 捕獲
      }
    })(),
    
    // Twitch 抓取任務
    (async () => {
      try {
        console.log('🟣 [Twitch] 開始執行...')
        await runScript('fetch-twitch.ts')
        console.log('✅ [Twitch] 抓取完成')
      } catch (error) {
        console.error('❌ [Twitch] 抓取發生錯誤:', error instanceof Error ? error.message : error)
        throw error // 重新拋出以便 Promise.allSettled 捕獲
      }
    })(),
  ])

  // 檢查執行結果
  if (youtubeResult.status === 'rejected') {
    console.error('⚠️ [YouTube] 任務執行失敗，但不影響其他任務')
  }
  if (twitchResult.status === 'rejected') {
    console.error('⚠️ [Twitch] 任務執行失敗，但不影響其他任務')
  }

  console.log('='.repeat(60))
  console.log('✅ [排程] 雙平台抓取完成')

  // 計算下次執行時間 (15分鐘後)
  const nextRun = new Date(Date.now() + 15 * 60 * 1000)
  console.log(`💤 休息中，下次更新於 15 分鐘後... (${nextRun.toLocaleString()})\n`)
}

// 啟動排程
startSchedule()

// 設定每 15 分鐘執行一次
setInterval(startSchedule, 15 * 60 * 1000)
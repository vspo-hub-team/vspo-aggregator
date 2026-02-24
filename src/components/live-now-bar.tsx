'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Member } from '@/types/database'

interface LiveNowBarProps {
  members: Member[]
}

interface TooltipPosition {
  x: number
  y: number
}

// 定義直播項目類型（用於渲染）
interface LiveItem {
  member: Member
  platform: 'youtube' | 'twitch'
  isLive: boolean
  isUpcoming: boolean
}

export function LiveNowBar({ members }: LiveNowBarProps) {
  // State: 紀錄目前滑鼠移到了哪個直播項目
  const [hoveredItem, setHoveredItem] = useState<LiveItem | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ x: 0, y: 0 })

  // 構建直播項目列表（支援雙平台同時直播）
  // 如果成員在兩個平台都在直播，會產生兩個項目
  const liveItems: LiveItem[] = []
  
  for (const member of members) {
    // 檢查 YouTube 直播狀態
    const hasYouTubeLive = member.live_status === 'live' || member.live_status === 'upcoming'
    // 檢查 Twitch 直播狀態
    const hasTwitchLive = member.live_status_twitch === 'live' || member.live_status_twitch === 'upcoming'
    
    if (hasYouTubeLive) {
      liveItems.push({
        member,
        platform: 'youtube',
        isLive: member.live_status === 'live',
        isUpcoming: member.live_status === 'upcoming'
      })
    }
    
    if (hasTwitchLive) {
      liveItems.push({
        member,
        platform: 'twitch',
        isLive: member.live_status_twitch === 'live',
        isUpcoming: member.live_status_twitch === 'upcoming'
      })
    }
  }

  // 排序：
  // 1. 第一順位：isLive === true 的項目
  // 2. 第二順位：isUpcoming === true 的項目，按 live_start_time 由早到晚排序
  const sortedItems = [...liveItems].sort((a, b) => {
    // 如果 a 是 live，b 是 upcoming，a 排在前面
    if (a.isLive && b.isUpcoming) {
      return -1
    }
    // 如果 a 是 upcoming，b 是 live，b 排在前面
    if (a.isUpcoming && b.isLive) {
      return 1
    }
    // 如果兩者都是 upcoming，按 live_start_time 由早到晚排序
    if (a.isUpcoming && b.isUpcoming) {
      const aTime = a.platform === 'youtube' ? a.member.live_start_time : a.member.live_start_time_twitch
      const bTime = b.platform === 'youtube' ? b.member.live_start_time : b.member.live_start_time_twitch
      if (!aTime && !bTime) return 0
      if (!aTime) return 1 // 沒有時間的排在後面
      if (!bTime) return -1
      return new Date(aTime).getTime() - new Date(bTime).getTime()
    }
    // 如果兩者都是 live，保持原順序
    return 0
  })

  // 空狀態處理：如果沒有任何直播項目，顯示提示訊息
  if (sortedItems.length === 0) {
    return (
      <div className="relative z-50 mb-6 rounded-xl border border-gray-700/30 bg-gray-900/80 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-center p-6">
          <p className="text-gray-400 text-sm md:text-base">目前無直播預定</p>
        </div>
      </div>
    )
  }

  // 處理滑鼠進入事件
  const handleMouseEnter = (item: LiveItem, event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    // 計算 Tooltip 應該出現的位置 (頭像正下方中心)
    // x: 頭像中心點的水平位置
    // y: 頭像底部 + 間距
    const x = rect.left + rect.width / 2
    const y = rect.bottom + 8 // 8px 間距 (mt-2)
    setTooltipPos({ x, y })
    setHoveredItem(item)
  }

  // 處理滑鼠離開事件
  const handleMouseLeave = () => {
    setHoveredItem(null)
  }

  // 判斷是否有 Twitch 直播（用於決定容器邊框顏色）
  const hasTwitchLive = sortedItems.some(item => item.platform === 'twitch' && item.isLive)
  // 判斷是否有 YouTube 直播
  const hasYouTubeLive = sortedItems.some(item => item.platform === 'youtube' && item.isLive)
  // 如果同時有兩種平台，優先顯示 Twitch 的紫色；否則根據實際情況顯示
  const containerBorderColor = hasTwitchLive
    ? 'border-purple-500/30'
    : hasYouTubeLive
      ? 'border-red-500/30'
      : 'border-red-500/30' // 預設紅色（待機室）

  return (
    <>
      <div className={`relative z-50 mb-6 rounded-xl border ${containerBorderColor} bg-gray-900/80 backdrop-blur-md shadow-lg`}>
        <div className="flex flex-nowrap items-start gap-4 overflow-x-auto p-4 pb-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* 左側標題 */}
          <div className="flex-shrink-0 flex items-center gap-2 px-2 md:px-3 pt-2">
            <span className="text-xl md:text-2xl animate-pulse">🔴</span>
            <span className="text-base md:text-lg font-bold text-white whitespace-nowrap">
              LIVE NOW
            </span>
          </div>

          {/* 直播項目列表（支援雙平台同時直播） */}
          <div className="flex flex-nowrap items-start gap-3 md:gap-4">
            {sortedItems.map((item, index) => (
              <LiveMemberItem
                key={`${item.member.id}-${item.platform}-${index}`}
                item={item}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 懸浮預覽視窗 (使用 Fixed Positioning) */}
      {hoveredItem && (
        <Tooltip
          item={hoveredItem}
          position={tooltipPos}
          onMouseLeave={handleMouseLeave}
        />
      )}
    </>
  )
}

interface LiveMemberItemProps {
  item: LiveItem
  onMouseEnter: (item: LiveItem, event: React.MouseEvent<HTMLDivElement>) => void
  onMouseLeave: () => void
}

function LiveMemberItem({
  item,
  onMouseEnter,
  onMouseLeave,
}: LiveMemberItemProps) {
  const { member, platform, isLive, isUpcoming } = item
  const [imageError, setImageError] = useState(false)

  // Twitch Login Name Mapping（與 member-card.tsx 和 member/[id]/page.tsx 保持一致）
  const TWITCH_LOGINS: Record<string, string> = {
    '花芽すみれ': 'kagasumire',
    '花芽なずな': 'nazunakaga',
    '一ノ瀬うるは': 'ichinose_uruha',
    '胡桃のあ': 'kurumi_noa',
    '橘ひなの': 'hinano_tachiba7',
    '兎咲ミミ': 'tosaki_mimi',
    '空澄セナ': 'asumisena',
    '英リサ': 'lisahanabusa',
    '八雲べに': 'yakumo_beni',
    '小森めと': 'met_komori',
    '神成きゅぴ': 'kaminariqpi',
    '猫汰つな': 'tsuna_nekota',
    '紫宮るな': 'shinomiya_runa',
    '白波らむね': 'ramune_shiranami',
    '如月れん': 'ren_kisaragi',
    '藍沢エマ': 'ema_aizawa',
    '夢野あかり': 'akarindao',
    '夜乃くろむ': 'kuromu_yano',
    '紡木こかげ': 'kokage_tsumugi',
    '千燈ゆうひ': 'yuuhi_sendo',
    '銀城サイネ': 'saine_ginjo',
    '龍巻ちせ': 'chise_tatsumaki',
    '甘結もか': 'amayui_moka',
    'Arya Kuroha': 'aryakuroha',
    'Jira Jisaki': 'jirajisaki',
    'Remia Aotsuki': 'remiaaotsuki',
    'Riko Solari': 'rikosolari',
    'Narin Mikure': 'narinmikure',
  }

  const color = member.color_hex || '#888888'
  const isTwitchLive = platform === 'twitch' && isLive
  const isYouTubeLive = platform === 'youtube' && isLive

  // 根據平台獲取對應的直播資訊
  const liveTitle = platform === 'youtube' ? member.live_title : member.live_title_twitch
  const liveThumbnail = platform === 'youtube' ? member.live_thumbnail : member.live_thumbnail_twitch
  const liveVideoId = platform === 'youtube' ? member.live_video_id : member.live_video_id_twitch
  const liveStartTime = platform === 'youtube' ? member.live_start_time : member.live_start_time_twitch

  // 決定點擊後的連結
  let linkUrl = '#'
  if (isLive || isUpcoming) {
    if (platform === 'twitch' && member.channel_id_twitch) {
      // Twitch 直播（優先）
      const twitchLogin = TWITCH_LOGINS[member.name_jp] || TWITCH_LOGINS[member.name_zh] || member.channel_id_twitch
      linkUrl = `https://www.twitch.tv/${twitchLogin}`
    } else if (platform === 'youtube' && liveVideoId) {
      // YouTube 直播或待機室
      linkUrl = `https://www.youtube.com/watch?v=${liveVideoId}`
    } else if (platform === 'youtube' && member.channel_id_yt) {
      // 備用：YouTube 頻道首頁
      linkUrl = `https://www.youtube.com/channel/${member.channel_id_yt}`
    }
  } else if (member.channel_id_yt) {
    // 非直播狀態，導向 YouTube 頻道首頁
    linkUrl = `https://www.youtube.com/channel/${member.channel_id_yt}`
  }

  // 根據平台決定顏色
  const liveColor = isTwitchLive
    ? '#9146FF' // Twitch 品牌色
    : isYouTubeLive
      ? '#ff2d2d' // YouTube 紅色
      : '#9ca3af' // 待機室灰色

  // 判斷是否為「準備中」狀態：upcoming 且時間已過預定開台時間
  const isPreparing = isUpcoming && 
    liveStartTime && 
    new Date(liveStartTime).getTime() <= Date.now()

  // 格式化開始時間 (HH:mm)
  const formatStartTime = () => {
    if (!liveStartTime) return null
    try {
      return format(new Date(liveStartTime), 'HH:mm', { locale: zhTW })
    } catch {
      return null
    }
  }

  const startTime = formatStartTime()

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center gap-2 relative"
      onMouseEnter={(e) => onMouseEnter(item, e)}
      onMouseLeave={onMouseLeave}
    >
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-2 cursor-pointer transition-transform hover:scale-110"
      >
        {/* 圓形頭像 */}
        <div className="relative">
          {/* 準備中的微弱紅點 (如果 upcoming 且時間已過) */}
          {isPreparing && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500/60 rounded-full animate-pulse z-10" 
                 title="準備中..." />
          )}
          
          {/* 優先使用 member.avatar_url，如果為空或載入失敗才顯示電視機佔位符 */}
          {member.avatar_url && !imageError ? (
            <img
              src={member.avatar_url}
              alt={member.name_jp}
              className={`w-14 h-14 md:w-16 md:h-16 object-cover rounded-full border-2 ${
                isLive ? 'animate-pulse' : ''
              } ${isUpcoming ? 'grayscale' : ''} ${
                isTwitchLive ? 'ring-2 ring-purple-500 border-purple-500/50' : ''
              }`}
              style={{
                borderColor: isLive ? liveColor : isUpcoming ? '#9ca3af' : '#888888',
                boxShadow: isLive
                  ? isTwitchLive
                    ? '0 0 15px rgba(168, 85, 247, 0.5), 0 0 5px rgba(168, 85, 247, 0.5)'
                    : `0 0 15px ${liveColor}, 0 0 5px ${liveColor}`
                  : isUpcoming
                    ? '0 0 10px #9ca3af, 0 0 3px #9ca3af'
                    : 'none',
              }}
              onError={() => {
                setImageError(true)
              }}
            />
          ) : (
            <div
              className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center border-2 text-xl md:text-2xl ${
                isUpcoming ? 'grayscale' : ''
              } ${isTwitchLive ? 'ring-2 ring-purple-500 border-purple-500/50' : ''}`}
              style={{
                backgroundColor: `${color}20`,
                borderColor: isLive ? liveColor : isUpcoming ? '#9ca3af' : '#888888',
                boxShadow: isLive
                  ? isTwitchLive
                    ? '0 0 15px rgba(168, 85, 247, 0.5), 0 0 5px rgba(168, 85, 247, 0.5)'
                    : `0 0 15px ${liveColor}, 0 0 5px ${liveColor}`
                  : isUpcoming
                    ? '0 0 10px #9ca3af, 0 0 3px #9ca3af'
                    : 'none',
              }}
            >
              📺
            </div>
          )}
        </div>

        {/* 名字或時間 */}
        <div className="text-center min-w-[60px]">
          {isUpcoming && startTime ? (
            <p className="text-[10px] md:text-xs font-semibold text-gray-300 whitespace-nowrap">
              {startTime}
            </p>
          ) : (
            <p className="text-[10px] md:text-xs font-semibold text-white whitespace-nowrap truncate">
              {member.name_jp}
            </p>
          )}
        </div>
      </a>
    </div>
  )
}

interface TooltipProps {
  item: LiveItem
  position: TooltipPosition
  onMouseLeave: () => void
}

function Tooltip({ item, position, onMouseLeave }: TooltipProps) {
  const { member, platform, isLive, isUpcoming } = item
  // Twitch Login Name Mapping（與 member-card.tsx 和 member/[id]/page.tsx 保持一致）
  const TWITCH_LOGINS: Record<string, string> = {
    '花芽すみれ': 'kagasumire',
    '花芽なずな': 'nazunakaga',
    '一ノ瀬うるは': 'ichinose_uruha',
    '胡桃のあ': 'kurumi_noa',
    '橘ひなの': 'hinano_tachiba7',
    '兎咲ミミ': 'tosaki_mimi',
    '空澄セナ': 'asumisena',
    '英リサ': 'lisahanabusa',
    '八雲べに': 'yakumo_beni',
    '小森めと': 'met_komori',
    '神成きゅぴ': 'kaminariqpi',
    '猫汰つな': 'tsuna_nekota',
    '紫宮るな': 'shinomiya_runa',
    '白波らむね': 'ramune_shiranami',
    '如月れん': 'ren_kisaragi',
    '藍沢エマ': 'ema_aizawa',
    '夢野あかり': 'akarindao',
    '夜乃くろむ': 'kuromu_yano',
    '紡木こかげ': 'kokage_tsumugi',
    '千燈ゆうひ': 'yuuhi_sendo',
    '銀城サイネ': 'saine_ginjo',
    '龍巻ちせ': 'chise_tatsumaki',
    '甘結もか': 'amayui_moka',
    'Arya Kuroha': 'aryakuroha',
    'Jira Jisaki': 'jirajisaki',
    'Remia Aotsuki': 'remiaaotsuki',
    'Riko Solari': 'rikosolari',
    'Narin Mikure': 'narinmikure',
  }

  const isTwitchLive = platform === 'twitch' && isLive
  const isYouTubeLive = platform === 'youtube' && isLive

  // 根據平台獲取對應的直播資訊
  const liveTitle = platform === 'youtube' ? member.live_title : member.live_title_twitch
  const liveThumbnail = platform === 'youtube' ? member.live_thumbnail : member.live_thumbnail_twitch
  const liveVideoId = platform === 'youtube' ? member.live_video_id : member.live_video_id_twitch

  // 決定點擊後的連結
  let linkUrl = '#'
  if (isLive || isUpcoming) {
    if (platform === 'twitch' && member.channel_id_twitch) {
      // Twitch 直播（優先）
      const twitchLogin = TWITCH_LOGINS[member.name_jp] || TWITCH_LOGINS[member.name_zh] || member.channel_id_twitch
      linkUrl = `https://www.twitch.tv/${twitchLogin}`
    } else if (platform === 'youtube' && liveVideoId) {
      // YouTube 直播或待機室
      linkUrl = `https://www.youtube.com/watch?v=${liveVideoId}`
    } else if (platform === 'youtube' && member.channel_id_yt) {
      // 備用：YouTube 頻道首頁
      linkUrl = `https://www.youtube.com/channel/${member.channel_id_yt}`
    }
  } else if (member.channel_id_yt) {
    // 非直播狀態，導向 YouTube 頻道首頁
    linkUrl = `https://www.youtube.com/channel/${member.channel_id_yt}`
  }

  // 根據平台決定按鈕顏色
  const buttonColor = isTwitchLive
    ? '#9146FF' // Twitch 品牌色
    : isYouTubeLive
      ? '#ff2d2d' // YouTube 紅色
      : '#ff2d2d' // 預設紅色

  return (
    <a
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed z-[9999] w-[200px] md:w-[240px] bg-black/90 rounded-lg overflow-hidden shadow-2xl pointer-events-auto transition-opacity duration-300"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)', // 置中對齊
      }}
      onMouseLeave={onMouseLeave}
    >
      {/* 直播縮圖 (16:9 比例) */}
      {liveThumbnail && (
        <div className="relative w-full aspect-video overflow-hidden">
          <img
            src={liveThumbnail}
            alt={liveTitle || 'Live thumbnail'}
            className={`w-full h-full object-cover ${isUpcoming ? 'grayscale' : ''}`}
            onError={(e) => {
              // 處理圖片載入失敗（例如 Twitch 403 錯誤）
              const target = e.target as HTMLImageElement
              target.src = 'https://placehold.co/640x400/1a1a1a/ffffff?text=No+Image'
            }}
          />
        </div>
      )}

      {/* 內容區域 */}
      <div className="p-3 space-y-2">
        {/* 直播標題 (限制 2 行) */}
        {liveTitle && (
          <p className="text-sm text-white font-medium line-clamp-2 leading-snug">
            {liveTitle}
          </p>
        )}

        {/* 底部標籤 */}
        <div className="flex items-center justify-center pt-1">
          {isLive ? (
            <span
              className={`px-3 py-1 text-white text-xs font-bold rounded-full ${
                isTwitchLive ? 'bg-purple-600' : isYouTubeLive ? 'bg-red-600' : ''
              }`}
              style={!isTwitchLive && !isYouTubeLive ? { backgroundColor: buttonColor } : undefined}
            >
              WATCH NOW
            </span>
          ) : isUpcoming ? (
            <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
              COMING SOON
            </span>
          ) : (
            <span
              className={`px-3 py-1 text-white text-xs font-bold rounded-full ${
                isTwitchLive ? 'bg-purple-600' : isYouTubeLive ? 'bg-red-600' : ''
              }`}
              style={!isTwitchLive && !isYouTubeLive ? { backgroundColor: buttonColor } : undefined}
            >
              ON AIR
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

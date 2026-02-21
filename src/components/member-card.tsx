'use client'

import { useState, useEffect } from 'react'
import { Member } from '@/types/database'

interface MemberCardProps {
  member: Member
}

export function MemberCard({ member }: MemberCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imgSrc, setImgSrc] = useState<string>(member.avatar_url || '')

  // 當 member 資料改變時，重置圖片狀態
  useEffect(() => {
    setImgSrc(member.avatar_url || '')
    setImageError(false)
  }, [member.avatar_url])

  const color = member.color_hex || '#888888'

  // 決定邊框顏色：直播中用紅色(#ff2d2d)，否則用成員代表色
  const borderColor = member.is_live ? '#ff2d2d' : color

  // 決定陰影顏色：直播中陰影更強烈
  const shadowStyle = member.is_live
    ? `0 0 15px ${borderColor}, 0 0 5px ${borderColor}`
    : `0 0 10px ${color}40`

  // Twitch Login Name Mapping（與 member/[id]/page.tsx 保持一致）
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

  // 決定點擊後的連結
  // 優先級：YouTube 直播影片 > Twitch 直播頻道 > YouTube 頻道首頁
  let linkUrl = '#'
  if (member.is_live) {
    if (member.live_video_id) {
      // YouTube 直播或待機室
      linkUrl = `https://www.youtube.com/watch?v=${member.live_video_id}`
    } else if (member.channel_id_twitch) {
      // Twitch 直播（live_video_id 為 null 且 channel_id_twitch 存在）
      const twitchLogin = TWITCH_LOGINS[member.name_jp] || TWITCH_LOGINS[member.name_zh] || member.channel_id_twitch
      linkUrl = `https://www.twitch.tv/${twitchLogin}`
    } else if (member.channel_id_yt) {
      // 備用：YouTube 頻道首頁
      linkUrl = `https://www.youtube.com/channel/${member.channel_id_yt}`
    }
  } else if (member.channel_id_yt) {
    // 非直播狀態，導向 YouTube 頻道首頁
    linkUrl = `https://www.youtube.com/channel/${member.channel_id_yt}`
  }

  // 判斷是直播中還是待機室
  const isUpcoming = member.is_live && member.live_title && !member.live_video_id?.includes('live')
  const statusLabel = isUpcoming ? 'COMING SOON' : 'ON AIR'

  // 判斷是否為「準備中」狀態：upcoming 且時間已過預定開台時間
  const isPreparing = member.live_status === 'upcoming' && 
    member.live_start_time && 
    new Date(member.live_start_time).getTime() <= Date.now()

  return (
    <a
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block group relative"
    >
      <div
        className="relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 bg-gray-900/50 backdrop-blur-sm group-hover:scale-105 group-hover:-translate-y-1"
        style={{
          borderColor: borderColor,
          boxShadow: shadowStyle,
        }}
      >
        {/* 直播中的紅色標籤 (絕對定位在右上角) */}
        {member.is_live && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#ff2d2d] text-white text-xs font-bold rounded animate-pulse z-10">
            LIVE
          </div>
        )}

        {/* 準備中的微弱紅點 (如果 upcoming 且時間已過) */}
        {isPreparing && (
          <div className="absolute top-2 right-2 w-2 h-2 bg-red-500/60 rounded-full animate-pulse z-10" 
               title="準備中..." />
        )}

        {/* 頭像區域 */}
        <div className="relative w-24 h-24 mb-3">
          {imgSrc && !imageError ? (
            <img
              src={imgSrc}
              alt={member.name_jp}
              className={`w-full h-full object-cover rounded-full border-2 ${
                member.is_live ? 'animate-pulse' : ''
              }`}
              style={{ borderColor: borderColor }}
              onError={() => {
                setImageError(true)
                setImgSrc('')
              }}
            />
          ) : (
            <div
              className="w-full h-full rounded-full flex items-center justify-center border-2 text-3xl"
              style={{
                backgroundColor: `${color}20`,
                borderColor: color,
              }}
            >
              📺
            </div>
          )}
        </div>

        {/* 名字區域 */}
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-gray-100 group-hover:text-white transition-colors">
            {member.name_jp}
          </h3>
          <p className="text-sm text-gray-400 font-medium">{member.name_zh}</p>
        </div>

        {/* 懸浮預覽 (Hover Preview) */}
        {member.is_live && (member.live_title || member.live_thumbnail) && (
          <div className="absolute inset-0 bg-black/90 rounded-xl p-4 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center z-20">
            {/* 直播縮圖 */}
            {member.live_thumbnail && (
              <div className="w-full max-w-[200px] mb-3 rounded-lg overflow-hidden">
                <img
                  src={member.live_thumbnail}
                  alt={member.live_title || 'Live thumbnail'}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            {/* 狀態標籤 */}
            <span className="text-[#ff2d2d] font-bold text-xs mb-2 tracking-widest">
              {statusLabel}
            </span>

            {/* 直播標題 */}
            {member.live_title && (
              <p className="text-sm text-white font-medium line-clamp-3 leading-relaxed mb-3">
                {member.live_title}
              </p>
            )}

            {/* 點擊提示 */}
            <div className="px-3 py-1 border border-[#ff2d2d] text-[#ff2d2d] text-xs rounded-full">
              點擊觀看
            </div>
          </div>
        )}
      </div>
    </a>
  )
}

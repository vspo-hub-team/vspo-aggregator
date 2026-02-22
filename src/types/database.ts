// Database types matching Supabase schema

export interface Member {
  id: string // UUID
  name_jp: string
  name_zh: string
  channel_id_yt: string | null
  channel_id_twitch: string | null
  color_hex: string | null
  avatar_url: string | null
  is_live: boolean
  last_live_at: string | null // ISO timestamp
  live_video_id: string | null // 直播/待機室影片 ID
  live_title: string | null // 直播/待機室標題
  live_thumbnail: string | null // 直播/待機室縮圖
  live_status: 'live' | 'upcoming' | 'none' | null // 直播狀態
  live_start_time: string | null // 待機室的預定開始時間 (ISO timestamp)
}

export interface TranslateChannel {
  id: string // UUID
  channel_id: string
  channel_name: string
  is_banned: boolean
  last_scraped_at: string | null // ISO timestamp
}

export interface Clipper {
  id: number // BIGINT
  name: string // 烤肉頻道名稱
  lang: 'ja' | 'zh' // 語言：ja=日文, zh=中文
  avatar_url: string | null // 頻道頭像
  channel_id: string // YouTube channel ID
  videos?: Video[] // 關聯的影片（用於查詢最新影片）
}

export interface Stream {
  id: string // UUID
  video_id: string
  platform: 'youtube' | 'twitch' | 'bilibili'
  title: string | null
  published_at: string | null // ISO timestamp
  member_id: string | null // UUID reference to members
}

export interface Clip {
  id: string // UUID
  video_id: string
  title: string
  thumbnail_url: string | null
  published_at: string | null // ISO timestamp
  duration_sec: number | null
  view_count: number | null
  channel_id: string | null // UUID reference to translate_channels
  related_stream_id: string | null // UUID reference to streams
  is_shorts: boolean
  translate_channels?: TranslateChannel | null
}

export interface StreamWithMember extends Stream {
  members?: Member | null
}

export interface Video {
  id: string // UUID (主鍵，實際上是 YouTube Video ID)
  video_id: string // YouTube Video ID (UNIQUE)
  channel_id: string | null // YouTube/Twitch Channel ID
  member_id: string | null // UUID reference to members
  clipper_id: number | null // BIGINT reference to clippers (烤肉頻道)
  platform: 'youtube' | 'twitch' | 'bilibili' | null // 影片來源平台
  title: string
  thumbnail_url: string | null
  published_at: string | null // ISO timestamp
  view_count: number | null
  concurrent_viewers: number | null // 即時觀看人數（直播中）
  video_type: 'live' | 'upcoming' | 'archive' | 'video' | 'short' | null
  duration_sec: number | null
  created_at: string | null // ISO timestamp
  updated_at: string | null // ISO timestamp
  members?: Member | null // 關聯的成員資料
  clipper?: Clipper | null // 關聯的烤肉頻道資料
}

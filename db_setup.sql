-- Step 1: Reset & Setup Schema
-- 警告：這會清空現有的 streams, clips, members 表
DROP TABLE IF EXISTS clips CASCADE;
DROP TABLE IF EXISTS streams CASCADE;
DROP TABLE IF EXISTS translate_channels CASCADE;
DROP TABLE IF EXISTS members CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 成員資料表
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_jp TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  channel_id_yt TEXT UNIQUE,
  channel_id_twitch TEXT UNIQUE,
  color_hex TEXT,
  avatar_url TEXT,
  is_live BOOLEAN DEFAULT false,
  last_live_at TIMESTAMPTZ
);

-- 2. 翻譯頻道白名單
CREATE TABLE translate_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id TEXT UNIQUE NOT NULL,
  channel_name TEXT NOT NULL,
  is_banned BOOLEAN DEFAULT false,
  last_scraped_at TIMESTAMPTZ
);

-- 3. 直播存檔表
CREATE TABLE streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id TEXT UNIQUE NOT NULL,
  platform TEXT CHECK (platform IN ('youtube', 'twitch', 'bilibili')),
  title TEXT,
  published_at TIMESTAMPTZ,
  member_id UUID REFERENCES members(id)
);

-- 4. 精華影片表
CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  duration_sec INTEGER,
  view_count BIGINT,
  channel_id UUID REFERENCES translate_channels(id),
  related_stream_id UUID REFERENCES streams(id),
  is_shorts BOOLEAN DEFAULT false
);
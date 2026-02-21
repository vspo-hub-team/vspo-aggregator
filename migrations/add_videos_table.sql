-- Migration: Add videos table for storing all YouTube videos
-- Execute this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id TEXT UNIQUE NOT NULL, -- YouTube Video ID
  member_id UUID REFERENCES members(id),
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  view_count BIGINT,
  video_type TEXT CHECK (video_type IN ('live', 'upcoming', 'archive', 'video', 'short')), -- 影片類型
  duration_sec INTEGER, -- 影片時長（秒）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_videos_member_id ON videos(member_id);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_video_type ON videos(video_type);

-- Add comments for documentation
COMMENT ON TABLE videos IS '儲存所有 YouTube 影片資料（包含直播、待機室、存檔、一般影片）';
COMMENT ON COLUMN videos.video_type IS '影片類型：live=直播中, upcoming=待機室, archive=直播存檔, video=一般影片, short=Shorts';

-- Migration: Add platform column to videos table
-- Execute this in your Supabase SQL Editor
--
-- 說明：
-- - platform: 影片來源平台（youtube, twitch, bilibili）

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS platform TEXT CHECK (platform IN ('youtube', 'twitch', 'bilibili')) DEFAULT 'youtube';

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_videos_platform ON videos(platform);

-- Add comments for documentation
COMMENT ON COLUMN videos.platform IS '影片來源平台：youtube=YouTube, twitch=Twitch, bilibili=Bilibili';

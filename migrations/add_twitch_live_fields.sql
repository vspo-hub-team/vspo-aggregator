-- Migration: Add independent Twitch live streaming fields to members table
-- This allows members to have separate live status for YouTube and Twitch
-- Execute this in your Supabase SQL Editor

ALTER TABLE members
ADD COLUMN IF NOT EXISTS is_live_twitch BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS live_status_twitch TEXT CHECK (live_status_twitch IN ('live', 'upcoming', 'none')) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS live_video_id_twitch TEXT,
ADD COLUMN IF NOT EXISTS live_title_twitch TEXT,
ADD COLUMN IF NOT EXISTS live_thumbnail_twitch TEXT,
ADD COLUMN IF NOT EXISTS live_start_time_twitch TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_live_at_twitch TIMESTAMPTZ;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_members_live_status_twitch ON members(live_status_twitch);
CREATE INDEX IF NOT EXISTS idx_members_is_live_twitch ON members(is_live_twitch);

-- Add comments for documentation
COMMENT ON COLUMN members.is_live_twitch IS 'Twitch 直播狀態：true=正在 Twitch 直播';
COMMENT ON COLUMN members.live_status_twitch IS 'Twitch 直播狀態：live=直播中, upcoming=待機室, none=無直播';
COMMENT ON COLUMN members.live_video_id_twitch IS 'Twitch stream ID (通常為 null，因為 Twitch 直播沒有 video_id)';
COMMENT ON COLUMN members.live_title_twitch IS 'Twitch 直播標題';
COMMENT ON COLUMN members.live_thumbnail_twitch IS 'Twitch 直播縮圖 URL';
COMMENT ON COLUMN members.live_start_time_twitch IS 'Twitch 待機室的預定開始時間';
COMMENT ON COLUMN members.last_live_at_twitch IS 'Twitch 最後一次直播時間';

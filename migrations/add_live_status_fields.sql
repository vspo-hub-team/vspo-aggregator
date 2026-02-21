-- Migration: Add live_status and live_start_time fields to members table
-- Execute this in your Supabase SQL Editor

ALTER TABLE members
ADD COLUMN IF NOT EXISTS live_status TEXT CHECK (live_status IN ('live', 'upcoming', 'none')) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS live_start_time TIMESTAMPTZ;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_members_live_status ON members(live_status);

-- Add comments for documentation
COMMENT ON COLUMN members.live_status IS '直播狀態：live=直播中, upcoming=待機室, none=無直播';
COMMENT ON COLUMN members.live_start_time IS '待機室的預定開始時間';

-- Migration: Add live streaming fields to members table
-- Execute this in your Supabase SQL Editor

ALTER TABLE members
ADD COLUMN IF NOT EXISTS live_video_id TEXT,
ADD COLUMN IF NOT EXISTS live_title TEXT,
ADD COLUMN IF NOT EXISTS live_thumbnail TEXT;

-- Add comments for documentation
COMMENT ON COLUMN members.live_video_id IS 'YouTube video ID for live stream or upcoming stream';
COMMENT ON COLUMN members.live_title IS 'Title of the live stream or upcoming stream';
COMMENT ON COLUMN members.live_thumbnail IS 'Thumbnail URL for the live stream or upcoming stream';

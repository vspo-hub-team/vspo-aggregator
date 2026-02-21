-- Migration: Add twitch_user_id column to members table
-- Execute this in your Supabase SQL Editor
--
-- 說明：
-- - twitch_user_id: Twitch API 返回的數字 user_id（用於 API 查詢）
-- - channel_id_twitch: Twitch 頻道的 login name（用於顯示和 URL）

ALTER TABLE members
ADD COLUMN IF NOT EXISTS twitch_user_id TEXT UNIQUE;

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_members_twitch_user_id ON members(twitch_user_id);

-- Add comments for documentation
COMMENT ON COLUMN members.twitch_user_id IS 'Twitch API 返回的 user_id（數字字串），用於 API 查詢';

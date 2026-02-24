-- Migration: Add related_stream_id column to videos table
-- Execute this in your Supabase SQL Editor
--
-- 讓 videos 資料表可以儲存精華影片對應的原直播 stream UUID
-- 這樣可以讓精華影片與原直播建立關聯

-- 添加 related_stream_id 欄位（如果不存在）
ALTER TABLE videos ADD COLUMN IF NOT EXISTS related_stream_id UUID REFERENCES streams(id);

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_videos_related_stream_id ON videos(related_stream_id);

-- Add comments for documentation
COMMENT ON COLUMN videos.related_stream_id IS '精華影片對應的原直播 stream UUID，參考 streams 資料表';

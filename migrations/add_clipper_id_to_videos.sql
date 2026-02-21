-- Migration: Add clipper_id column to videos table
-- Execute this in your Supabase SQL Editor

-- 讓 videos 資料表也可以儲存「烤肉頻道」的 ID
ALTER TABLE videos ADD COLUMN IF NOT EXISTS clipper_id BIGINT REFERENCES clippers(id);

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS videos_clipper_id_idx ON videos(clipper_id);

-- Add comments for documentation
COMMENT ON COLUMN videos.clipper_id IS '烤肉頻道的 ID，參考 clippers 資料表';

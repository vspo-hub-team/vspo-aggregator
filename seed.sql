-- Step 3: Insert Safe Test Data (Optional)
-- 這裡只插入翻譯頻道、直播和精華，不會弄髒成員表

-- 1. 插入翻譯頻道 (這是新的，沒衝突)
INSERT INTO translate_channels (channel_id, channel_name, is_banned, last_scraped_at)
VALUES
  ('UC_CN_CHANNEL_001', 'VSPO中文精華頻道', false, NOW()),
  ('UC_JP_CHANNEL_001', 'VSPO日文精華頻道', false, NOW())
ON CONFLICT (channel_id) DO NOTHING;

-- 2. 插入測試直播 (動態連結到真實成員)
-- 這裡我們用 SQL 語法去 "尋找" 真實的胡桃諾亞和花芽薺的 ID，而不是用寫死的 ID
WITH member_noa AS (SELECT id FROM members WHERE name_jp = '胡桃のあ' LIMIT 1),
     member_nazuna AS (SELECT id FROM members WHERE name_jp = '花芽なずな' LIMIT 1)

INSERT INTO streams (video_id, platform, title, published_at, member_id)
VALUES
  ('TEST_STREAM_001', 'youtube', '【VSPO】胡桃諾亞的測試直播', NOW() - INTERVAL '5 days', (SELECT id FROM member_noa)),
  ('TEST_STREAM_002', 'youtube', '【VSPO】花芽薺的測試直播', NOW() - INTERVAL '3 days', (SELECT id FROM member_nazuna));

-- 3. 插入測試精華 (連結到翻譯頻道)
WITH trans_channel AS (SELECT id FROM translate_channels WHERE channel_id = 'UC_CN_CHANNEL_001' LIMIT 1),
     stream_source AS (SELECT id FROM streams WHERE video_id = 'TEST_STREAM_001' LIMIT 1)

INSERT INTO clips (video_id, title, thumbnail_url, published_at, duration_sec, view_count, channel_id, related_stream_id)
VALUES
  ('TEST_CLIP_001', '【精華】諾亞超可愛瞬間', 'https://via.placeholder.com/640x360', NOW() - INTERVAL '2 days', 180, 50000, (SELECT id FROM trans_channel), (SELECT id FROM stream_source));
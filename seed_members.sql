-- seed_members.sql
-- VSPO Members Seed Data (Fixed 2026.02)
-- 修正點：補上 JP 組與 EN 組之間的連接逗號
-- Execute this script in your Supabase SQL Editor

INSERT INTO members (name_jp, name_zh, color_hex, channel_id_yt, is_live) VALUES

-- ==========================================
-- Lupinus Virtual Games (LVG)
-- ==========================================
('花芽すみれ', '花芽堇', '#7B9CFF', 'UCyLGcqYs7RsBb3L0SJfzVPA', false),
('花芽なずな', '花芽薺', '#FF8FDF', 'UCiMG6VdScBabPhJ1ZtaVmbw', false),
('一ノ瀬うるは', '一之瀨麗', '#4E505F', 'UC5LyYg6cQInm0oXVdNcJAUQ', false),
('小雀とと', '小雀都都', '#FFD97D', 'UCgTzsBEWCbI5IyFH4F9WCIw', false),

-- ==========================================
-- Iris Black Games (IBG)
-- ==========================================
('胡桃のあ', '胡桃諾亞', '#FFB6C1', 'UCIcAj6WkJ8vZ7De72khni-w', false),
('橘ひなの', '橘雛乃', '#BA55D3', 'UCurEA8YoqFwimJcAuSHU05Q', false),
('如月れん', '如月憐', '#800000', 'UCGWa1dMU_sDCaRQjdabsVgg', false),

-- ==========================================
-- Cattleya Regina Games (CRG)
-- ==========================================
('兎咲ミミ', '兔咲彌彌', '#E0B0FF', 'UCnvVG9RbOW3J6Ifqo-zKLiw', false),
('空澄セナ', '空澄賽娜', '#87CEEB', 'UCF_U2GCKHvDzQ2rlOoIYKJQ', false),
('英リサ', '英麗薩', '#FFA500', 'UCurEA8YoqFwimJcAuSHU0MQ', false),

-- ==========================================
-- QT / Other Units
-- ==========================================
('神成きゅぴ', '神成丘比', '#FFD700', 'UCMp55EbT_ZlqiMS3lCj01BQ', false),
('八雲べに', '八雲貝妮', '#3CB371', 'UCckdfYDGrj8Vx7qQmJe2Dwg', false),
('藍沢エマ', '藍澤艾瑪', '#F0E68C', 'UCPkHpLu8ZC1D1D57CUEC8Kg', false),
('紫宮るな', '紫宮露娜', '#9370DB', 'UCD5W21JqNMv_porUOEU6TUQ', false),

-- ==========================================
-- Solo / Recent Waves
-- ==========================================
('猫汰つな', '貓汰月奈', '#FF69B4', 'UCIjdfjcSaEgdjwbfhQK0Adg', false),
('白波らむね', '白波來夢', '#E6E6FA', 'UC61Owu85ANfDiUhqPyaQqag', false),
('小森めと', '小森美特', '#FF4500', 'UCzUNASdzI4PV5SlqtYwAkKQ', false),
('夢野あかり', '夢野阿卡林', '#FF6347', 'UCS5l_Y0oM71I3UChCzGaCwg', false),
('夜乃くろむ', '夜乃庫洛姆', '#4B0082', 'UCX4WL24YEOUYd7qJvzTTwYw', false),
('紡木こかげ', '紡木小景', '#708090', 'UC9p_lqQ0QTmx9TCvL7v577g', false),
('千燈ゆうひ', '千燈夕陽', '#FF8C00', 'UCuAfTYQz5Z71bCNbmghqT6g', false),
('蝶屋はなび', '蝶屋花火', '#FF1493', 'UCL9hJsdk9eQa0IlWbFB2oRg', false),
('甘結もか', '甘結萌花', '#00FF7F', 'UC8vKBjGY2HVfbW9GAmgikWw', false),

-- ==========================================
-- 2026 New Rookies
-- ==========================================
('銀城サイネ', '銀城彩音', '#C0C0C0', 'UC2xXx1m1jeL0W84_0jTg-Yw', false),
('龍巻ちせ', '龍巻知世', '#4682B4', 'UCoW8qQy80mKH0RJTKAK-nNA', false), -- 這裡補上了逗號！

-- ==========================================
-- EN Group (English Branch)
-- ==========================================
('Remia Aotsuki', '青月レミア', '#1E90FF', '@RemiaAotsuki', false),
('Arya Kuroha', '黑刃アリヤ', '#000000', '@AryaKuroha', false),
('Jira Jisaki', '地崎ジラ', '#FF4500', '@jirajisaki', false),
('Narin Mikure', '美暮ナリン', '#FFB6C1', '@narinmikure', false),
('Riko Solari', 'ソラリリコ', '#FFFF00', '@rikosolari', false),
('Eris Suzukami', '涼上エリス', '#800080', '@erissuzukami', false) -- 最後一行不需要逗號

-- 如果 ID 衝突則不做動作 (避免重複插入)
ON CONFLICT (channel_id_yt) 
DO UPDATE SET 
    name_jp = EXCLUDED.name_jp,
    name_zh = EXCLUDED.name_zh,
    color_hex = EXCLUDED.color_hex;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// 載入環境變數
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 錯誤：找不到環境變數。請確認 .env.local 檔案存在且包含 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 整理好的名單 (中文 + 日文)
const newClippers = [
  // === 中文精華片師 ===
  { name: "勇者あああ【切り抜きch】", id: "UC9xEUSRrMWbbb-59IehNv3g", lang: "zh" },
  { name: "宮村出水", id: "UCgu4Qro3kCHTqYOjRLZxo0Q", lang: "zh" },
  { name: "Yuuki【切り抜き】", id: "UCBiATOGgCqf8uoFfX-pZ1gA", lang: "zh" },
  { name: "千夜Chiya", id: "UColeV1H-x8MuVLSAdohTOVQ", lang: "zh" },
  { name: "【Vspo切り抜き 中文烤肉精華】オブですch.", id: "UCelbOLZPbDCb_vyxvznP8vA", lang: "zh" },
  { name: "青色のR", id: "UCIgvpS92srpQrGbXDlc8HFQ", lang: "zh" },
  { name: "夜一", id: "UC8UOwZIZbe6BkqbvRwidVAw", lang: "zh" },
  { name: "れなち【切り抜き】", id: "UCFZ7BPHTgEo5FXuvC9GVY7Q", lang: "zh" },
  { name: "Mega小火龍", id: "UC0XdcEuxl03Pj6Rm7jcHEnw", lang: "zh" },
  { name: "LI喵", id: "UCHTu2VhgTLkmmspsfItxgyA", lang: "zh" },
  { name: "白菜【Daruma&VSPO分店】", id: "UCzqsI2AoNYe2F2WGRYqkEjA", lang: "zh" },
  { name: "イリンの翻訳小部屋", id: "UCWq4bX9UMV1ir3liKRIvCHg", lang: "zh" },
  { name: "猫まる", id: "UCRCgiumla7OhpvsWDVejgIA", lang: "zh" },
  { name: "1kokodayo1", id: "UCz4GIV8wNBsLBzZy2wA2KKw", lang: "zh" },
  { name: "SFDOJO", id: "UCKhhVOFXHoXpF9oVsHOKiQA", lang: "zh" },
  { name: "怎么起ID哎", id: "UCaCf_jrpnxB6eqbA6i2uTFg", lang: "zh" },
  { name: "Sakura Ch. 【Vspo & Vtubers Clips】", id: "UCFcYgPfMZodXqXKfgLCfxXA", lang: "zh" },
  { name: "sony Yu", id: "UCibI94U5KocgrbyY9gx3cIg", lang: "zh" },
  { name: "烤馬鈴薯", id: "UCMK6ii0LL4Ouwq5TQDM-gjA", lang: "zh" },
  { name: "IF_いっふ【切り抜き】", id: "UC7lPYbAxGzvbobFq_JxxftA", lang: "zh" },
  { name: "Teamone", id: "UCON670Zxeoa79MTBUu200hQ", lang: "zh" },
  { name: "せつなの餐車【切り抜き】", id: "UCgg8m0M1jRaZoDllNWuorPQ", lang: "zh" },
  { name: "Vtuber傳教師(Vspo!)", id: "UCGy_n5NeGfeVzravayHk65Q", lang: "zh" },
  { name: "セツ", id: "UCZlwLklcc13UZ2bsJ9MnTUQ", lang: "zh" },
  { name: "屋上の切り抜き屋", id: "UCPfB7gx9yKfzfVirTX77LFA", lang: "zh" },
  { name: "夜一 【VSPO切片】", id: "UC80qPTyrsdHBoq5HRjsqZYw", lang: "zh" },

  // === 日文精華片師 ===
  { name: "さくっと切り抜き", id: "UCpT3Sllqe20dDH2PE9ofmqw", lang: "ja" },
  { name: "小森めと切り抜き", id: "UC_41Vg-saBGcscTzhHEEGKg", lang: "ja" },
  { name: "ぶいすぽ生活PLUS", id: "UC3jDfDIwr8gq3GJCRaypiag", lang: "ja" },
  { name: "ぶいかつ!【ぶいすぽっ!切り抜き】", id: "UCgYEO91NqJiU_Z09-OLoOLQ", lang: "ja" },
  { name: "【ぶいすぽ切り抜き】かーくん", id: "UCQfEh3uubm6ZmNgFm8gr3Bw", lang: "ja" },
  { name: "しゃち【切り抜き】", id: "UClazPKy_ZGGPB1N9gLMgKuA", lang: "ja" },
  { name: "切り抜き魂【ぶいすぽ切り抜き】", id: "UCoJWrkhWBNaIq5nUhywlypg", lang: "ja" },
  { name: "V好きの一般人", id: "UC9yV6UJNPnnwMKLp3elA28A", lang: "ja" },
  { name: "切り抜き堂【ぶいすぽ切り抜き】", id: "UCHdpZuEjd4IPSziap-MDIbQ", lang: "ja" },
  { name: "ぶいミニ", id: "UCTQkwZzasy80bpjIxIdts-A", lang: "ja" },
  { name: "MASAHINA clips", id: "UCO0H1aAySut2v2O-GUkI49w", lang: "ja" },
  { name: "ぶいすぽ暮らし", id: "UCve_e5k_BPNKKZtFaPJDkJQ", lang: "ja" },
  { name: "C君【ぶいすぽ切り抜き】", id: "UCAMqZUgn108BphHwPlBR7mw", lang: "ja" },
  { name: "ご注文は大盛りみみたや丼【切り抜き】", id: "UCX45C4qCsvvWOtHmBzk34pQ", lang: "ja" },
  { name: "まお【ぶいすぽ切り抜き】", id: "UC4kpV3aDs50WK82zOgSLEVQ", lang: "ja" },
  { name: "ぶいぽけっ!", id: "UCeFilDqYMArEK197dV7WyBQ", lang: "ja" },
  { name: "ぶいすぽハイライト【切り抜き】", id: "UCag0iZHAsWKj4llltQUMK4w", lang: "ja" },
  { name: "アロマちゃん", id: "UCXUV78f8UZ5bPzwPUY8jDvg", lang: "ja" },
  { name: "調味料【切り抜き】", id: "UC1EI1O41n3SA-LQRc5XSdvA", lang: "ja" },
  { name: "ガルお2nd【切り抜き】", id: "UCdigakhK9ssCiwpxFo9kX2A", lang: "ja" },
  { name: "切り抜き師ラテ", id: "UCSxBvydKlZavws9EmtATKkA", lang: "ja" },
  { name: "ぶい切り抜き", id: "UCeNIBykO1enyzd4Q6b-cVyA", lang: "ja" },
  { name: "ぶいすぽ切り抜きにゃんこ", id: "UCOizB6qqhzU10djIjuZrXJA", lang: "ja" },
  { name: "かふぇいん", id: "UCt7BjYjNw6WZmrAuwxacKxA", lang: "ja" },
  { name: "ぶいはこ【ぶいすぽ切り抜き】", id: "UCcC2iASzr8hxAlEuSzhBNpg", lang: "ja" },
  { name: "きっとカット", id: "UCFeU34oYiLjgjdwhqgZMv3g", lang: "ja" },
  { name: "ぶいぬきっ!【切り抜き】", id: "UC3N52_4CRdNJVdDHx01P8-g", lang: "ja" },
  { name: "ぶいすぽ推し活 / バタフライ[切り抜き]", id: "UCZqnfXdcaVOiMbImzqpeakQ", lang: "ja" },
  { name: "みんなの日常【ぶいすぽ切り抜き】", id: "UCcWW7kUnuiEeGJzQwNu8HrA", lang: "ja" },
  { name: "ぶいすぽ配達員", id: "UCwo0FoX5I34rW3UuUitBCyA", lang: "ja" },
  { name: "ぶいすぽの切り抜き", id: "UCbAffpeZmYjQp0u4wtNd2rg", lang: "ja" },
  { name: "ぶいすぽ倉庫", id: "UCoM5tr4Uf8qYDe48IOyMLNw", lang: "ja" },
  { name: "ぶいすぽっ!切り抜き館", id: "UC4Ep1Uy6bEk8J049mRI8UWQ", lang: "ja" },
  { name: "シフォンのぶいすぽ更新ch", id: "UCR2fkFG3hbXGPpCph6efTxA", lang: "ja" },
  { name: "ぶい速っ", id: "UCmLqGQls6puZGP-PNAF4qOw", lang: "ja" },
  { name: "ぶいすぽ日記【切り抜き】", id: "UCxHNrkV8HnoTYPjjFZGaVdg", lang: "ja" },
  { name: "もぎっと切り抜きチャンネル", id: "UCNWBvsTlii-Y31hoVpMFa8A", lang: "ja" },
  { name: "なぎとろ【ぶいすぽ切り抜き】", id: "UCSg9ayBGS5LETtW2S-wVLGg", lang: "ja" },
  { name: "VSPOCUT 【ぶいすぽ雑談切り抜き】", id: "UC5sgWuaaSYhG1dTW3p44z7w", lang: "ja" },
  { name: "ぶいしょーろーど", id: "UCu931Vk89ZocjbWHvkUN0wg", lang: "ja" },
  { name: "ぶいすぽらいく【切り抜き】", id: "UClA81yZlurtz5_izuUbXMyw", lang: "ja" },
  { name: "りぐ【ぶいすぽ切り抜き】", id: "UC71I49a-VkRK7neXF2ggmVw", lang: "ja" },
  { name: "V切り抜き隊365【切り抜き担当】", id: "AChMb_Kwe4KtVdY7axU8zJ6g", lang: "ja" },
  { name: "もっちゃん【ぶいすぽっ!切り抜き】", id: "UC271g4wPYn8TTgSuU2NXV_Q", lang: "ja" },
  { name: "雑談きりとり 【ぶいすぽ切り抜き】", id: "UC683iS8H2i3JX3k89DfI3qw", lang: "ja" },
  { name: "ししゃも【手描き切り抜き】", id: "UCwJcqFa_9zDf8GccY3vnO_Q", lang: "ja" },
  { name: "ぶいしあたー【切り抜き】", id: "UCAlIsLV2BGAIo27Vn1rc-JQ", lang: "ja" },
  { name: "笑門来福ch【Vtuber切り抜き君】", id: "UC_zq5o1koPjoumgO4aGxqhw", lang: "ja" },
  { name: "ひなーの【切り抜きch】", id: "UCsRwSwz-hGb9H89TQY6KZzA", lang: "ja" },
  { name: "こもめと劇場", id: "UCJsEjs2ZyhGMrIvAV3fkpLA", lang: "ja" },
  { name: "Vオタクの部屋[Vtuber切り抜き]", id: "UCCOLspvWflq7pWRFGwi9Vfg", lang: "ja" },
  { name: "ふせねことろろ餅(ふせ)", id: "UCy3D410PxSMmke9RKO-L9Fg", lang: "ja" },
  { name: "ぶいカット【ぶいすぽ切り抜き】", id: "UCjVEyZ3dewzP1RBuELuz-IQ", lang: "ja" },
  { name: "推し広め隊", id: "UCng-alQwUZP3XXDqbwpPK6w", lang: "ja" },
  { name: "ぶいぬきなの‼︎】ぶいすぽきりぬきなの‼︎", id: "UCsBbRTlhbHeDdzKxAT0U89Q", lang: "ja" },
  { name: "ぶいクリップ【ぶいすぽっ!切り抜き】", id: "UCW5HEkEbJVKdDekzxHEfagA", lang: "ja" },
  { name: "リンカ【切り抜き】", id: "UCyPU18dNDjFMANNJu963onw", lang: "ja" },
  { name: "ぶいすぽ爆笑まとめ【切り抜き】", id: "UCKowcr9qY2czGGxafLA_8IQ", lang: "ja" },
  { name: "ぶいすぽーん!", id: "UC6THVNFuKuE-KgBLlz1CnAA", lang: "ja" },
  { name: "ぶいすぽオタクの気の向くままに", id: "UCqj032nWZQxulUSb4pcwA0w", lang: "ja" },
  { name: "ぶいすぽタイムズ", id: "UCnqxzgXQDl0v5Zzkh1OX-KQ", lang: "ja" },
  { name: "ぶいすぽクリップ", id: "UCvSrp7pwJoGbRnSY4eRhVLA", lang: "ja" },
  { name: "ぶいろぐ2nd!!", id: "UCZ_Gm9ipdFovmM8Pf9f-_Ww", lang: "ja" },
  { name: "クラウン【切り抜き】", id: "UCwH9u8cS5i6P-ms9Ij_5c3A", lang: "ja" },
  { name: "ぶいすぽ広場【ぶいすぽ切り抜き】", id: "UCHl9Lk_Nene0QbwuJJFdEyQ", lang: "ja" },
  { name: "こもれびとのソーヴァ", id: "UC7Wi9aVOOv--XvusX2whQrw", lang: "ja" },
  { name: "ぶいすぽ食堂【ぶいすぽ切り抜き】", id: "UCavHKBFZioxhDBf4P8IQ_xw", lang: "ja" },
  { name: "ぼんどぉつうしん　【切り抜き】", id: "UCqikn993oZuC7vcy9bPVE5w", lang: "ja" },
  { name: "ぶい博物館【切り抜き】", id: "UCmcaWjd3HNecmp_7ubgXFYw", lang: "ja" },
  { name: "ぶいとくっ!2", id: "UCGZK4lLrDYcOKxmWJIERmjQ", lang: "ja" },
  { name: "あいのん【切り抜き】", id: "UCedJvm0qVUsFiXJ5KIfj-yA", lang: "ja" },
  { name: "ぶいすぽ星放送局【ぶいすぽ切り抜き】", id: "UCW6Tau824RZGEdpp7voGvCQ", lang: "ja" },
  { name: "ぶいすぽtwitch応援課", id: "UCmVhuHYFM_HshlRwhesXeuA", lang: "ja" },
  { name: "ぶい玉手箱【にじさんじ・ぶいすぽ】", id: "UC6JitqZzD5SowjhmMDg6u2g", lang: "ja" },
  { name: "ぶいちゅきっ!!【ぶいすぽ切り抜き】", id: "UC4EQ-N1u5MlmDCVj9t8tHsA", lang: "ja" },
  { name: "チョー(ぶいすぽ切り抜き)", id: "UCqy8AfibWWLtlIvuIbRHOTA", lang: "ja" },
  { name: "渚【ぶいすぽ切り抜きちゃん】", id: "UCiwCmmQcBRHcH20O_A4L-rg", lang: "ja" },
  { name: "紙芝居のねる【VTuber手書き切り抜き】", id: "UCXwX9C8zWo-5kpRnoVqOWUA", lang: "ja" },
  { name: "寿司焼肉炒飯", id: "UCjjXtNsPGqyKB5X-RMWq8mA", lang: "ja" },
  { name: "ぶいすぽ切り抜き部", id: "UC3zUXFjSuh4d5lqAQn2WycA", lang: "ja" },
  { name: "ぶいもに【ぶいすぽ切り抜き】", id: "UCcbKZE6jTVW_SSf1Eokr7yg", lang: "ja" },
  { name: "つむびより【紡木こかげ切り抜き】", id: "UC7jyTOac5Jk5hiWCE8dwtuQ", lang: "ja" },
  { name: "ぶいすぽ倶楽部【切り抜き】", id: "UC2bTmb1UK1gv9rAvjiORRuQ", lang: "ja" },
  { name: "エガスポ", id: "UCisTdBtR0s1t1q4VmPwyHtg", lang: "ja" },
  { name: "ぶいすぽくりっぷ【切り抜き】", id: "UCmO4YwClS4qceFa6Pj2KD6w", lang: "ja" },
  { name: "あかりん伝説永久保存版【ぶいすぽ切り抜き】", id: "UCl_H9O5f_uG-7tSgGKyqhKA", lang: "ja" },
  { name: "V日記", id: "UCoxTPDPTv5zjAGDYBY9VjSw", lang: "ja" },
  { name: "ショコラ【ぶいすぽ切り抜き】", id: "UCiD6MCbGj2webi2JrIJbBGw", lang: "ja" },
  { name: "Vで生きる猫【Vtuber小ネタ・雑学】", id: "UC7TgomjTg0YnXXokfRwccBA", lang: "ja" },
  { name: "にえ | ぶいすぽ切り抜き", id: "UCu8lGHdHvcybn6jAItJxb0Q", lang: "ja" },
  { name: "たいやき【ぶいすぽ切り抜き】", id: "UCxMtLpKehgF1Ryx4X8U79aQ", lang: "ja" },
  { name: "アマール切り抜き", id: "UCdXVFWjOnRSlgaYbILc88Gg", lang: "ja" },
  { name: "おこもりめと【小森めと切り抜き】", id: "UC9JSMKpX-rGjs7k7__mVO5Q", lang: "ja" },
  { name: "儚い応援隊", id: "UCI55wWfnnyFeVioV-6681ow", lang: "ja" },
  { name: "ぶいっ推しch", id: "UCDunWmLIuKlRkrdHahDDwgg", lang: "ja" },
  { name: "切り抜き隊員【切り抜きch】", id: "UCD8CfawZOnzx2wZ8cUue4gg", lang: "ja" },
  { name: "ぶいすぽっ!の名シーン切り抜き", id: "UCQEvBMTEZcP8i6qHdCGFALg", lang: "ja" },
  { name: "272 【ぶいすぽ切り抜き】", id: "UCLNI_djAPvsMFihOFblOhhg", lang: "ja" },
  { name: "ぶいすぽっ 切り抜きch", id: "UC2nSUUo5sug2319yAf1PEsg", lang: "ja" },
  { name: "ぶいすぽ切り抜き計画", id: "UCo2e68YuP_JkQcnz27J-5qA", lang: "ja" },
  { name: "かめ太郎【小森めと切り抜き】", id: "UCMu_VtORBaxSjiP0nLWwTsw", lang: "ja" },
  { name: "春雨♔", id: "UCJ1ScYk0y-RVN7Y3F6hHKMA", lang: "ja" },
  { name: "ちくわ", id: "UCoYhj6atXAec9lknpzCriDw", lang: "ja" },
  { name: "ぶいすぽの日常", id: "UCi5bBoEc2VBADUFlx_ZVuPg", lang: "ja" },
  { name: "平成に取り残されたV達【ぶいすぽ切り抜き】", id: "UCpkIOIjOfzJDekGnKXm1ysw", lang: "ja" },
  { name: "o7【夜乃くろむ切り抜き】", id: "UCQ-U8ZcLSYcco8n5ekAoPpw", lang: "ja" },
  { name: "ぶいすぽ好きのにゃん丸【切り抜き】", id: "UCnmF2fULuEs-sHeAHJQfipg", lang: "ja" },
  { name: "もか練習中【ぶいすぽ切り抜き】", id: "UCcaJD0JrKogQKcViK8jxfZw", lang: "ja" },
  { name: "切り抜き衛星", id: "UCdEVNGf6gS0fY7Psuvulxnw", lang: "ja" },
  { name: "ぶいすぽEN切り抜き & Clips", id: "UCPK8tMKReXvewGOz7d0zS9g", lang: "ja" },
  { name: "ばーちゃる電視台", id: "UC5hvPw_o1lBym3ReHuLTU_g", lang: "ja" },
  { name: "ぶいすぽ切り抜き劇場", id: "UCQtY1paRBZIwu40dB_Ml76g", lang: "ja" },
  { name: "龍巻ちせは狩られない", id: "UC0r-7Ug1w_Xwc4A1t6MseMA", lang: "ja" },
  { name: "猫汰つなのツナ缶2【切り抜きch】", id: "UCGLw-gleKTCScnLrn2uRLVw", lang: "ja" },
  { name: "V切り侍", id: "UCQ42-Go3eZ_-qNa3dyYbs4Q", lang: "ja" },
  { name: "ぶいすぽカタログ", id: "UCPh5BW6cDGcbQex_UNM4JJw", lang: "ja" },
  { name: "ぶいすぽを切り抜く", id: "UC7obfpF2IGwK4-zJ1asqtZw", lang: "ja" },
  { name: "気ままに切り抜きch", id: "UC8Th5YqqrrnXzdOai2LkXqA", lang: "ja" },
  { name: "ぶいすぽ好きの小林さん", id: "UCgitXQvpw38VhIb-SODK0lw", lang: "ja" },
  { name: "ぶいすぽ速報", id: "UC0_zoJAoiwQSMFdMjkGatAQ", lang: "ja" },
  { name: "ぶいすぽパレット  [ぶいすぽ切り抜き]", id: "UC78ZpgFpbA4KyHinPRQ-vcg", lang: "ja" },
  { name: "きりかつ。", id: "UCQjZjJDCufqOGMMa_gAWHAg", lang: "ja" },
  { name: "ぶいすぽLOL部切り抜き", id: "UCtbGeOMjkKUVP7E30EIzggg", lang: "ja" },
  { name: "Reira【ぶいすぽっ!切り抜き】", id: "UCx6UjN2gN_wng2BsxRgp2Bw", lang: "ja" },
  { name: "ピックアップV", id: "UCo_cw8_ZCgouYVG3u_ognwA", lang: "ja" },
  { name: "さじた【切り抜き】", id: "UC8aQVPZUMLEcEnt_Xt-jJAw", lang: "ja" },
  { name: "ぶいすぽ切り抜き", id: "UCxxMQdUxMfCoH8L7zH4NVYA", lang: "ja" },
  { name: "うひぬき【千燈ゆうひ切り抜き】", id: "UC7sjX8lHyqbYAVREGuUrtQg", lang: "ja" },
  { name: "ぶいらぶ(ぶいすぽ切り抜きch)", id: "UC74McegqJfT7yApRbmMawKw", lang: "ja" },
  { name: "ぶいすぽっ応援団【切り抜き】", id: "UCXOE_414xpAd1FFcwEDpikA", lang: "ja" },
  { name: "いちこ【ぶいすぽ切り抜き】", id: "UCBsNQ9CAiZ_9fik4_N0MjPA", lang: "ja" },
  { name: "こっぺ【ぶいすぽっ!切り抜き】", id: "UCkcSaQ4HNn6La58zI_cPsHA", lang: "ja" },
  { name: "ぶいすぽ切り抜き隊", id: "UCDGJlKGFkvxX-4MXSeNHteg", lang: "ja" },
  { name: "ぶいすぽ切り抜き生活! 【切り抜き】", id: "UCAvE0oxOXij8iBwju-DhYVg", lang: "ja" },
  { name: "vspo clips channel", id: "UClp0qdpTqNel_pZ-bROIdGA", lang: "ja" },
  { name: "小上和雄-Ogami Kazuo-", id: "UCMbXZjnda1o_47CnM7W3QIA", lang: "ja" },
  { name: "ぎょざー【切り抜き】", id: "UCFR287ITuyMNMXzGq1UFpOw", lang: "ja" },
  { name: "ちょーむす【切り抜き】", id: "UCWHrk1flKtCDxDjMAMYGidA", lang: "ja" },
  { name: "rinrinz", id: "UCmd7vBobMteK27KIjACdirA", lang: "ja" },
  { name: "まがみchannel【Vtuber切り抜き】", id: "UCnxipU_oJdR5fZZBr2KkWHA", lang: "ja" },
  { name: "からたち【切り抜き】", id: "UCorsBtq36mHPJtl7tVsR90Q", lang: "ja" },
  { name: "切り抜きストレージch", id: "UCcMjlPq3ZEnOu6VIVHauNeQ", lang: "ja" },
  { name: "跳び箱うさぎ[ぶいすぽ切り抜き]", id: "UCrdryR6oBdxtSzR0iRv_Haw", lang: "ja" },
  { name: "V切り抜きch", id: "UC-8zYEQTIXz3IWJ7ovGHjlA", lang: "ja" },
  { name: "ぶいりおっ!", id: "UCDnXu6ZXrBbwOBMWIzTM90Q", lang: "ja" },
  { name: "ぶいのなうわず【切り抜き】", id: "UCNqzS2OTCeu3ifBW2sAu5KQ", lang: "ja" },
  { name: "ぶいすぽ好きのひよこ", id: "UCY52ChlPzGWIF4CzI2SdF4Q", lang: "ja" },
  { name: "ていと【ぶいすぽ切り抜き】", id: "UCUm49VSHtuoasdHYKsMV1kg", lang: "ja" },
  { name: "近所の切り抜き屋", id: "UCZ-g00QUPf2rCCeUQXsyXug", lang: "ja" },
  { name: "英リサの執事【ぶいすぽ切り抜き】", id: "UCtzfsbqiudJb70KEYNawuJQ", lang: "ja" },
  { name: "竜田揚げ【Vtuber切り抜き】", id: "UCTvdpJwbs-9nSuKmQfou1vw", lang: "ja" },
  { name: "ミントスポーツ【ぶいすぽっ!切り抜き】", id: "UC_GKbztZTnRXaVAdhncMQTQ", lang: "ja" },
  { name: "切り抜きルーム【Vカット】", id: "UCmy7VGEr6D-GjlU03clT6cQ", lang: "ja" },
  { name: "切り抜き師_浅葱", id: "UCmMYveiRuO1YN8T1nLEP4lA", lang: "ja" },
  { name: "Vtuberの日常【切り抜き】", id: "UCBrJrmif9S13S32EqqEGxIg", lang: "ja" },
  { name: "ぶいホロ切り抜き隊", id: "UC8keVgrEUEnRRUQ3tABoM_A", lang: "ja" },
  { name: "いいとこ鳥【ぶいすぽ雑学まとめch】", id: "UCSDMf7EBkYZ6M2hWTs9DrlQ", lang: "ja" },
  { name: "ぶいすぽっ 切り抜き亭", id: "UCevgnD1vGWXKdH1jupK1Mkw", lang: "ja" },
  { name: "切り抜きたまごっこ", id: "UCEIN6TENyRBHHi4eDNVqfRg", lang: "ja" },
  { name: "ててて大王", id: "UC6bTWtT1Ai8Z6onYOH-603w", lang: "ja" },
  { name: "フロル【切り抜き】", id: "UC2SB6aumEpACmWjawqp3JSA", lang: "ja" },
  { name: "ぶいのええとこ取り【切り抜き】", id: "UCRmLuC5DGnSa5gH1lkgaBEA", lang: "ja" },
  { name: "ぶいすぽ切り抜きチャンネル", id: "UCoI8pjEPV7AweiVhX3T_MvA", lang: "ja" },
  { name: "ぶい界隈", id: "UCRFqtQ290CfKmqO28YiwxFw", lang: "ja" },
  { name: "きりすぽっ!保管庫【ぶいすぽっ!切り抜き】", id: "UCrNepmbg0_Sk4pEKrum0ZoQ", lang: "ja" },
  { name: "べにくりっぷ【切り抜き】", id: "UCdXRG3piCQ67G-aPH_uxu8w", lang: "ja" },
  { name: "いつもみてるぞ【好きなもの切り抜き】", id: "UCFaj_t3ssfk7zHtX0OZiu8w", lang: "ja" },
  { name: "ぶいの集い", id: "UCbzc-O0J0wR6kRGd-afC5ig", lang: "ja" },
  { name: "ぶいすぽの放課後", id: "UCSjov8hu098djTzQw-QsdfQ", lang: "ja" },
  { name: "はなまる切りチャン", id: "UCIXCZm68OxNyWisRRC4oyjQ", lang: "ja" }
];

async function main() {
  console.log(`🚀 開始導入 ${newClippers.length} 個烤肉頻道...\n`);

  let addedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const clipper of newClippers) {
    try {
      // 先檢查是否已存在
      const { data: existing } = await supabase
        .from('clippers')
        .select('id')
        .eq('channel_id', clipper.id)
        .single();

      if (existing) {
        skippedCount++;
        process.stdout.write('s'); // s = skipped
        continue;
      }

      // 如果不存在，則插入
      const { error } = await supabase
        .from('clippers')
        .insert({
          channel_id: clipper.id,
          name: clipper.name,
          lang: clipper.lang,
          avatar_url: null, // 先留空，等等可以用 update-all 腳本抓
        });

      if (error) {
        console.error(`\n❌ 新增失敗 ${clipper.name}:`, error.message);
        errorCount++;
      } else {
        addedCount++;
        process.stdout.write('.'); // . = added
      }
    } catch (error) {
      console.error(`\n❌ 處理失敗 ${clipper.name}:`, error instanceof Error ? error.message : error);
      errorCount++;
    }
  }

  console.log(`\n\n✅ 導入完成！`);
  console.log(`📊 統計：`);
  console.log(`   ✅ 新增：${addedCount} 個頻道`);
  console.log(`   ⏭️  跳過：${skippedCount} 個頻道（已存在）`);
  if (errorCount > 0) {
    console.log(`   ❌ 錯誤：${errorCount} 個頻道`);
  }
  console.log(`\n💡 提示：請執行 'npx tsx scripts/update-all.ts' 來抓取這些頻道的頭像和影片。`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 腳本執行失敗:', error);
    process.exit(1);
  });

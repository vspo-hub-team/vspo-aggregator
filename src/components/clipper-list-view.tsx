'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Users, PlayCircle, Video, Eye } from 'lucide-react'

// 數字格式化 (例如: 12000 -> 1.2萬)
function formatNumber(num: number | null | undefined): string {
  if (!num || num === 0) return '0'
  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + '億'
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '萬'
  }
  return num.toLocaleString()
}

export function ClipperListView({ lang }: { lang: 'ja' | 'zh' }) {
  const { data: clippers = [], isLoading } = useQuery({
    queryKey: ['clippers', lang],
    queryFn: async () => {
      // 抓取 clipper 及其所有影片 (包含 view_count 和 subscriber_count)
      // 必須包含 related_stream_id 欄位，用於同場直播關聯查詢
      const { data, error } = await supabase
        .from('clippers')
        .select(`
          *,
          videos (
            id,
            related_stream_id,
            title,
            thumbnail_url,
            published_at,
            duration_sec:duration,
            view_count
          )
        `)
        .eq('lang', lang);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      // 處理資料：找出最新影片並排序
      const processed = (data || []).map((clipper: any) => {
        const videos = clipper.videos || [];
        // 確保影片按時間倒序
        const sortedVideos = videos.sort((a: any, b: any) => {
          const timeA = a.published_at ? new Date(a.published_at).getTime() : 0;
          const timeB = b.published_at ? new Date(b.published_at).getTime() : 0;
          return timeB - timeA; // 降序
        });
        return {
          ...clipper,
          latestVideo: sortedVideos[0] || null
        };
      });

      // **關鍵排序：按照最新影片的發布時間降序排列**
      // 有最新影片的頻道排在前面，沒有影片的排在後面
      return processed.sort((a, b) => {
        const timeA = a.latestVideo?.published_at 
          ? new Date(a.latestVideo.published_at).getTime() 
          : 0;
        const timeB = b.latestVideo?.published_at 
          ? new Date(b.latestVideo.published_at).getTime() 
          : 0;
        return timeB - timeA; // 降序 (最新的在前面)
      });
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="bg-gray-900 border-gray-800 p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-gray-700" />
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded mb-2" />
                <div className="h-3 bg-gray-700 rounded w-2/3" />
              </div>
            </div>
            <div className="aspect-video bg-gray-800 rounded-md mb-3" />
            <div className="h-4 bg-gray-700 rounded mb-2" />
            <div className="h-3 bg-gray-700 rounded w-1/2" />
          </Card>
        ))}
      </div>
    );
  }

  if (clippers.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <Video size={48} className="mx-auto mb-4 opacity-50" />
        <p>尚無頻道資料</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clippers.map((clipper) => (
        <Card 
          key={clipper.id} 
          className="bg-gray-900 border-gray-800 p-4 flex flex-col gap-3 group/card hover:border-gray-600 transition-colors"
        >
          {/* 頻道頭部 */}
          <a 
            href={`https://www.youtube.com/channel/${clipper.channel_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar className="h-10 w-10 border border-gray-700 flex-shrink-0">
              <AvatarImage src={clipper.avatar_url || undefined} />
              <AvatarFallback className="bg-gray-700 text-gray-300">
                {clipper.name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-sm md:text-base line-clamp-1">
                {clipper.name}
              </div>
              {/* 訂閱人數顯示 */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                <Users size={12} className="flex-shrink-0" />
                <span className="truncate">
                  {formatNumber(clipper.subscriber_count)} 位訂閱者
                </span>
              </div>
            </div>
          </a>

          {/* 最新影片預覽 */}
          {clipper.latestVideo ? (
            <a 
              href={`https://www.youtube.com/watch?v=${clipper.latestVideo.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-video rounded-md overflow-hidden bg-black block"
            >
              <img 
                src={clipper.latestVideo.thumbnail_url || ''} 
                alt={clipper.latestVideo.title || ''}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-video.png';
                }}
              />
              
              {/* 時間長度 */}
              {clipper.latestVideo.duration_sec && (
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {Math.floor(clipper.latestVideo.duration_sec / 60)}:
                  {(clipper.latestVideo.duration_sec % 60).toString().padStart(2, '0')}
                </div>
              )}

              {/* 播放遮罩 */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg transform scale-90 group-hover:scale-100 transition-all flex items-center gap-1">
                  <PlayCircle size={14} /> 播放
                </div>
              </div>
            </a>
          ) : (
            <div className="aspect-video rounded-md bg-gray-800 flex flex-col items-center justify-center text-gray-500 text-xs gap-2">
              <Video size={24} className="opacity-50" />
              <span>尚無影片</span>
            </div>
          )}
          
          {/* 影片資訊 (標題 + 觀看數 + 時間) */}
          {clipper.latestVideo && (
            <div className="space-y-1.5">
              <a 
                href={`https://www.youtube.com/watch?v=${clipper.latestVideo.id}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-gray-200 line-clamp-2 hover:text-blue-400 transition-colors leading-tight min-h-[38px] block"
              >
                {clipper.latestVideo.title}
              </a>
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                {/* 觀看次數 */}
                <span className="flex items-center gap-1">
                  <Eye size={12} />
                  {formatNumber(clipper.latestVideo.view_count)} 次觀看
                </span>
                {/* 發布時間 */}
                {clipper.latestVideo.published_at && (
                  <span>
                    {formatDistanceToNow(new Date(clipper.latestVideo.published_at), { 
                      addSuffix: true, 
                      locale: zhTW 
                    })}
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

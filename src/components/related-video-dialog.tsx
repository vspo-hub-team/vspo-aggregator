'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Video } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LatestVideoCard } from '@/components/latest-video-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

interface RelatedVideoDialogProps {
  video: Video
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RelatedVideoDialog({ video, open, onOpenChange }: RelatedVideoDialogProps) {
  // 真正的同場直播查詢：通過 streams 和 clips 表建立關聯
  const { data: relatedVideosData, isLoading } = useQuery<{ videos: Video[], isSameStream: boolean }>({
    queryKey: ['related-clips', video.id, video.video_type, video.clipper_id],
    queryFn: async () => {
      let results: Video[] = []
      let isSameStream = false // 標記是否為同場直播的精華

      // ===== 第一順位：同場直播所有剪輯（精準關聯） =====
      try {
        // Debug: 檢查當前影片資料
        console.log('Current Video Data:', video)
        
        // 取得當前影片的 YouTube Video ID
        // 注意：video.id 可能是 UUID，video.video_id 才是 YouTube Video ID
        const currentVideoId = (video as any).video_id || video.id
        console.log('Current Video ID:', currentVideoId)

        // 情況 1：如果點擊的是直播/存檔 (live/archive)
        if (video.video_type === 'live' || video.video_type === 'archive') {
          console.log('Step 1: 開始尋找原直播 ID...', currentVideoId)
          
          // 1. 在 streams 表中找到對應的 stream（通過 video_id 比對，TEXT 型別）
          const { data: streamData, error: streamError } = await supabase
            .from('streams')
            .select('id')
            .eq('video_id', currentVideoId) // video_id 是 TEXT，安全比對
            .maybeSingle()

          if (streamError) {
            console.warn('Step 1 錯誤: 查詢 streams 表失敗', streamError)
          } else {
            console.log('Step 1 結果: streamData =', streamData)
          }

          if (streamData?.id) {
            const streamId = streamData.id // UUID
            console.log('Step 1 成功: 找到 streamId =', streamId)

            // 2. 在 clips 表中找到所有 related_stream_id === streamId 的精華
            console.log('Step 2: 尋找同場精華 IDs (related_stream_id =', streamId, ')...')
            const { data: clipsData, error: clipsError } = await supabase
              .from('clips')
              .select('video_id')
              .eq('related_stream_id', streamId) // UUID 比對，安全
              .order('published_at', { ascending: false })
              .limit(20)

            if (clipsError) {
              console.warn('Step 2 錯誤: 查詢 clips 表失敗', clipsError)
            } else {
              console.log('Step 2 結果: clipsData =', clipsData, '數量:', clipsData?.length || 0)
            }

            if (clipsData && clipsData.length > 0) {
              const clipVideoIds = clipsData.map(c => c.video_id).filter(Boolean)
              console.log('Step 2 成功: 找到精華 Video IDs =', clipVideoIds)

              // 3. 通過 clips.video_id 去 videos 表找對應的影片資料
              // 注意：videos 表中沒有 video_id 欄位，id 就是 YouTube Video ID
              if (clipVideoIds.length > 0) {
                console.log('Step 3: 在 videos 表中查找這些精華影片 (使用 id 欄位)...', clipVideoIds)
                // 使用 id 欄位進行比對（videos.id 就是 YouTube Video ID）
                const { data: videosData, error: videosError } = await supabase
                  .from('videos')
                  .select('id, title, thumbnail_url, member_id, clipper_id, published_at, view_count, video_type, duration_sec, platform, created_at, updated_at')
                  .in('id', clipVideoIds) // 使用 id 欄位比對（videos.id 就是 YouTube Video ID）
                  .not('clipper_id', 'is', null) // 只取精華
                  .order('published_at', { ascending: false })
                  .limit(20)
                
                if (videosError) {
                  console.warn('Step 3 錯誤: 第一順位（同場直播-情況1）videos 查詢錯誤:', videosError)
                } else {
                  console.log('Step 3 成功: 第一順位（同場直播-情況1）找到的影片:', videosData?.length || 0, videosData)
                }

                if (videosData && videosData.length > 0) {
                  // 前端過濾：排除當前影片
                  const filteredVideos = videosData
                    .filter(v => v.id !== video.id)
                    .slice(0, 6)

                  if (filteredVideos.length > 0) {
                    console.log('Step 3 完成: 過濾後的精華影片數量 =', filteredVideos.length)
                    isSameStream = true
                    results = filteredVideos as Video[]
                  } else {
                    console.log('Step 3 警告: 過濾後沒有剩餘的精華影片（可能當前影片就是唯一的精華）')
                  }
                } else {
                  console.log('Step 3 警告: videos 表中找不到對應的精華影片')
                }
              } else {
                console.log('Step 2 警告: clipVideoIds 為空陣列')
              }
            } else {
              console.log('Step 2 警告: clips 表中找不到 related_stream_id =', streamId, '的精華')
            }
          } else {
            console.log('Step 1 警告: streams 表中找不到 video_id =', currentVideoId, '的記錄')
          }
        }
        // 情況 2：如果點擊的是精華（有 clipper_id）
        else if (video.clipper_id) {
          console.log('Step 1 (情況2): 尋找當前精華的 related_stream_id...', currentVideoId)
          
          // 1. 在 clips 表中找到當前精華的記錄（通過 video_id 比對）
          // 注意：clips 表的 id 是 UUID，絕對不能用 YouTube Video ID 去查詢 id 欄位！
          const { data: currentClip, error: currentClipError } = await supabase
            .from('clips')
            .select('id, video_id, related_stream_id')
            .eq('video_id', currentVideoId) // video_id 是 TEXT，安全比對
            .maybeSingle()

          if (currentClipError) {
            console.warn('Step 1 (情況2) 錯誤: 查詢 clips 表失敗', currentClipError)
          } else {
            console.log('Step 1 (情況2) 結果: currentClip =', currentClip)
          }

          if (currentClip?.related_stream_id) {
            const streamId = currentClip.related_stream_id // UUID
            console.log('Step 1 (情況2) 成功: 找到 related_stream_id =', streamId)

            // 2. 在 clips 表中找到所有 related_stream_id === streamId 的其他精華
            console.log('Step 2 (情況2): 尋找同場精華 IDs (related_stream_id =', streamId, ')...')
            const { data: clipsData, error: clipsError } = await supabase
              .from('clips')
              .select('video_id')
              .eq('related_stream_id', streamId) // UUID 比對，安全
              .order('published_at', { ascending: false })
              .limit(20)

            if (clipsError) {
              console.warn('Step 2 (情況2) 錯誤: 查詢 clips 表失敗', clipsError)
            } else {
              console.log('Step 2 (情況2) 結果: clipsData =', clipsData, '數量:', clipsData?.length || 0)
            }

            if (clipsData && clipsData.length > 0) {
              const clipVideoIds = clipsData.map(c => c.video_id).filter(Boolean)
              console.log('Step 2 (情況2) 成功: 找到精華 Video IDs =', clipVideoIds)

              // 3. 通過 clips.video_id 去 videos 表找對應的影片資料
              // 注意：videos 表中沒有 video_id 欄位，id 就是 YouTube Video ID
              if (clipVideoIds.length > 0) {
                console.log('Step 3 (情況2): 在 videos 表中查找這些精華影片 (使用 id 欄位)...', clipVideoIds)
                // 使用 id 欄位進行比對（videos.id 就是 YouTube Video ID）
                const { data: videosData, error: videosError } = await supabase
                  .from('videos')
                  .select('id, title, thumbnail_url, member_id, clipper_id, published_at, view_count, video_type, duration_sec, platform, created_at, updated_at')
                  .in('id', clipVideoIds) // 使用 id 欄位比對（videos.id 就是 YouTube Video ID）
                  .not('clipper_id', 'is', null) // 只取精華
                  .order('published_at', { ascending: false })
                  .limit(20)
                
                if (videosError) {
                  console.warn('Step 3 (情況2) 錯誤: 第一順位（同場直播-情況2）videos 查詢錯誤:', videosError)
                } else {
                  console.log('Step 3 (情況2) 成功: 第一順位（同場直播-情況2）找到的影片:', videosData?.length || 0, videosData)
                }

                if (videosData && videosData.length > 0) {
                  // 前端過濾：排除當前影片
                  const filteredVideos = videosData
                    .filter(v => v.id !== video.id)
                    .slice(0, 6)

                  if (filteredVideos.length > 0) {
                    console.log('Step 3 (情況2) 完成: 過濾後的精華影片數量 =', filteredVideos.length)
                    isSameStream = true
                    results = filteredVideos as Video[]
                  } else {
                    console.log('Step 3 (情況2) 警告: 過濾後沒有剩餘的精華影片（可能當前影片就是唯一的精華）')
                  }
                } else {
                  console.log('Step 3 (情況2) 警告: videos 表中找不到對應的精華影片')
                }
              } else {
                console.log('Step 2 (情況2) 警告: clipVideoIds 為空陣列')
              }
            } else {
              console.log('Step 2 (情況2) 警告: clips 表中找不到 related_stream_id =', streamId, '的其他精華')
            }
          } else {
            console.log('Step 1 (情況2) 警告: clips 表中找不到 video_id =', currentVideoId, '的記錄，或 related_stream_id 為 null')
          }
        }
      } catch (error) {
        console.warn('第一順位（同場直播）查詢失敗:', error)
      }

      // ===== 第二順位：同成員或同頻道推薦（Fallback） =====
      // 確保 member_id 或 clipper_id 確實有值（可能被關聯展開）
      const actualMemberId = video.member_id || (video as any).member?.id
      const actualClipperId = video.clipper_id || (video as any).clipper?.id
      console.log('Actual Member ID:', actualMemberId, 'from video.member_id:', video.member_id, 'from video.member?.id:', (video as any).member?.id)
      console.log('Actual Clipper ID:', actualClipperId, 'from video.clipper_id:', video.clipper_id, 'from video.clipper?.id:', (video as any).clipper?.id)
      
      // 決定查詢的目標欄位與 ID（優先使用 member_id，如果沒有則使用 clipper_id）
      const targetColumn = actualMemberId ? 'member_id' : (actualClipperId ? 'clipper_id' : null)
      const targetId = actualMemberId || actualClipperId
      const targetType = actualMemberId ? '同成員' : (actualClipperId ? '同頻道' : null)
      
      // 防呆：如果兩個 ID 都為 null 或 undefined，跳過查詢
      if (results.length < 3 && targetColumn && targetId) {
        try {
          console.log(`第二順位: 開始查詢${targetType}精華，${targetColumn} =`, targetId)
          // 只查詢基礎欄位
          // 注意：videos 表中 video_type 的值可能是 'video' 或 'short'（小寫），使用不區分大小寫的查詢
          // 使用 .or() 來匹配所有可能的 video_type 值（排除 live/archive/upcoming）
          const { data: videosData, error } = await supabase
            .from('videos')
            .select('id, title, thumbnail_url, member_id, clipper_id, published_at, view_count, video_type, duration_sec, platform, created_at, updated_at')
            .eq(targetColumn, targetId) // 動態使用 member_id 或 clipper_id
            .not('clipper_id', 'is', null) // 只取精華（有 clipper_id）
            // 排除直播、存檔、待機室（使用 .or() 來匹配所有可能的 video_type 值）
            .or('video_type.eq.video,video_type.eq.Video,video_type.eq.VIDEO,video_type.eq.short,video_type.eq.Short,video_type.eq.SHORT,video_type.eq.clip,video_type.eq.Clip,video_type.eq.CLIP')
            .order('published_at', { ascending: false })
            .limit(15) // 多取一些，以便前端過濾後仍有足夠數量
          
          if (error) {
            console.warn('第二順位查詢錯誤:', error)
          } else {
            console.log(`第二順位（${targetType}）找到的影片:`, videosData?.length || 0)
            if (videosData && videosData.length > 0) {
              console.log('第二順位影片詳情:', videosData.map(v => ({ id: v.id, title: v.title, video_type: v.video_type, clipper_id: v.clipper_id })))
            } else {
              console.log('第二順位警告: 查詢成功但沒有找到任何影片。可能原因：')
              console.log(`  - ${targetColumn} 不匹配`)
              console.log('  - 所有影片的 clipper_id 都是 null')
              console.log('  - 所有影片的 video_type 都是 live/archive/upcoming 或其他未匹配的值')
              console.log('  - 嘗試查詢所有 video_type 值來診斷...')
              
              // 診斷查詢：查看該 ID 的所有影片類型
              const { data: diagnosticData } = await supabase
                .from('videos')
                .select('video_type, clipper_id')
                .eq(targetColumn, targetId)
                .limit(20)
              
              if (diagnosticData && diagnosticData.length > 0) {
                console.log('診斷結果: 找到', diagnosticData.length, '部影片')
                const typeCounts = diagnosticData.reduce((acc: any, v: any) => {
                  acc[v.video_type] = (acc[v.video_type] || 0) + 1
                  return acc
                }, {})
                console.log('video_type 分布:', typeCounts)
                const clipperCounts = diagnosticData.reduce((acc: any, v: any) => {
                  acc[v.clipper_id ? '有 clipper_id' : '無 clipper_id'] = (acc[v.clipper_id ? '有 clipper_id' : '無 clipper_id'] || 0) + 1
                  return acc
                }, {})
                console.log('clipper_id 分布:', clipperCounts)
              } else {
                console.log(`診斷結果: 該 ${targetColumn} 沒有任何影片`)
              }
            }
          }

          if (error) {
            console.warn('第二順位查詢錯誤:', error)
          } else if (videosData && videosData.length > 0) {
            // 前端過濾：排除當前影片和已存在的影片
            const existingIds = new Set(results.map(v => v.id))
            const filteredVideos = videosData
              .filter(v => v.id !== video.id && !existingIds.has(v.id))
              .slice(0, 6 - results.length)

            if (filteredVideos.length > 0) {
              // 如果需要關聯資料，再單獨查詢
              const memberIds = [...new Set(filteredVideos.map(v => v.member_id).filter(Boolean))]
              const clipperIds = [...new Set(filteredVideos.map(v => v.clipper_id).filter(Boolean))]

              let membersMap = new Map()
              let clippersMap = new Map()

              if (memberIds.length > 0) {
                const { data: membersData } = await supabase
                  .from('members')
                  .select('*')
                  .in('id', memberIds)
                if (membersData) {
                  membersData.forEach(m => membersMap.set(m.id, m))
                }
              }

              if (clipperIds.length > 0) {
                const { data: clippersData } = await supabase
                  .from('clippers')
                  .select('*')
                  .in('id', clipperIds)
                if (clippersData) {
                  clippersData.forEach(c => clippersMap.set(c.id, c))
                }
              }

              const newVideos = filteredVideos.map((v: any) => ({
                ...v,
                members: membersMap.get(v.member_id) || null,
                clipper: clippersMap.get(v.clipper_id) || null,
              })) as Video[]

              results = [...results, ...newVideos]
            }
          }
        } catch (error) {
          console.warn('第二順位查詢失敗:', error)
        }
      }

      // 確保返回最多 6 部影片
      return { videos: results.slice(0, 6), isSameStream }
    },
    enabled: open, // 對所有影片都查詢
  })

  // 動態標題：根據是否為同場直播切換
  const dialogTitle = relatedVideosData?.isSameStream 
    ? '同場直播所有剪輯' 
    : '相關精華推薦'

  const videos = relatedVideosData?.videos || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </Card>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            暫無相關精華
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {videos.map((relatedVideo) => (
              <LatestVideoCard 
                key={relatedVideo.id} 
                video={relatedVideo} 
                hideRelatedButton={true}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { VideoGrid } from '@/components/video-grid'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ContentTabsProps {
  defaultTab?: string
  memberId?: string | null
}

export function ContentTabs({ defaultTab = 'clips_zh', memberId }: ContentTabsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const currentTab = searchParams.get('tab') || defaultTab

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.push(`/?${params.toString()}`)
  }

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
        <TabsTrigger value="clips_zh">中文精華</TabsTrigger>
        <TabsTrigger value="clips_jp">日文精華</TabsTrigger>
        <TabsTrigger value="archives">直播存檔</TabsTrigger>
      </TabsList>

      <TabsContent value="clips_zh" className="mt-0">
        <VideoGrid type="clips" memberId={memberId} filter="clips_zh" />
      </TabsContent>

      <TabsContent value="clips_jp" className="mt-0">
        <VideoGrid type="clips" memberId={memberId} filter="clips_jp" />
      </TabsContent>

      <TabsContent value="archives" className="mt-0">
        <VideoGrid type="streams" memberId={memberId} filter="archives" />
      </TabsContent>
    </Tabs>
  )
}

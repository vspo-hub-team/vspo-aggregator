'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Github, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileSidebar } from '@/components/sidebar'

export function Navbar() {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdate = async () => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/cron')
      const data = await response.json()
      if (data.success) {
        alert('資料更新成功！')
        // Optionally refresh the page
        window.location.reload()
      } else {
        alert(`更新失敗：${data.error || '未知錯誤'}`)
      }
    } catch (error) {
      alert(`更新失敗：${error instanceof Error ? error.message : '未知錯誤'}`)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Left: Mobile Sidebar Trigger + Site Title */}
        <div className="flex items-center space-x-2">
          <MobileSidebar />
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">VSPO! Aggregator</span>
          </Link>
        </div>

        {/* Center: Navigation Links */}
        <div className="hidden items-center space-x-6 md:flex">
          <Link
            href="/?tab=clips_zh"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            中文精華
          </Link>
          <Link
            href="/?tab=clips_jp"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            日文精華
          </Link>
          <Link
            href="/?tab=archives"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            直播存檔
          </Link>
        </div>

        {/* Right: Update Button + GitHub Icon */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUpdate}
            disabled={isUpdating}
            className="text-xs"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? '更新中...' : '🔄 更新資料'}
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}

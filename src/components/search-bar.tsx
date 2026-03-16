'use client'

import { useState, KeyboardEvent, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SearchBarProps {
  onSearch: (query: string) => void
  onClear: () => void
  searchQuery: string
  debounceMs?: number // 防抖延遲時間（毫秒），預設 400ms
}

export function SearchBar({ onSearch, onClear, searchQuery, debounceMs = 400 }: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery)

  // 同步外部 searchQuery 到本地状态
  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  // 防抖處理：使用 useCallback 確保函數引用穩定
  useEffect(() => {
    // 如果輸入為空，立即清除
    if (!localQuery.trim()) {
      onClear()
      return
    }

    // 設置防抖計時器
    const debounceTimer = setTimeout(() => {
      onSearch(localQuery.trim())
    }, debounceMs)

    // 清理計時器
    return () => {
      clearTimeout(debounceTimer)
    }
  }, [localQuery, debounceMs, onSearch, onClear])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Enter 鍵立即執行搜索，不等待防抖
      const trimmedQuery = localQuery.trim()
      if (trimmedQuery) {
        onSearch(trimmedQuery)
      } else {
        onClear()
      }
    }
  }

  const handleSearch = () => {
    const trimmedQuery = localQuery.trim()
    if (trimmedQuery) {
      onSearch(trimmedQuery)
    } else {
      onClear()
    }
  }

  const handleClear = () => {
    setLocalQuery('')
    onClear()
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto mb-6">
      <div className="relative flex items-center">
        {/* 搜索图标 */}
        <div className="absolute left-4 z-10 pointer-events-none">
          <Search className="h-5 w-5 text-slate-500 dark:text-gray-400" />
        </div>

        {/* 输入框 */}
        <input
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜尋影片標題、頻道名稱或 VTuber 名字..."
          className="w-full pl-12 pr-24 py-3 bg-white dark:bg-gray-900/80 border border-slate-300 dark:border-gray-700 rounded-full 
                     text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 
                     focus:ring-purple-500 focus:border-transparent transition-all
                     backdrop-blur-sm"
        />

        {/* 右侧按钮区域 */}
        <div className="absolute right-2 z-10 flex items-center gap-2">
          {/* 清除按钮（仅在有输入时显示） */}
          {localQuery && (
            <button
              onClick={handleClear}
              className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-gray-700/50 
                         transition-colors"
              aria-label="清除搜尋"
            >
              <X className="h-4 w-4 text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white" />
            </button>
          )}

          {/* 搜索按钮 */}
          <Button
            onClick={handleSearch}
            className="h-8 px-4 bg-purple-600 hover:bg-purple-700 
                       text-white rounded-full text-sm font-medium"
          >
            搜尋
          </Button>
        </div>
      </div>
    </div>
  )
}

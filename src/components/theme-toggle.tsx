'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // 避免 hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        className="w-10 h-10 rounded-full bg-slate-800/50 hover:bg-slate-700/50 transition-all duration-200 flex items-center justify-center"
        aria-label="切換主題"
      >
        <div className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-10 h-10 rounded-full bg-slate-800/50 hover:bg-slate-700/50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 transition-all duration-200 flex items-center justify-center group"
      aria-label="切換主題"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-yellow-400 group-hover:rotate-90 transition-transform duration-300" />
      ) : (
        <Moon className="w-5 h-5 text-slate-300 group-hover:-rotate-12 transition-transform duration-300" />
      )}
    </button>
  )
}

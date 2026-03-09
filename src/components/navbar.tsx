'use client'

import Link from 'next/link'

export function Navbar() {
  return (
    <nav className="flex flex-col items-center justify-center w-full py-10 md:py-14 space-y-6 border-b border-white/5 bg-background">
      {/* 主標題 */}
      <Link href="/" className="flex items-center space-x-2">
        <h1 className="text-4xl md:text-5xl font-black text-cyan-400 tracking-widest drop-shadow-lg">
          VSPO 觀測站
        </h1>
      </Link>

      {/* 分類選單 - 膠囊按鈕 */}
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/?tab=clips_zh"
          className="px-6 py-2.5 rounded-full bg-slate-800 text-gray-200 hover:bg-slate-700 hover:text-white transition-all duration-200 font-medium text-sm md:text-base shadow-sm"
        >
          中文精華
        </Link>
        <Link
          href="/?tab=clips_jp"
          className="px-6 py-2.5 rounded-full bg-slate-800 text-gray-200 hover:bg-slate-700 hover:text-white transition-all duration-200 font-medium text-sm md:text-base shadow-sm"
        >
          日文精華
        </Link>
        <Link
          href="/?tab=archives"
          className="px-6 py-2.5 rounded-full bg-slate-800 text-gray-200 hover:bg-slate-700 hover:text-white transition-all duration-200 font-medium text-sm md:text-base shadow-sm"
        >
          直播存檔
        </Link>
      </div>
    </nav>
  )
}

'use client'

import Link from 'next/link'

export function Navbar() {
  return (
    <nav className="relative overflow-hidden flex flex-col items-center justify-center w-full py-12 md:py-16 border-b border-white/5 bg-background">
      {/* Aurora Glow 背景效果 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 blur-[100px] pointer-events-none -z-10 rounded-full" />

      {/* 主標題與副標題 */}
      <div className="flex flex-col items-center text-center">
        <Link href="/" className="flex items-center space-x-2">
          <h1 className="text-4xl md:text-5xl font-black text-cyan-400 tracking-widest drop-shadow-lg">
            VSPO 觀測站
          </h1>
        </Link>
        <p className="text-slate-400/80 text-xs md:text-sm tracking-[0.3em] font-medium mt-2 text-center">
          ぶいすぽっ！非公式クリップ & アーカイブ
        </p>
      </div>
    </nav>
  )
}

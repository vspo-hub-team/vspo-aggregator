import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 影片縮圖載入失敗時的備用圖（不強制走 proxy，避免錯誤循環） */
export const FALLBACK_VIDEO_THUMBNAIL =
  "https://placehold.co/640x400/1a1a1a/ffffff?text=No+Image"

/**
 * 外部圖片經 wsrv.nl 轉成較小 WebP，減輕 Lighthouse / LCP 負擔。
 * 相對路徑、data/blob、已是 wsrv 或 localhost 則原樣回傳。
 */
export function getOptimizedImageUrl(url: string, width: number = 480): string {
  const trimmed = (url ?? "").trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed
  if (trimmed.includes("wsrv.nl")) return trimmed
  if (!/^https?:\/\//i.test(trimmed)) return trimmed

  try {
    const { hostname } = new URL(trimmed)
    if (hostname === "localhost" || hostname.endsWith(".local")) return trimmed
  } catch {
    return trimmed
  }

  return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&w=${width}&output=webp`
}

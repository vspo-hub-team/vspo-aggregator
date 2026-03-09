import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VSPO 觀測站 | ぶいすぽっ！直播與精華總站",
  description: "VTuber 精華影片與直播聚合平台",
};

// 強制每 60 秒重新驗證，確保使用者看到最新資料
export const revalidate = 60;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Providers>
            <Navbar />
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

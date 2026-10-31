import type { Metadata } from "next";
import "./globals.css";
import { getSiteSettingsCached } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await getSiteSettingsCached();
    return {
      title: s.tab_title || s.name || "资源分享站",
      description: s.description || "",
    };
  } catch {
    return { title: "资源分享站", description: "" };
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let themeVars = "";
  let demoBanner = "";
  try {
    const s = await getSiteSettingsCached();
    const primary = /^#[0-9a-fA-F]{6}$/.test(s.primary_color) ? s.primary_color : "#109b83";
    const accent = /^#[0-9a-fA-F]{6}$/.test(s.accent_color) ? s.accent_color : "#087b6a";
    const button = /^#[0-9a-fA-F]{6}$/.test(s.button_color) ? s.button_color : primary;
    themeVars = `:root{--primary:${primary};--primary-dark:${accent};--button:${button};}`;
  } catch {
    themeVars = "";
  }
  if (!isSupabaseConfigured()) {
    demoBanner =
      '<div class="demo-banner">当前为<b>本地演示模式</b>：数据保存在本机文件中，仅用于体验。配置 Supabase 后自动切换为云端模式（见项目 README）。</div>';
  }
  return (
    <html lang="zh-CN">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeVars }} />
      </head>
      <body>
        {demoBanner && <div dangerouslySetInnerHTML={{ __html: demoBanner }} />}
        {children}
      </body>
    </html>
  );
}

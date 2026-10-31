import Link from "next/link";
import { headers } from "next/headers";
import { requireAdminPage } from "@/lib/auth";
import { getSiteSettings, isSupabaseConfigured } from "@/lib/db";
import { AdminLogoutButton } from "@/components/admin-logout";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 登录页位于 /admin 路由组内，不能被布局守卫重定向回自身（避免 307 死循环）
  const pathname = (await headers()).get("x-pathname") || "";
  const isLoginPage = pathname === "/admin/login" || pathname.startsWith("/admin/login?");
  if (!isLoginPage) {
    await requireAdminPage();
  }
  let settings: Awaited<ReturnType<typeof getSiteSettings>> | null = null;
  try {
    settings = await getSiteSettings();
  } catch {
    settings = null;
  }
  const cloud = isSupabaseConfigured();

  const nav = [
    { href: "/admin", label: "仪表盘", icon: "◉", exact: true },
    { href: "/admin/resources", label: "资源管理", icon: "▤" },
    { href: "/admin/categories", label: "分类管理", icon: "▦" },
    { href: "/admin/submissions", label: "截图提交记录", icon: "▧" },
    { href: "/admin/appearance", label: "网站外观设置", icon: "◐" },
    { href: "/admin/announcements", label: "公告与文案", icon: "✦" },
    { href: "/admin/settings", label: "系统设置", icon: "⚙" },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link href="/admin" className="admin-side-brand">
          <span className="brand-mark">{settings?.logo || "☁"}</span>
          <span>{settings?.name || "资源站"} 后台</span>
        </Link>
        <nav className="admin-nav">
          <div className="nav-label">管理菜单</div>
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={item.exact ? "on" : ""}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-side-foot">
          <Link href="/" style={{ display: "block", marginBottom: 8 }}>
            ← 查看网站前台
          </Link>
          数据存储：
          {cloud ? "Supabase 云端" : "本地演示模式"}
        </div>
      </aside>
      <div className="admin-main">
        <div className="admin-top">
          <div>
            <h1>管理控制台</h1>
            <div className="admin-sub">
              {cloud ? "已连接 Supabase 云端数据" : "本地演示模式 —— 配置 Supabase 后自动切换为云端模式（见 README）"}
            </div>
          </div>
          <div className="admin-top-right">
            <span className={`admin-mode-pill ${cloud ? "cloud" : ""}`}>
              {cloud ? "☁ 云端模式" : "◐ 演示模式"}
            </span>
            <span className="admin-user">管理员</span>
            <AdminLogoutButton />
          </div>
        </div>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}

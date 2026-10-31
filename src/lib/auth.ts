import { cookies, type UnsafeUnwrappedCookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase, isSupabaseConfigured } from "./supabase";
import { demoCheckToken, demoSetToken, demoVerifyPassword } from "./demo-store";

export const ADMIN_COOKIE = "rs_admin";
export const VID_COOKIE = "rs_vid";

/**
 * 演示模式是否允许登录/鉴权。
 * 生产环境默认禁用，避免部署时忘记配置 Supabase 导致默认弱口令后台暴露；
 * 如需在生产临时体验演示模式，可显式设置环境变量 ALLOW_DEMO=1。
 */
function demoModeAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO === "1";
}

/**
 * 读取当前登录管理员邮箱。两种模式：
 * - Supabase 模式：读取会话 → 校验 admin_users 表（RLS 保证只能读到自己）
 * - 演示模式：校验 rs_admin cookie 中的随机 token
 */
export async function getAdminEmail(): Promise<string | null> {
  if (isSupabaseConfigured()) {
    try {
      const sb = createServerSupabase();
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const { data: row } = await sb
        .from("admin_users")
        .select("email")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      return row?.email ?? null;
    } catch {
      return null;
    }
  }
  if (!demoModeAllowed()) return null;
  const token = (cookies() as unknown as UnsafeUnwrappedCookies).get(ADMIN_COOKIE)?.value;
  return demoCheckToken(token) ? "admin@demo.local" : null;
}

/** 路由处理器用：返回管理员邮箱或 null，失败时静默 */
export async function requireAdminApi(): Promise<string | null> {
  try {
    return await getAdminEmail();
  } catch {
    return null;
  }
}

/** 服务端组件/布局用：未登录则重定向到登录页 */
export async function requireAdminPage(): Promise<void> {
  const email = await getAdminEmail();
  if (!email) {
    redirect("/admin/login");
  }
}

/** 登录：返回 { ok, error?, cookie? }，cookie 供路由处理器写入响应 */
export async function adminLogin(email: string, password: string): Promise<{ ok: boolean; error?: string; cookie?: { name: string; value: string; maxAge: number } }> {
  const em = email.trim().toLowerCase();
  if (!em || !password) return { ok: false, error: "请输入邮箱和密码" };
  if (isSupabaseConfigured()) {
    const sb = createServerSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email: em, password });
    if (error || !data.session) return { ok: false, error: "邮箱或密码错误" };
    // 校验是否为管理员
    const { data: row } = await sb
      .from("admin_users")
      .select("email")
      .eq("user_id", data.session.user.id)
      .maybeSingle();
    if (!row) {
      await sb.auth.signOut();
      return { ok: false, error: "该账号不是管理员，无法登录后台" };
    }
    return { ok: true };
  }
  if (!demoModeAllowed()) {
    return {
      ok: false,
      error: "当前为生产环境且未配置 Supabase，出于安全考虑已禁用演示管理员登录。请配置 Supabase 环境变量后再登录后台。",
    };
  }
  if (!demoVerifyPassword(em, password)) return { ok: false, error: "邮箱或密码错误" };
  const token = crypto.randomUUID();
  demoSetToken(token);
  return {
    ok: true,
    cookie: { name: ADMIN_COOKIE, value: token, maxAge: 60 * 60 * 24 * 7 },
  };
}

/** 登出：返回一个带清除 Cookie 的响应（Supabase 模式同时清除会话） */
export async function adminLogout() {
  if (isSupabaseConfigured()) {
    try {
      const sb = createServerSupabase();
      await sb.auth.signOut();
    } catch {
      // 忽略
    }
  } else {
    demoSetToken(null);
  }
  return { ok: true };
}

/** 获取当前匿名用户标识（领取流程用），无则创建 */
export function getVisitorKey(): string {
  const store = cookies() as unknown as UnsafeUnwrappedCookies;
  const existing = store.get(VID_COOKIE)?.value;
  if (existing) return existing;
  return "";
}

export function makeVisitorKey(): string {
  return crypto.randomUUID();
}

export function visitorCookie(value: string) {
  return {
    name: VID_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  };
}

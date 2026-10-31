import { createBrowserClient } from "@supabase/ssr";
import { createServerClient as createSsrServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabaseAnonKey, supabaseServiceKey, supabaseUrl } from "./env";

export const SCREENSHOTS_BUCKET = "task-screenshots";

/** 浏览器端客户端（用于个别需要实时交互的场景，不承载权限敏感操作） */
export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}

/**
 * 服务端客户端：使用请求 Cookie 保持会话，可安全用于服务端组件与路由处理器。
 * 注意：修改 Cookie 必须通过 @supabase/ssr 的方式，供登录/登出路由使用。
 */
export function createServerSupabase() {
  const cookieStore = cookies();
  return createSsrServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: { path?: string; maxAge?: number; domain?: string; sameSite?: "lax" | "strict" | "none"; httpOnly?: boolean; secure?: boolean };
        }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // 在服务端组件中调用 setAll 时可能被忽略（仅允许路由处理器/Server Action 修改）
        }
      },
    },
  });
}

/**
 * 管理端服务端客户端：使用 service_role 密钥，仅供服务端使用，
 * 绝对禁止放入 NEXT_PUBLIC_ 前缀环境变量或浏览器代码。
 */
export function createServiceSupabase() {
  const key = supabaseServiceKey();
  if (!key) {
    throw new Error("缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量，无法执行服务端写入操作。请在部署环境配置后重启。");
  }
  return createSupabaseClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 配置自检：开启云端模式但缺少服务端密钥时给出明确告警（不阻断读取）
if (isSupabaseConfigured() && !supabaseServiceKey()) {
  console.warn(
    "[配置警告] 已配置 Supabase URL / ANON_KEY，但缺少 SUPABASE_SERVICE_ROLE_KEY；后台写操作与截图上传将失败。"
  );
}

export { isSupabaseConfigured };

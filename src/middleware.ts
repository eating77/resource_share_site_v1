import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/env";

// 与 src/lib/auth.ts 保持一致（避免在 edge 中间件中引入 next/headers）
const ADMIN_COOKIE = "rs_admin";
const VID_COOKIE = "rs_vid";

/**
 * 中间件职责：
 * 1. 为首次访问用户下发匿名标识 rs_vid（领取流程的身份恢复依据，httpOnly 防篡改）；
 * 2. /admin 页面访问守卫：Supabase 模式校验会话，演示模式校验 rs_admin Cookie（深层校验在服务端布局与 API 中完成）；
 * 3. Supabase 模式下刷新会话令牌（服务端组件无法写 Cookie，必须在这里刷新）。
 */
export async function middleware(request: NextRequest) {
  request.headers.set("x-pathname", request.nextUrl.pathname);
  const res = NextResponse.next({ request });

  if (!request.cookies.has(VID_COOKIE)) {
    res.cookies.set(VID_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  const path = request.nextUrl.pathname;
  const isAdminPath = path.startsWith("/admin") && !path.startsWith("/admin/login");

  if (isSupabaseConfigured()) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(
            cookiesToSet: {
              name: string;
              value: string;
              options?: { path?: string; maxAge?: number; domain?: string; sameSite?: "lax" | "strict" | "none"; httpOnly?: boolean; secure?: boolean };
            }[]
          ) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (isAdminPath && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("from", path);
      return NextResponse.redirect(url);
    }
  } else if (isAdminPath && !request.cookies.has(ADMIN_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};

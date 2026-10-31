import { NextRequest, NextResponse } from "next/server";
import { adminLogin, ADMIN_COOKIE } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = rateLimit(`login:${clientIp(request)}`, 10, 5 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.slice(0, 320) : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const result = await adminLogin(email, password);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || "登录失败" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    if (result.cookie) {
      res.cookies.set(result.cookie.name, result.cookie.value, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: result.cookie.maxAge,
        path: "/",
      });
    }
    return res;
  } catch (e) {
    console.error("[login] error", e);
    return NextResponse.json({ ok: false, error: "登录失败，请稍后重试" }, { status: 500 });
  }
}

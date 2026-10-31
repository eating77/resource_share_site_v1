import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { demoSetPassword, isSupabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 演示模式专用：修改演示管理员密码（Supabase 模式请在 Supabase 控制台管理） */
export async function POST(request: NextRequest) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  if (isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "当前为云端模式，请在 Supabase 控制台修改密码" }, { status: 400 });
  }
  try {
    const body = await request.json();
    const pwd = typeof body?.password === "string" ? body.password : "";
    if (pwd.length < 6) return NextResponse.json({ ok: false, error: "密码至少 6 位" }, { status: 400 });
    demoSetPassword(pwd);
    return NextResponse.json({ ok: true, message: "密码已修改，请重新登录" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "修改失败" }, { status: 500 });
  }
}

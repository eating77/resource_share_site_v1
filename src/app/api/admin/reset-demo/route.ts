import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { resetDemoData, isSupabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/** 演示模式专用：重置本地演示数据（生产/Supabase 模式不可用） */
export async function POST(_request: NextRequest) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  if (isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "当前为云端模式，不支持重置演示数据" }, { status: 400 });
  }
  try {
    resetDemoData();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "重置失败" }, { status: 500 });
  }
}

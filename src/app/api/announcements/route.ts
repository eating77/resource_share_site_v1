import { NextRequest, NextResponse } from "next/server";
import { createAnnouncement, listAnnouncements } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const position = request.nextUrl.searchParams.get("position") || undefined;
    const enabledOnly = request.nextUrl.searchParams.get("enabled") === "1";
    const data = await listAnnouncements({ position, enabledOnly });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "读取公告失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) return NextResponse.json({ ok: false, error: "公告内容不能为空" }, { status: 400 });
    const announcement = await createAnnouncement({
      title: typeof body.title === "string" ? body.title.trim() : "",
      content,
      position: body.position === "home_top" || body.position === "notice" ? body.position : "notice",
      enabled: body.enabled !== false,
    });
    return NextResponse.json({ ok: true, data: announcement });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "新增公告失败" }, { status: 500 });
  }
}

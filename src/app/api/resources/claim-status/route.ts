import { NextRequest, NextResponse } from "next/server";
import { getVisitorKey, makeVisitorKey, visitorCookie } from "@/lib/auth";
import { isApproved } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/** 查询当前访客对该资源是否已满足领取条件（用于刷新页面后恢复任务状态） */
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "缺少资源标识" }, { status: 400 });
    const visitor = await getVisitorKey();
    const approved = await isApproved(id, visitor || "__nobody__");
    const res = NextResponse.json({ ok: true, approved });
    if (!visitor) {
      res.cookies.set(visitorCookie(makeVisitorKey()));
    }
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "查询失败" }, { status: 500 });
  }
}

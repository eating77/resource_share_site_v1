import { NextResponse } from "next/server";
import { getVisitorKey, makeVisitorKey, visitorCookie } from "@/lib/auth";
import { isApproved } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 查询当前访客对该资源是否已满足领取条件（用于刷新页面后恢复任务状态） */
export async function GET(_request: Request, ctx: { params: { id: string } }) {
  try {
    let visitor = getVisitorKey();
    const approved = await isApproved(ctx.params.id, visitor || "__nobody__");
    const res = NextResponse.json({ ok: true, approved });
    if (!visitor) {
      res.cookies.set(visitorCookie(makeVisitorKey()));
    }
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "查询失败" }, { status: 500 });
  }
}

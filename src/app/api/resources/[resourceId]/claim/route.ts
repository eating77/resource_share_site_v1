import { NextResponse } from "next/server";
import { getVisitorKey, makeVisitorKey, visitorCookie } from "@/lib/auth";
import { getResource, getTask, isApproved } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/**
 * 领取信息接口（核心安全点）：
 * 领取链接与提取码仅在服务端确认「任务启用 + 资源发布 + 提交记录数 ≥ 要求数量」后返回，
 * 前端无法通过修改状态绕过。
 */
export async function POST(_request: Request, ctx: { params: Promise<{ resourceId: string }> }) {
  try {
    const { resourceId } = await ctx.params;
    let visitor = getVisitorKey();
    const freshVisitor = !visitor;
    if (freshVisitor) visitor = makeVisitorKey();

    const resource = await getResource(resourceId);
    if (!resource || !resource.is_published) {
      return NextResponse.json({ ok: false, error: "资源不存在或已下架" }, { status: 404 });
    }
    const task = await getTask(resourceId);
    if (task && !task.enabled) {
      return NextResponse.json({ ok: false, error: "该资源未启用领取任务" }, { status: 403 });
    }
    const approved = await isApproved(resourceId, visitor);
    if (!approved) {
      return NextResponse.json({ ok: false, error: "尚未满足领取条件，请先完成任务并上传截图" }, { status: 403 });
    }
    const res = NextResponse.json({
      ok: true,
      data: {
        resourceId: resource.id,
        title: resource.title,
        driveUrl: resource.drive_url,
        extractCode: resource.extract_code,
      },
    });
    if (freshVisitor) res.cookies.set(visitorCookie(visitor));
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "领取失败" }, { status: 500 });
  }
}

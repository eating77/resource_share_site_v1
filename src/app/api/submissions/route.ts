import { NextRequest, NextResponse } from "next/server";
import { createSubmission, getResource, listSubmissions } from "@/lib/db";
import { requireAdminApi, getVisitorKey, makeVisitorKey, visitorCookie } from "@/lib/auth";
import { isLocalUploadUrl } from "@/lib/upload";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** 管理端：查看全部截图提交记录（含图片、资源名、数量、状态） */
export async function GET() {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const data = await listSubmissions();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "读取提交记录失败" }, { status: 500 });
  }
}

/**
 * 用户端：提交任务截图记录。
 * 服务端校验：任务启用、资源存在且发布、图片均为本站上传、数量 ≥ 要求数量。
 * 达到要求即自动通过（自动通过仅代表数量与基本格式校验通过，不代表截图内容真实）。
 */
export async function POST(request: NextRequest) {
  try {
    let visitor = getVisitorKey();
    const freshVisitor = !visitor;
    if (freshVisitor) visitor = makeVisitorKey();

    const limited = rateLimit(`submit:${visitor}`, 12, 10 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json({ ok: false, error: "提交过于频繁，请稍后再试" }, { status: 429 });
    }

    const body = await request.json();
    const resourceId = typeof body?.resourceId === "string" ? body.resourceId.slice(0, 64) : "";
    const rawUrls = Array.isArray(body?.imageUrls)
      ? body.imageUrls.filter((u: unknown) => typeof u === "string").map((u: string) => u.slice(0, 2048))
      : [];
    if (!resourceId) return NextResponse.json({ ok: false, error: "缺少资源标识" }, { status: 400 });
    if (rawUrls.length === 0) return NextResponse.json({ ok: false, error: "请先上传截图" }, { status: 400 });
    if (rawUrls.length > 20) return NextResponse.json({ ok: false, error: "单次提交截图数量过多" }, { status: 400 });
    if (!rawUrls.every(isLocalUploadUrl)) {
      return NextResponse.json({ ok: false, error: "检测到无效的图片来源" }, { status: 400 });
    }

    const resource = await getResource(resourceId);
    if (!resource || !resource.is_published) {
      return NextResponse.json({ ok: false, error: "资源不存在或已下架" }, { status: 404 });
    }

    // 去重：避免用同一张图重复计数
    const imageUrls = Array.from(new Set(rawUrls));
    const result = await createSubmission({ resourceId, userKey: visitor, imageUrls });
    const res = NextResponse.json({ ok: true, data: result });
    if (freshVisitor) res.cookies.set(visitorCookie(visitor));
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "提交失败";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

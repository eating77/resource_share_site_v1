import { NextRequest, NextResponse } from "next/server";
import { createResource, listResources } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";
import type { Resource } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const search = sp.get("search") || undefined;
    const categoryId = sp.get("categoryId") || null;
    const hotOnly = sp.get("hot") === "1";
    const limitRaw = Number(sp.get("limit") || 0);
    const all = sp.get("all") === "1";
    const isAdmin = Boolean(await requireAdminApi());
    const data = await listResources({
      search,
      categoryId,
      hotOnly,
      publishedOnly: !(isAdmin && all),
      limit: limitRaw > 0 ? Math.min(limitRaw, 100) : undefined,
    });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "读取资源失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as Partial<Resource>;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ ok: false, error: "资源名称不能为空" }, { status: 400 });
    const resource = await createResource({
      ...body,
      title,
      category_id: typeof body.category_id === "string" && body.category_id ? body.category_id : null,
      cover_emoji: typeof body.cover_emoji === "string" && body.cover_emoji ? body.cover_emoji : "📦",
      tags: Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === "string").slice(0, 10) : [],
      rating: Number(body.rating) || 5,
    });
    return NextResponse.json({ ok: true, data: resource });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "新增资源失败" }, { status: 500 });
  }
}

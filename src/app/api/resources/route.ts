import { NextRequest, NextResponse } from "next/server";
import {
  createResource,
  deleteResource,
  getResource,
  listResources,
  moveResource,
  toPublicResource,
  updateResource,
} from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";
import type { Resource } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const isAdmin = Boolean(await requireAdminApi());
      const resource = await getResource(id);
      if (!resource) return NextResponse.json({ ok: false, error: "资源不存在" }, { status: 404 });
      // 未发布资源仅管理员可见；公开访问绝不返回网盘地址与提取码
      if (!resource.is_published && !isAdmin) {
        return NextResponse.json({ ok: false, error: "资源不存在或已下架" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, data: isAdmin ? resource : toPublicResource(resource) });
    }
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
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    // 排序调整：POST /api/resources?id=xxx&move=up|down
    if (!(await requireAdminApi())) {
      return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
    }
    const dir = request.nextUrl.searchParams.get("move");
    if (dir !== "up" && dir !== "down") {
      return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
    }
    try {
      await moveResource(id, dir === "up" ? -1 : 1);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "调整排序失败" }, { status: 500 });
    }
  }
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

export async function PUT(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "缺少资源标识" }, { status: 400 });
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as Partial<Resource>;
    if (typeof body?.title === "string" && !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "资源名称不能为空" }, { status: 400 });
    }
    await updateResource(id, {
      ...body,
      title: typeof body.title === "string" ? body.title.trim() : undefined,
      category_id: typeof body.category_id === "string" && body.category_id ? body.category_id : null,
      tags: Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === "string").slice(0, 10) : undefined,
      rating: typeof body.rating === "number" ? body.rating : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "修改资源失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "缺少资源标识" }, { status: 400 });
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    await deleteResource(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "删除资源失败" }, { status: 500 });
  }
}

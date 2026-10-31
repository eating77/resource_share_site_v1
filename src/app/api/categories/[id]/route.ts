import { NextRequest, NextResponse } from "next/server";
import { deleteCategory, updateCategory } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PUT(request: NextRequest, ctx: Ctx) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, error: "分类名称不能为空" }, { status: 400 });
    const icon = typeof body?.icon === "string" ? body.icon.slice(0, 4) : "✦";
    const sort_order =
      typeof body?.sort_order === "number" && Number.isFinite(body.sort_order) ? Math.trunc(body.sort_order) : undefined;
    await updateCategory(ctx.params.id, { name, icon, sort_order });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "修改分类失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const result = await deleteCategory(ctx.params.id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "删除分类失败" }, { status: 500 });
  }
}

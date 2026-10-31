import { NextRequest, NextResponse } from "next/server";
import { deleteAnnouncement, updateAnnouncement } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) return NextResponse.json({ ok: false, error: "公告内容不能为空" }, { status: 400 });
    await updateAnnouncement(id, {
      title: typeof body.title === "string" ? body.title.trim() : "",
      content,
      position: body.position === "home_top" || body.position === "notice" ? body.position : "notice",
      enabled: body.enabled !== false,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "修改公告失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    await deleteAnnouncement(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "删除公告失败" }, { status: 500 });
  }
}

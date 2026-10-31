import { NextRequest, NextResponse } from "next/server";
import { deleteSubmission, getSubmission } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const submission = await getSubmission(id);
    if (!submission) return NextResponse.json({ ok: false, error: "记录不存在" }, { status: 404 });
    return NextResponse.json({ ok: true, data: submission });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "读取记录失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    await deleteSubmission(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "删除记录失败" }, { status: 500 });
  }
}

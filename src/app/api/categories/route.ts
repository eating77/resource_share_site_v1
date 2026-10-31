import { NextRequest, NextResponse } from "next/server";
import { createCategory, listCategories } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET() {
  try {
    const categories = await listCategories();
    return NextResponse.json({ ok: true, data: categories });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "读取分类失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, error: "分类名称不能为空" }, { status: 400 });
    const icon = typeof body?.icon === "string" ? body.icon.slice(0, 4) : "✦";
    const category = await createCategory({ name, icon });
    return NextResponse.json({ ok: true, data: category });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "新增分类失败";
    const dup = msg.includes("duplicate") || msg.includes("唯一") || msg.includes("already");
    return NextResponse.json({ ok: false, error: msg }, { status: dup ? 409 : 500 });
  }
}

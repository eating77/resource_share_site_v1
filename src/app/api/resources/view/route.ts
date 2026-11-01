import { NextRequest, NextResponse } from "next/server";
import { incrementViews } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "缺少资源标识" }, { status: 400 });
    await incrementViews(id);
    return NextResponse.json({ ok: true });
  } catch {
    // 浏览数失败不阻塞页面
    return NextResponse.json({ ok: false });
  }
}

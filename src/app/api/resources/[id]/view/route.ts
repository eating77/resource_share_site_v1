import { NextRequest, NextResponse } from "next/server";
import { incrementViews } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, ctx: { params: { id: string } }) {
  try {
    await incrementViews(ctx.params.id);
    return NextResponse.json({ ok: true });
  } catch {
    // 浏览数失败不阻塞页面
    return NextResponse.json({ ok: false });
  }
}

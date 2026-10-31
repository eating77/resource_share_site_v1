import { NextRequest, NextResponse } from "next/server";
import { incrementViews } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await incrementViews(id);
    return NextResponse.json({ ok: true });
  } catch {
    // 浏览数失败不阻塞页面
    return NextResponse.json({ ok: false });
  }
}

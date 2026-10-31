import { NextRequest, NextResponse } from "next/server";
import { getTask, saveTask } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";
import { REQUIRED_SCREENSHOTS, type Task } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const task = await getTask(id);
    return NextResponse.json({ ok: true, data: task });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "读取任务失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as Omit<Task, "id" | "resource_id">;
    await saveTask(id, {
      enabled: Boolean(body.enabled),
      title: typeof body.title === "string" ? body.title : "完成任务",
      description: typeof body.description === "string" ? body.description : "",
      steps: Array.isArray(body.steps) ? body.steps : [],
      required_screenshots: REQUIRED_SCREENSHOTS,
      success_message: typeof body.success_message === "string" ? body.success_message : "",
      button_text: typeof body.button_text === "string" ? body.button_text : "🚀 提交截图获取地址",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "保存任务失败" }, { status: 500 });
  }
}

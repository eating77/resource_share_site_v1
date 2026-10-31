import { NextRequest, NextResponse } from "next/server";
import { getSiteSettings, saveSiteSettings } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";
import type { SiteSettings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const COLOR_KEYS = ["primary_color", "accent_color", "button_color"] as const;

const STRING_KEYS: (keyof SiteSettings)[] = [
  "name", "subtitle", "logo", "logo_url", "tab_title", "description", "footer", "icp", "contact",
  "kefu_text", "kefu_url", "primary_color", "accent_color", "button_color",
  "hero_title", "hero_subtitle", "search_placeholder", "category_title", "claim_domain",
  "hot_title", "latest_title", "featured_title",
  "copy_search_empty", "copy_get_button", "copy_task_start", "copy_upload_hint", "copy_upload_count",
  "copy_upload_success", "copy_auto_pass", "copy_claim_success", "copy_copy_success", "copy_error",
];

const BOOL_KEYS: (keyof SiteSettings)[] = ["show_categories", "show_hot", "show_latest", "show_featured"];
const KNOWN_BLOCKS = ["hot", "latest", "featured"];

/** 只保留已知字段并限制长度/类型，避免脏数据与超长内容进入数据库 */
function sanitizeSettingsPatch(body: Record<string, unknown>): Partial<SiteSettings> {
  const patch: Record<string, unknown> = {};
  for (const key of STRING_KEYS) {
    const v = body[key as string];
    if (typeof v === "string") patch[key as string] = v.slice(0, 2000);
  }
  for (const key of COLOR_KEYS) {
    const v = patch[key];
    if (typeof v !== "string" || !/^#[0-9a-fA-F]{6}$/.test(v)) delete patch[key];
  }
  for (const key of BOOL_KEYS) {
    const v = body[key as string];
    if (typeof v === "boolean") patch[key as string] = v;
  }
  if (typeof body.home_resource_count === "number" && Number.isFinite(body.home_resource_count)) {
    patch.home_resource_count = Math.min(50, Math.max(1, Math.floor(body.home_resource_count)));
  }
  if (Array.isArray(body.home_block_order)) {
    const seen = new Set<string>();
    patch.home_block_order = body.home_block_order
      .filter((x): x is string => typeof x === "string" && KNOWN_BLOCKS.includes(x) && !seen.has(x) && Boolean(seen.add(x)))
      .slice(0, KNOWN_BLOCKS.length);
  }
  return patch as Partial<SiteSettings>;
}

export async function GET() {
  try {
    const settings = await getSiteSettings();
    return NextResponse.json({ ok: true, data: settings });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "读取设置失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ ok: false, error: "未登录或没有管理员权限" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    await saveSiteSettings(sanitizeSettingsPatch(body));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "保存设置失败" }, { status: 500 });
  }
}

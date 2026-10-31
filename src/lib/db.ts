import { cache } from "react";
import { createServiceSupabase, createServerSupabase, isSupabaseConfigured } from "./supabase";
import {
  demoLoad,
  demoSave,
  demoReset,
  DemoStore,
  demoVerifyPassword,
  demoSetToken,
  demoCheckToken,
  demoSetPassword,
} from "./demo-store";
import { DEFAULT_SETTINGS, REQUIRED_SCREENSHOTS, SiteSettings, Category, Resource, Task, TaskStep, Submission, Announcement } from "./types";

/**
 * 数据访问层（唯一入口）。
 * - 配置了 Supabase 环境变量 → 使用真实云端数据库/存储；
 * - 未配置 → 使用服务端 JSON 文件演示模式（页面会明确提示“演示模式”，仅用于本地体验）。
 */

function err(msg: string, e?: unknown): never {
  throw new Error(msg + (e instanceof Error ? `：${e.message}` : ""));
}

// ===================== 工具 =====================

function newId(): string {
  return crypto.randomUUID();
}

const ALLOWED_STEP_KEYS = ["title", "description", "display_text", "keyword", "comment", "image_hint"] as const;

function cleanSteps(steps: unknown): TaskStep[] {
  if (!Array.isArray(steps)) return [];
  return steps.slice(0, 20).map((s) => {
    const o = (s || {}) as Record<string, unknown>;
    const out: TaskStep = { title: "", description: "", display_text: "", keyword: "", comment: "", image_hint: "" };
    for (const k of ALLOWED_STEP_KEYS) {
      out[k] = typeof o[k] === "string" ? o[k] : "";
    }
    return out;
  });
}

/** 统一裁剪字符串并限制长度，避免超长输入撑爆数据库/页面 */
function clampStr(value: unknown, maxLen: number): string | undefined {
  return typeof value === "string" ? value.slice(0, maxLen) : undefined;
}

/** 只允许 http(s) 链接或站内相对路径，阻断 javascript:/data: 等危险协议 */
function safeUrlOrEmpty(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (s.startsWith("/")) return s.slice(0, 500);
  if (/^https?:\/\//i.test(s)) return s.slice(0, 2048);
  return "";
}

/** 公开场景下的资源：移除网盘地址与提取码，防止绕过领取任务直接拿到链接 */
export function toPublicResource(resource: Resource): Resource {
  return { ...resource, drive_url: "", extract_code: "" };
}

/**
 * 资源写操作白名单：只接受已知字段，避免请求体注入 id / created_at / views 等敏感列。
 */
function sanitizeResourcePatch(input: Partial<Resource>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof input.title === "string") out.title = input.title.trim().slice(0, 200);
  if ("category_id" in input) {
    out.category_id = typeof input.category_id === "string" && input.category_id ? input.category_id : null;
  }
  if (typeof input.category_name === "string") out.category_name = input.category_name.slice(0, 100);
  if (typeof input.description === "string") out.description = input.description.slice(0, 3000);
  if (typeof input.cover_emoji === "string") out.cover_emoji = input.cover_emoji.slice(0, 8);
  if (typeof input.cover_url === "string") out.cover_url = safeUrlOrEmpty(input.cover_url);
  if (Array.isArray(input.tags)) {
    out.tags = input.tags.filter((t) => typeof t === "string").map((t) => (t as string).slice(0, 30)).slice(0, 10);
  }
  if (typeof input.size === "string") out.size = input.size.slice(0, 50);
  if (typeof input.rating === "number" && Number.isFinite(input.rating)) {
    out.rating = Math.min(10, Math.max(0, input.rating));
  }
  if (typeof input.sort_order === "number" && Number.isFinite(input.sort_order)) {
    out.sort_order = Math.trunc(input.sort_order);
  }
  if (typeof input.is_published === "boolean") out.is_published = input.is_published;
  if (typeof input.is_home === "boolean") out.is_home = input.is_home;
  if (typeof input.is_hot === "boolean") out.is_hot = input.is_hot;
  if (typeof input.drive_url === "string") out.drive_url = safeUrlOrEmpty(input.drive_url);
  if (typeof input.extract_code === "string") out.extract_code = input.extract_code.slice(0, 50);
  if (typeof input.detail_content === "string") out.detail_content = input.detail_content.slice(0, 20000);
  return out;
}

/**
 * 清理搜索词，避免用户输入通过 PostgREST `.or()` 语法注入额外过滤条件。
 * 仅保留常规字符，去掉逗号/括号/通配符/引号等控制字符。
 */
function sanitizeSearchTerm(raw: string): string {
  return raw
    .replace(/[%_,().*\\"'`;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/** 从 Supabase 关联查询结果中提取分类名（兼容对象与数组两种返回形态） */
function pickCategoryName(rel: unknown): string | undefined {
  if (Array.isArray(rel)) return (rel[0] as { name?: string } | undefined)?.name;
  return (rel as { name?: string } | null | undefined)?.name;
}

// ===================== Supabase 实现 =====================

const supabaseOps = {
  async getSiteSettings(): Promise<SiteSettings> {
    const sb = createServerSupabase();
    const { data, error } = await sb.from("site_settings").select("value").eq("key", "site").maybeSingle();
    if (error) err("读取网站设置失败", error);
    return { ...DEFAULT_SETTINGS, ...((data?.value as Partial<SiteSettings>) || {}) };
  },

  async saveSiteSettings(s: Partial<SiteSettings>): Promise<void> {
    const sb = createServiceSupabase();
    const { error } = await sb
      .from("site_settings")
      .upsert({ key: "site", value: s, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) err("保存网站设置失败", error);
  },

  async listCategories(): Promise<Category[]> {
    const sb = createServerSupabase();
    const { data, error } = await sb.from("categories").select("*").order("sort_order", { ascending: true }).order("name");
    if (error) err("读取分类失败", error);
    return (data || []) as Category[];
  },

  async createCategory(input: { name: string; icon: string }): Promise<Category> {
    const sb = createServiceSupabase();
    const { data: last } = await sb.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const sort_order = (last ? last[0]?.sort_order ?? 0 : 0) + 1;
    const { data, error } = await sb
      .from("categories")
      .insert({ name: input.name.trim(), icon: input.icon || "✦", sort_order })
      .select("*")
      .single();
    if (error) err("新增分类失败", error);
    return data as Category;
  },

  async updateCategory(id: string, input: { name: string; icon: string; sort_order?: number }): Promise<void> {
    const sb = createServiceSupabase();
    const patch: Record<string, unknown> = { name: input.name.trim(), icon: input.icon || "✦" };
    if (typeof input.sort_order === "number" && Number.isFinite(input.sort_order)) {
      patch.sort_order = Math.trunc(input.sort_order);
    }
    const { error } = await sb.from("categories").update(patch).eq("id", id);
    if (error) err("修改分类失败", error);
    // 同步冗余的分类名，避免列表页显示旧名称
    if (typeof patch.name === "string" && patch.name) {
      await sb.from("resources").update({ category_name: patch.name }).eq("category_id", id);
    }
  },

  async deleteCategory(id: string): Promise<{ ok: boolean; error?: string }> {
    const sb = createServiceSupabase();
    const { count } = await sb.from("resources").select("id", { count: "exact", head: true }).eq("category_id", id);
    if (count && count > 0) return { ok: false, error: `该分类下还有 ${count} 个资源，请先处理关联资源后再删除。` };
    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) err("删除分类失败", error);
    return { ok: true };
  },

  async listResources(opts: ResourceListOptions): Promise<Resource[]> {
    const sb = createServerSupabase();
    let q = sb.from("resources").select("*, categories(name)");
    if (opts.publishedOnly) q = q.eq("is_published", true);
    if (opts.homeOnly) q = q.eq("is_home", true);
    if (opts.hotOnly) q = q.eq("is_hot", true);
    if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
    if (opts.search) {
      const term = sanitizeSearchTerm(opts.search);
      if (term) {
        q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,tags::text.ilike.%${term}%`);
      }
    }
    q = q.order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) err("读取资源失败", error);
    const rows = (data || []) as (Resource & { categories?: unknown; tags?: unknown })[];
    return rows.map((r) => {
      const out = {
        ...r,
        tags: Array.isArray(r.tags) ? r.tags : [],
        category_name: pickCategoryName(r.categories) || r.category_name || "",
      } as Resource & { categories?: unknown };
      delete out.categories;
      return toPublicResource(out);
    });
  },

  async getResource(id: string): Promise<Resource | null> {
    const sb = createServerSupabase();
    const { data, error } = await sb.from("resources").select("*, categories(name)").eq("id", id).maybeSingle();
    if (error) err("读取资源失败", error);
    if (!data) return null;
    const row = data as Resource & { categories?: unknown; tags?: unknown };
    const out = {
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : [],
      category_name: pickCategoryName(row.categories) || row.category_name || "",
    } as Resource & { categories?: unknown };
    delete out.categories;
    return out;
  },

  async createResource(input: Partial<Resource>): Promise<Resource> {
    const sb = createServiceSupabase();
    const payload = sanitizeResourcePatch(input);
    const { data: last } = await sb.from("resources").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const sort_order =
      typeof payload.sort_order === "number" ? payload.sort_order : (last ? last[0]?.sort_order ?? 0 : 0) + 1;
    const { data, error } = await sb
      .from("resources")
      .insert({ ...payload, sort_order })
      .select("*")
      .single();
    if (error) err("新增资源失败", error);
    return data as Resource;
  },

  async updateResource(id: string, input: Partial<Resource>): Promise<void> {
    const sb = createServiceSupabase();
    const { error } = await sb
      .from("resources")
      .update({ ...sanitizeResourcePatch(input), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) err("修改资源失败", error);
  },

  async deleteResource(id: string): Promise<void> {
    const sb = createServiceSupabase();
    const { error } = await sb.from("resources").delete().eq("id", id);
    if (error) err("删除资源失败", error);
  },

  async moveResource(id: string, dir: 1 | -1): Promise<void> {
    const sb = createServiceSupabase();
    const { data, error } = await sb.from("resources").select("id, sort_order").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (error) err("读取排序失败", error);
    const rows = (data || []) as { id: string; sort_order: number }[];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    const a = rows[idx];
    const b = rows[target];
    const srv = createServiceSupabase();
    await srv.from("resources").update({ sort_order: b.sort_order }).eq("id", a.id);
    await srv.from("resources").update({ sort_order: a.sort_order }).eq("id", b.id);
  },

  async incrementViews(id: string): Promise<void> {
    const sb = createServerSupabase();
    await sb.rpc("increment_views", { row_id: id });
  },

  async getTask(resourceId: string): Promise<Task | null> {
    const sb = createServerSupabase();
    const { data, error } = await sb.from("tasks").select("*").eq("resource_id", resourceId).maybeSingle();
    if (error) err("读取任务失败", error);
    if (!data) return null;
    const row = data as Task;
    return { ...row, steps: Array.isArray(row.steps) ? row.steps : [] };
  },

  async saveTask(resourceId: string, input: Omit<Task, "id" | "resource_id">): Promise<void> {
    const sb = createServiceSupabase();
    const { data: existing } = await sb.from("tasks").select("id").eq("resource_id", resourceId).maybeSingle();
    const payload = {
      resource_id: resourceId,
      enabled: Boolean(input.enabled),
      title: input.title,
      description: input.description,
      steps: cleanSteps(input.steps),
      required_screenshots: REQUIRED_SCREENSHOTS,
      success_message: input.success_message,
      button_text: input.button_text,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      const { error } = await sb.from("tasks").update(payload).eq("resource_id", resourceId);
      if (error) err("保存任务失败", error);
    } else {
      const { error } = await sb.from("tasks").insert(payload);
      if (error) err("保存任务失败", error);
    }
  },

  async listAnnouncements(opts: { position?: string; enabledOnly?: boolean } = {}): Promise<Announcement[]> {
    const sb = createServerSupabase();
    let q = sb.from("announcements").select("*");
    if (opts.position) q = q.eq("position", opts.position);
    if (opts.enabledOnly) q = q.eq("enabled", true);
    q = q.order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    const { data, error } = await q;
    if (error) err("读取公告失败", error);
    return (data || []) as Announcement[];
  },

  async createAnnouncement(input: { title: string; content: string; position: string; enabled: boolean }): Promise<Announcement> {
    const sb = createServiceSupabase();
    const { data: last } = await sb.from("announcements").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const sort_order = (last ? last[0]?.sort_order ?? 0 : 0) + 1;
    const { data, error } = await sb
      .from("announcements")
      .insert({ ...input, sort_order })
      .select("*")
      .single();
    if (error) err("新增公告失败", error);
    return data as Announcement;
  },

  async updateAnnouncement(id: string, input: { title: string; content: string; position: string; enabled: boolean }): Promise<void> {
    const sb = createServiceSupabase();
    const { error } = await sb.from("announcements").update(input).eq("id", id);
    if (error) err("修改公告失败", error);
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const sb = createServiceSupabase();
    const { error } = await sb.from("announcements").delete().eq("id", id);
    if (error) err("删除公告失败", error);
  },

  async createSubmission(input: { resourceId: string; userKey: string; imageUrls: string[] }): Promise<{ id: string; approved: boolean; required: number; count: number }> {
    const srv = createServiceSupabase();
    const task = await supabaseOps.getTask(input.resourceId);
    const required = task && !task.enabled ? 0 : REQUIRED_SCREENSHOTS;
    if (required <= 0) err("该资源未启用任务配置");
    if (input.imageUrls.length < required) err(`截图数量不足：需要 ${required} 张，已上传 ${input.imageUrls.length} 张`);
    const { data: sub, error: e1 } = await srv
      .from("task_submissions")
      .insert({ resource_id: input.resourceId, user_key: input.userKey, status: "approved", screenshot_count: required })
      .select("*")
      .single();
    if (e1) err("提交截图记录失败", e1);
    const images = input.imageUrls.slice(0, required).map((u) => ({ submission_id: sub.id, image_url: u }));
    const { error: e2 } = await srv.from("submission_images").insert(images);
    if (e2) err("保存截图失败", e2);
    return { id: sub.id, approved: true, required, count: input.imageUrls.length };
  },

  async listSubmissions(): Promise<Submission[]> {
    const sb = createServerSupabase();
    const { data, error } = await sb.from("task_submissions").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) err("读取提交记录失败", error);
    const rows = (data || []) as { id: string; resource_id: string; user_key: string; status: string; screenshot_count: number; created_at: string }[];
    if (rows.length === 0) return [];
    const resourceIds = Array.from(new Set(rows.map((r) => r.resource_id)));
    const { data: resRows } = await sb.from("resources").select("id, title").in("id", resourceIds);
    const titleMap = new Map((resRows || []).map((r: { id: string; title: string }) => [r.id, r.title]));
    const { data: imgRows } = await sb.from("submission_images").select("submission_id, image_url").in(
      "submission_id",
      rows.map((r) => r.id)
    );
    const imgMap = new Map<string, string[]>();
    for (const img of imgRows || []) {
      const arr = imgMap.get(img.submission_id) || [];
      arr.push(img.image_url);
      imgMap.set(img.submission_id, arr);
    }
    return rows.map((r) => ({
      id: r.id,
      resource_id: r.resource_id,
      resource_title: titleMap.get(r.resource_id) || "（资源已删除）",
      user_key: r.user_key,
      status: r.status,
      screenshot_count: r.screenshot_count,
      created_at: r.created_at,
      images: imgMap.get(r.id) || [],
    }));
  },

  async getSubmission(id: string): Promise<Submission | null> {
    const all = await supabaseOps.listSubmissions();
    return all.find((s) => s.id === id) || null;
  },

  async deleteSubmission(id: string): Promise<void> {
    const sb = createServiceSupabase();
    const { error } = await sb.from("task_submissions").delete().eq("id", id);
    if (error) err("删除提交记录失败", error);
  },

  async isApproved(resourceId: string, userKey: string): Promise<boolean> {
    const srv = createServiceSupabase();
    const task = await supabaseOps.getTask(resourceId);
    const required = task && !task.enabled ? 0 : REQUIRED_SCREENSHOTS;
    if (required <= 0) return false;
    const { data } = await srv
      .from("task_submissions")
      .select("screenshot_count")
      .eq("resource_id", resourceId)
      .eq("user_key", userKey)
      .eq("status", "approved");
    const total = (data || []).reduce((sum, r) => sum + Number(r.screenshot_count || 0), 0);
    return total >= required;
  },

  async resetDemoData(): Promise<void> {
    err("演示数据重置仅在演示模式可用");
  },
};

// ===================== 演示模式实现 =====================

function demoTaskFor(store: DemoStore, resourceId: string): Task | null {
  const t = store.tasks.find((x) => x.resource_id === resourceId);
  if (!t) return null;
  return { ...t, steps: t.steps || [] };
}

const demoOps = {
  async getSiteSettings(): Promise<SiteSettings> {
    return { ...DEFAULT_SETTINGS, ...demoLoad().site_settings };
  },

  async saveSiteSettings(s: Partial<SiteSettings>): Promise<void> {
    demoSave((st) => {
      st.site_settings = { ...DEFAULT_SETTINGS, ...st.site_settings, ...s };
    });
  },

  async listCategories(): Promise<Category[]> {
    return [...demoLoad().categories].sort((a, b) => a.sort_order - b.sort_order);
  },

  async createCategory(input: { name: string; icon: string }): Promise<Category> {
    const c: Category = { id: newId(), name: input.name.trim(), icon: input.icon || "✦", sort_order: 0 };
    demoSave((st) => {
      const max = st.categories.reduce((m, x) => Math.max(m, x.sort_order), 0);
      c.sort_order = max + 1;
      st.categories.push(c);
    });
    return c;
  },

  async updateCategory(id: string, input: { name: string; icon: string; sort_order?: number }): Promise<void> {
    demoSave((st) => {
      const c = st.categories.find((x) => x.id === id);
      if (c) {
        c.name = input.name.trim();
        c.icon = input.icon || "✦";
        if (typeof input.sort_order === "number" && Number.isFinite(input.sort_order)) {
          c.sort_order = Math.trunc(input.sort_order);
        }
        for (const r of st.resources) {
          if (r.category_id === id) r.category_name = c.name;
        }
      }
    });
  },

  async deleteCategory(id: string): Promise<{ ok: boolean; error?: string }> {
    const st = demoLoad();
    const count = st.resources.filter((r) => r.category_id === id).length;
    if (count > 0) return { ok: false, error: `该分类下还有 ${count} 个资源，请先处理关联资源后再删除。` };
    demoSave((s) => {
      s.categories = s.categories.filter((x) => x.id !== id);
    });
    return { ok: true };
  },

  async listResources(opts: ResourceListOptions): Promise<Resource[]> {
    let rows = [...demoLoad().resources];
    if (opts.publishedOnly) rows = rows.filter((r) => r.is_published);
    if (opts.homeOnly) rows = rows.filter((r) => r.is_home && r.is_published);
    if (opts.hotOnly) rows = rows.filter((r) => r.is_hot && r.is_published);
    if (opts.categoryId) rows = rows.filter((r) => r.category_id === opts.categoryId);
    if (opts.search) {
      const term = opts.search.trim().toLowerCase();
      if (term) {
        rows = rows.filter((r) => `${r.title} ${r.description} ${r.tags.join(" ")}`.toLowerCase().includes(term));
      }
    }
    rows = rows.sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at));
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows.map((r) => toPublicResource({ ...r, tags: Array.isArray(r.tags) ? r.tags : [] }));
  },

  async getResource(id: string): Promise<Resource | null> {
    const r = demoLoad().resources.find((x) => x.id === id);
    if (!r) return null;
    return { ...r, tags: Array.isArray(r.tags) ? r.tags : [] };
  },

  async createResource(input: Partial<Resource>): Promise<Resource> {
    const catName = input.category_id
      ? demoLoad().categories.find((c) => c.id === input.category_id)?.name ?? input.category_name ?? ""
      : input.category_name || "";
    const patch = sanitizeResourcePatch(input);
    const r: Resource = {
      id: newId(),
      title: typeof patch.title === "string" && patch.title ? patch.title : "未命名资源",
      category_id: (patch.category_id as string | null) ?? null,
      category_name: catName,
      description: typeof patch.description === "string" ? patch.description : "",
      cover_emoji: typeof patch.cover_emoji === "string" ? patch.cover_emoji : "📦",
      cover_url: typeof patch.cover_url === "string" ? patch.cover_url : "",
      tags: Array.isArray(patch.tags) ? (patch.tags as string[]) : [],
      size: typeof patch.size === "string" ? patch.size : "",
      rating: typeof patch.rating === "number" ? patch.rating : 5,
      views: 0,
      sort_order: typeof patch.sort_order === "number" ? patch.sort_order : 0,
      is_published: typeof patch.is_published === "boolean" ? patch.is_published : true,
      is_home: typeof patch.is_home === "boolean" ? patch.is_home : true,
      is_hot: typeof patch.is_hot === "boolean" ? patch.is_hot : false,
      drive_url: typeof patch.drive_url === "string" ? patch.drive_url : "",
      extract_code: typeof patch.extract_code === "string" ? patch.extract_code : "",
      detail_content: typeof patch.detail_content === "string" ? patch.detail_content : "",
      created_at: new Date().toISOString(),
    };
    demoSave((st) => {
      if (!r.sort_order) {
        const max = st.resources.reduce((m, x) => Math.max(m, x.sort_order), 0);
        r.sort_order = max + 1;
      }
      st.resources.push(r);
    });
    return r;
  },

  async updateResource(id: string, input: Partial<Resource>): Promise<void> {
    demoSave((st) => {
      const r = st.resources.find((x) => x.id === id);
      if (!r) return;
      const patch = sanitizeResourcePatch(input);
      for (const k of Object.keys(patch) as (keyof Resource)[]) {
        (r as unknown as Record<string, unknown>)[k] = patch[k as string];
      }
      // 分类变更时同步冗余分类名
      if ("category_id" in patch) {
        r.category_name = st.categories.find((c) => c.id === r.category_id)?.name || r.category_name;
      }
    });
  },

  async deleteResource(id: string): Promise<void> {
    demoSave((st) => {
      st.resources = st.resources.filter((x) => x.id !== id);
      st.tasks = st.tasks.filter((x) => x.resource_id !== id);
      st.submissions = st.submissions.filter((x) => x.resource_id !== id);
    });
  },

  async moveResource(id: string, dir: 1 | -1): Promise<void> {
    demoSave((st) => {
      const rows = [...st.resources].sort((a, b) => a.sort_order - b.sort_order);
      const idx = rows.findIndex((r) => r.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= rows.length) return;
      const a = rows[idx];
      const b = rows[target];
      const tmp = a.sort_order;
      a.sort_order = b.sort_order;
      b.sort_order = tmp;
    });
  },

  async incrementViews(id: string): Promise<void> {
    demoSave((st) => {
      const r = st.resources.find((x) => x.id === id);
      if (r) r.views += 1;
    });
  },

  async getTask(resourceId: string): Promise<Task | null> {
    return demoTaskFor(demoLoad(), resourceId);
  },

  async saveTask(resourceId: string, input: Omit<Task, "id" | "resource_id">): Promise<void> {
    demoSave((st) => {
      const existing = st.tasks.find((x) => x.resource_id === resourceId);
      const payload = {
        resource_id: resourceId,
        enabled: Boolean(input.enabled),
        title: input.title,
        description: input.description,
        steps: cleanSteps(input.steps),
        required_screenshots: REQUIRED_SCREENSHOTS,
        success_message: input.success_message,
        button_text: input.button_text,
      };
      if (existing) {
        Object.assign(existing, payload);
      } else {
        st.tasks.push({ id: newId(), ...payload });
      }
    });
  },

  async listAnnouncements(opts: { position?: string; enabledOnly?: boolean } = {}): Promise<Announcement[]> {
    let rows = [...demoLoad().announcements];
    if (opts.position) rows = rows.filter((a) => a.position === opts.position);
    if (opts.enabledOnly) rows = rows.filter((a) => a.enabled);
    return rows.sort((a, b) => a.sort_order - b.sort_order);
  },

  async createAnnouncement(input: { title: string; content: string; position: string; enabled: boolean }): Promise<Announcement> {
    const a: Announcement = { id: newId(), title: input.title, content: input.content, position: input.position, enabled: input.enabled, sort_order: 0, created_at: new Date().toISOString() };
    demoSave((st) => {
      const max = st.announcements.reduce((m, x) => Math.max(m, x.sort_order), 0);
      a.sort_order = max + 1;
      st.announcements.push(a);
    });
    return a;
  },

  async updateAnnouncement(id: string, input: { title: string; content: string; position: string; enabled: boolean }): Promise<void> {
    demoSave((st) => {
      const a = st.announcements.find((x) => x.id === id);
      if (a) Object.assign(a, input);
    });
  },

  async deleteAnnouncement(id: string): Promise<void> {
    demoSave((st) => {
      st.announcements = st.announcements.filter((x) => x.id !== id);
    });
  },

  async createSubmission(input: { resourceId: string; userKey: string; imageUrls: string[] }): Promise<{ id: string; approved: boolean; required: number; count: number }> {
    const st = demoLoad();
    const task = demoTaskFor(st, input.resourceId);
    const required = task && !task.enabled ? 0 : REQUIRED_SCREENSHOTS;
    if (required <= 0) throw new Error("该资源未启用任务配置");
    if (input.imageUrls.length < required) throw new Error(`截图数量不足：需要 ${required} 张，已上传 ${input.imageUrls.length} 张`);
    const sub: DemoStore["submissions"][number] = {
      id: newId(),
      resource_id: input.resourceId,
      user_key: input.userKey,
      status: "approved",
      screenshot_count: required,
      created_at: new Date().toISOString(),
      images: input.imageUrls.slice(0, required),
    };
    demoSave((s) => {
      s.submissions.push(sub);
    });
    return { id: sub.id, approved: true, required, count: input.imageUrls.length };
  },

  async listSubmissions(): Promise<Submission[]> {
    const st = demoLoad();
    return [...st.submissions]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 200)
      .map((s) => ({
        id: s.id,
        resource_id: s.resource_id,
        resource_title: st.resources.find((r) => r.id === s.resource_id)?.title || "（资源已删除）",
        user_key: s.user_key,
        status: s.status,
        screenshot_count: s.screenshot_count,
        created_at: s.created_at,
        images: s.images || [],
      }));
  },

  async getSubmission(id: string): Promise<Submission | null> {
    const all = await demoOps.listSubmissions();
    return all.find((s) => s.id === id) || null;
  },

  async deleteSubmission(id: string): Promise<void> {
    demoSave((st) => {
      st.submissions = st.submissions.filter((x) => x.id !== id);
    });
  },

  async isApproved(resourceId: string, userKey: string): Promise<boolean> {
    const st = demoLoad();
    const task = demoTaskFor(st, resourceId);
    const required = task && !task.enabled ? 0 : REQUIRED_SCREENSHOTS;
    if (required <= 0) return false;
    const total = st.submissions
      .filter((s) => s.resource_id === resourceId && s.user_key === userKey && s.status === "approved")
      .reduce((sum, s) => sum + s.screenshot_count, 0);
    return total >= required;
  },

  async resetDemoData(): Promise<void> {
    demoReset();
  },
};

// ===================== 统一出口 =====================

export type ResourceListOptions = {
  search?: string;
  categoryId?: string | null;
  publishedOnly?: boolean;
  homeOnly?: boolean;
  hotOnly?: boolean;
  limit?: number;
};

const ops = isSupabaseConfigured() ? supabaseOps : demoOps;

export const getSiteSettings = ops.getSiteSettings.bind(ops);
export const saveSiteSettings = ops.saveSiteSettings.bind(ops);
export const listCategories = ops.listCategories.bind(ops);
export const createCategory = ops.createCategory.bind(ops);
export const updateCategory = ops.updateCategory.bind(ops);
export const deleteCategory = ops.deleteCategory.bind(ops);
export const listResources = ops.listResources.bind(ops);
export const getResource = ops.getResource.bind(ops);
export const createResource = ops.createResource.bind(ops);
export const updateResource = ops.updateResource.bind(ops);
export const deleteResource = ops.deleteResource.bind(ops);
export const moveResource = ops.moveResource.bind(ops);
export const incrementViews = ops.incrementViews.bind(ops);
export const getTask = ops.getTask.bind(ops);
export const saveTask = ops.saveTask.bind(ops);
export const listAnnouncements = ops.listAnnouncements.bind(ops);
export const createAnnouncement = ops.createAnnouncement.bind(ops);
export const updateAnnouncement = ops.updateAnnouncement.bind(ops);
export const deleteAnnouncement = ops.deleteAnnouncement.bind(ops);
export const createSubmission = ops.createSubmission.bind(ops);
export const listSubmissions = ops.listSubmissions.bind(ops);
export const getSubmission = ops.getSubmission.bind(ops);
export const deleteSubmission = ops.deleteSubmission.bind(ops);
export const isApproved = ops.isApproved.bind(ops);
export const resetDemoData = ops.resetDemoData.bind(ops);

export const getSiteSettingsCached = cache(getSiteSettings);

export { demoVerifyPassword, demoSetToken, demoCheckToken, demoSetPassword, demoLoad, isSupabaseConfigured };

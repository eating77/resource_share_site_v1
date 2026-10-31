import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DEFAULT_SETTINGS, SiteSettings } from "../types";

/**
 * 本地演示模式数据存储（服务端 JSON 文件）。
 * 仅在没有配置 Supabase 环境变量时启用，用于在本地（Node.js 运行时）体验完整功能。
 * 生产环境必须切换到 Supabase，本地数据不具备多用户与云端能力。
 *
 * ⚠️ 本文件只能在 Node.js 运行时被打包（依赖 fs/path/crypto）。
 * 通过 next.config.js 的 webpack alias 控制：
 *   - nodejs 运行时 → 本文件（demo-store.node.ts）
 *   - edge 运行时   → demo-store.edge.ts（桩实现，调用即报配置错误）
 * 业务代码一律从 "@/node-only/demo-store" 导入，不要直接引用本文件。
 */

export type DemoCategory = { id: string; name: string; icon: string; sort_order: number };
export type DemoResource = {
  id: string;
  title: string;
  category_id: string | null;
  category_name: string;
  description: string;
  cover_emoji: string;
  cover_url: string;
  tags: string[];
  size: string;
  rating: number;
  views: number;
  sort_order: number;
  is_published: boolean;
  is_home: boolean;
  is_hot: boolean;
  drive_url: string;
  extract_code: string;
  detail_content: string;
  created_at: string;
};
export type DemoTask = {
  id: string;
  resource_id: string;
  enabled: boolean;
  title: string;
  description: string;
  steps: { title: string; description: string; display_text: string; keyword: string; comment: string; image_hint: string }[];
  required_screenshots: number;
  success_message: string;
  button_text: string;
};
export type DemoSubmission = {
  id: string;
  resource_id: string;
  user_key: string;
  status: string;
  screenshot_count: number;
  created_at: string;
  images: string[];
};
export type DemoAnnouncement = {
  id: string;
  title: string;
  content: string;
  position: string;
  enabled: boolean;
  sort_order: number;
  created_at: string;
};

export type DemoStore = {
  version: number;
  categories: DemoCategory[];
  resources: DemoResource[];
  tasks: DemoTask[];
  submissions: DemoSubmission[];
  site_settings: SiteSettings;
  announcements: DemoAnnouncement[];
  admin: { email: string; password_hash: string; salt: string; token: string | null } | null;
};

const STORE_PATH = path.join(process.cwd(), "data", "demo-store.json");

const SEED_CATEGORIES: DemoCategory[] = [
  { id: "cat-games", name: "游戏资源", icon: "🎮", sort_order: 1 },
  { id: "cat-ai", name: "AI工具", icon: "✦", sort_order: 2 },
  { id: "cat-study", name: "学习资料", icon: "▤", sort_order: 3 },
  { id: "cat-office", name: "办公模板", icon: "▣", sort_order: 4 },
  { id: "cat-design", name: "设计素材", icon: "🎨", sort_order: 5 },
  { id: "cat-video", name: "影视资源", icon: "▶", sort_order: 6 },
  { id: "cat-utils", name: "实用工具", icon: "⚒", sort_order: 7 },
  { id: "cat-software", name: "软件工具", icon: "⌘", sort_order: 8 },
];

function seedResources(): DemoResource[] {
  const cat = (name: string) => {
    const c = SEED_CATEGORIES.find((x) => x.name === name);
    return c ? c.id : null;
  };
  const now = new Date().toISOString();
  const rows: Omit<DemoResource, "created_at">[] = [
    { id: "bear-stitch", title: "轻松熊刺绣教程", category_id: cat("学习资料"), category_name: "学习资料", description: "适合初学者的刺绣图案与步骤说明，整理清晰，方便随时学习。", cover_emoji: "🧸", cover_url: "", tags: ["手工", "教程", "热门"], size: "33MB", rating: 4.9, views: 3200, sort_order: 1, is_published: true, is_home: true, is_hot: true, drive_url: "https://example.com/replace-with-your-drive-link", extract_code: "DEMO8", detail_content: "这是一份演示数据，请在后台「资源管理」中替换为你有权分享的真实资源。\n\n包含：基础针法图解、成品样式参考、常见问题整理。" },
    { id: "music-vip", title: "酷我音乐VIP解锁版", category_id: cat("软件工具"), category_name: "软件工具", description: "软件资源介绍示例。发布前请确保资源来源合法、拥有分享权限，并填写真实的获取说明。", cover_emoji: "🎵", cover_url: "", tags: ["软件工具", "音乐"], size: "100MB", rating: 5.0, views: 2800, sort_order: 2, is_published: true, is_home: true, is_hot: false, drive_url: "https://example.com/replace-with-your-drive-link", extract_code: "DEMO2", detail_content: "演示数据：请在后台替换为真实软件资源与合法的分享链接。" },
    { id: "design-pack", title: "插画设计素材大礼包", category_id: cat("设计素材"), category_name: "设计素材", description: "适合设计练习的素材整理示例，可在后台替换成你有权分享的实际资源。", cover_emoji: "🎨", cover_url: "", tags: ["设计素材", "素材"], size: "245MB", rating: 4.8, views: 1900, sort_order: 3, is_published: true, is_home: true, is_hot: false, drive_url: "https://example.com/replace-with-your-drive-link", extract_code: "ART26", detail_content: "演示数据：请在后台替换为你有权分享的真实素材包。" },
    { id: "ai-guide", title: "ChatGPT高效使用指南", category_id: cat("AI工具"), category_name: "AI工具", description: "常见 AI 使用场景与提示词整理，适合初学者快速上手。", cover_emoji: "🤖", cover_url: "", tags: ["AI工具", "指南", "热门"], size: "5MB", rating: 4.9, views: 1200, sort_order: 4, is_published: true, is_home: true, is_hot: true, drive_url: "https://example.com/replace-with-your-drive-link", extract_code: "AI2026", detail_content: "演示数据：包含提示词模板、常见场景示例与注意事项。" },
    { id: "windows-tool", title: "Windows效率工具合集", category_id: cat("实用工具"), category_name: "实用工具", description: "日常效率工具资源合集示例，具体内容和兼容性请在发布时补充。", cover_emoji: "🪟", cover_url: "", tags: ["实用工具", "效率"], size: "8MB", rating: 4.7, views: 1000, sort_order: 5, is_published: true, is_home: true, is_hot: false, drive_url: "https://example.com/replace-with-your-drive-link", extract_code: "WIN88", detail_content: "演示数据：请在后台替换为真实工具合集。" },
    { id: "study-template", title: "大学生学习规划模板", category_id: cat("学习资料"), category_name: "学习资料", description: "可替换为你的学习计划、笔记模板或其他原创资料。", cover_emoji: "📚", cover_url: "", tags: ["学习资料", "模板"], size: "12MB", rating: 4.8, views: 860, sort_order: 6, is_published: true, is_home: true, is_hot: false, drive_url: "https://example.com/replace-with-your-drive-link", extract_code: "STUDY", detail_content: "演示数据：包含周计划模板、月度目标表与复盘表格。" },
  ];
  return rows.map((r) => ({ ...r, created_at: now }));
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function seedStore(): DemoStore {
  return {
    version: 1,
    categories: SEED_CATEGORIES,
    resources: seedResources(),
    tasks: [],
    submissions: [],
    site_settings: DEFAULT_SETTINGS,
    announcements: [
      {
        id: "announce-1",
        title: "资源持续更新中",
        content: "有需要的资源？先搜索看看，更多内容即将整理上架。",
        position: "notice",
        enabled: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
    admin: {
      email: "admin@demo.local",
      salt: crypto.randomBytes(16).toString("hex"),
      password_hash: "",
      token: null,
    },
  };
}

let cache: DemoStore | null = null;

function load(): DemoStore {
  if (cache) return cache;
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as DemoStore;
      // 基础结构校验与升级兜底
      cache = {
        version: 1,
        categories: parsed.categories ?? [],
        resources: parsed.resources ?? [],
        tasks: parsed.tasks ?? [],
        submissions: parsed.submissions ?? [],
        site_settings: { ...DEFAULT_SETTINGS, ...(parsed.site_settings ?? {}) },
        announcements: parsed.announcements ?? [],
        admin: parsed.admin ?? null,
      };
      return cache;
    } catch {
      // 损坏则重建
    }
  }
  cache = seedStore();
  // 初始化管理员密码哈希（使用演示默认密码，仅演示模式）
  if (cache.admin) {
    cache.admin.password_hash = hashPassword("admin123456", cache.admin.salt);
  }
  persist(cache, false);
  return cache;
}

function persist(store: DemoStore, throwOnError = true) {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tmp, STORE_PATH);
  } catch {
    // 只读文件系统（如 Vercel）无法写入本地演示数据；读操作仍可在内存中工作
    if (throwOnError) {
      throw new Error("演示模式需要可写的本地文件系统；线上部署请在环境变量中配置 Supabase 后再使用后台。");
    }
  }
}

export function demoLoad(): DemoStore {
  return load();
}

export function demoSave(next: (s: DemoStore) => void) {
  const store = load();
  next(store);
  persist(store);
  cache = store;
}

export function demoVerifyPassword(email: string, password: string): boolean {
  const store = load();
  if (!store.admin) return false;
  if (store.admin.email.toLowerCase() !== email.trim().toLowerCase()) return false;
  const hash = hashPassword(password, store.admin.salt);
  return hash === store.admin.password_hash;
}

export function demoSetToken(token: string | null) {
  demoSave((s) => {
    if (s.admin) s.admin.token = token;
  });
}

export function demoCheckToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const store = load();
  return Boolean(store.admin && store.admin.token === token);
}

export function demoReset() {
  cache = null;
  if (fs.existsSync(STORE_PATH)) {
    try {
      fs.unlinkSync(STORE_PATH);
    } catch {
      // 忽略
    }
  }
  load();
}

export function demoSetPassword(newPassword: string) {
  demoSave((s) => {
    if (!s.admin) return;
    s.admin.salt = crypto.randomBytes(16).toString("hex");
    s.admin.password_hash = hashPassword(newPassword, s.admin.salt);
    s.admin.token = null;
  });
}

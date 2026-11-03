import { createServiceSupabase, SCREENSHOTS_BUCKET } from "./supabase";
import { supabaseUrl, isSupabaseConfigured } from "./env";

/** 演示模式的本地文件写入按运行时二选一（NEXT_RUNTIME 构建期字面量替换 + 死代码消除，edge 包不含 fs） */
const { saveLocalUpload }: typeof import("./node-only/local-fs.node") =
  process.env.NEXT_RUNTIME === "edge"
    ? require("./node-only/local-fs.edge")
    : require("./node-only/local-fs.node");

/**
 * 截图上传服务（Edge Runtime 兼容）。
 * - 不引入 node:path / node:crypto / Buffer，全部使用 Web 标准 API；
 * - 演示模式的本地文件写入被隔离在 @node-only/local-fs（edge 构建时替换为桩实现）。
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"] as const;

/** 取小写扩展名（含点），等价于 path.extname 但不依赖 node:path */
function extname(name: string): string {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return "";
  return name.slice(i).toLowerCase();
}

/** 通过文件头魔数校验真实图片类型，防止伪造扩展名上传非图片文件 */
function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  // WEBP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "webp";
  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "gif";
  return null;
}

/**
 * 把检测结果映射为标准 MIME 与存储扩展名。
 * 检测返回的是统一别名（jpeg/png/webp/gif），这里统一转为标准 MIME
 * （如 jpeg → image/jpeg），避免把非标准的 image/jpg 传给 Supabase 而被拒。
 */
const MIME_BY_TYPE: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};
const EXT_BY_TYPE: Record<string, string> = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  gif: ".gif",
};

/**
 * 保存一张截图。Supabase 模式上传至私有存储桶；演示模式写入 public/uploads。
 * 返回可公开访问的 URL。
 */
export async function saveScreenshotImage(data: Uint8Array, originalName: string): Promise<string> {
  const ext = extname(originalName || "");
  const allowedExt = ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number]);
  if (!allowedExt) throw new Error("不支持的图片格式，仅支持 JPG/PNG/WEBP/GIF");
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new Error("图片大小超过 5MB 限制");
  const detected = detectImageType(data);
  if (!detected) throw new Error("文件内容不是有效的图片，请重新选择");
  const finalExt = EXT_BY_TYPE[detected];
  const contentType = MIME_BY_TYPE[detected] || `image/${detected}`;

  if (isSupabaseConfigured()) {
    const name = `${crypto.randomUUID()}${finalExt}`;
    const sb = createServiceSupabase();
    const { error } = await sb.storage
      .from(SCREENSHOTS_BUCKET)
      .upload(name, data, { contentType, upsert: false });
    if (error) throw new Error("上传到云端存储失败：" + error.message);
    return `${supabaseUrl()}/storage/v1/object/public/${SCREENSHOTS_BUCKET}/${name}`;
  }

  const localName = `${Date.now()}-${crypto.randomUUID()}${finalExt}`;
  saveLocalUpload(localName, data);
  return `/uploads/${localName}`;
}

/** 校验图片 URL 是否属于本站上传（防止提交伪造的外部链接） */
export function isLocalUploadUrl(url: string): boolean {
  if (url.startsWith("/uploads/")) return true;
  if (isSupabaseConfigured() && url.startsWith(`${supabaseUrl()}/storage/v1/object/public/${SCREENSHOTS_BUCKET}/`)) {
    return true;
  }
  return false;
}

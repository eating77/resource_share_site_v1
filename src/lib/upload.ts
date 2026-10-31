import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createServiceSupabase, SCREENSHOTS_BUCKET } from "./supabase";
import { supabaseUrl, isSupabaseConfigured } from "./env";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"] as const;

/** 通过文件头魔数校验真实图片类型，防止伪造扩展名上传非图片文件 */
function detectImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  // WEBP: RIFF....WEBP
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  // GIF
  if (buf.toString("ascii", 0, 4) === "GIF8") return "gif";
  return null;
}

/**
 * 保存一张截图。Supabase 模式上传至私有存储桶；演示模式写入 public/uploads。
 * 返回可公开访问的 URL。
 */
export async function saveScreenshotImage(buffer: Buffer, originalName: string): Promise<string> {
  const ext = path.extname(originalName || "").toLowerCase();
  const allowedExt = ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number]);
  if (!allowedExt) throw new Error("不支持的图片格式，仅支持 JPG/PNG/WEBP/GIF");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new Error("图片大小超过 5MB 限制");
  const detected = detectImageType(buffer);
  if (!detected) throw new Error("文件内容不是有效的图片，请重新选择");
  const finalExt = detected === "jpg" ? ".jpg" : `.${detected}`;

  if (isSupabaseConfigured()) {
    const name = `${crypto.randomUUID()}${finalExt}`;
    const sb = createServiceSupabase();
    const { error } = await sb.storage
      .from(SCREENSHOTS_BUCKET)
      .upload(name, buffer, { contentType: `image/${detected}`, upsert: false });
    if (error) throw new Error("上传到云端存储失败：" + error.message);
    return `${supabaseUrl()}/storage/v1/object/public/${SCREENSHOTS_BUCKET}/${name}`;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  const name = `${Date.now()}-${crypto.randomUUID()}${finalExt}`;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), buffer);
  } catch {
    throw new Error("演示模式需要可写的本地文件系统；线上部署请在环境变量中配置 Supabase 存储。");
  }
  return `/uploads/${name}`;
}

/** 校验图片 URL 是否属于本站上传（防止提交伪造的外部链接） */
export function isLocalUploadUrl(url: string): boolean {
  if (url.startsWith("/uploads/")) return true;
  if (isSupabaseConfigured() && url.startsWith(`${supabaseUrl()}/storage/v1/object/public/${SCREENSHOTS_BUCKET}/`)) {
    return true;
  }
  return false;
}

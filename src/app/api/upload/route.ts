import { NextRequest, NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES, saveScreenshotImage } from "@/lib/upload";
import { getVisitorKey } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/** 截图上传接口：仅接受图片，服务端校验格式魔数与大小，返回可访问 URL */
export async function POST(request: NextRequest) {
  const visitor = getVisitorKey();
  const limitKey = `upload:${visitor || clientIp(request)}`;
  const limited = rateLimit(limitKey, 30, 5 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "未收到文件" }, { status: 400 });
    }
    // 先根据 Content-Length / 文件大小拦截，避免把超大文件读进内存造成内存压力
    if (typeof file.size !== "number" || file.size <= 0) {
      return NextResponse.json({ ok: false, error: "文件为空或大小异常" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "图片大小超过 5MB 限制" }, { status: 400 });
    }
    if (file.type && !file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "仅支持上传图片文件" }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "图片大小超过 5MB 限制" }, { status: 400 });
    }
    const url = await saveScreenshotImage(bytes, file.name);
    return NextResponse.json({ ok: true, data: { url } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上传失败";
    const isBadRequest =
      msg.includes("格式") || msg.includes("大小") || msg.includes("内容") || msg.includes("不支持") || msg.includes("空");
    return NextResponse.json({ ok: false, error: msg }, { status: isBadRequest ? 400 : 500 });
  }
}

import fs from "fs";
import path from "path";

/**
 * 仅 Node.js 运行时可用的本地上传存储（演示模式：写入 public/uploads）。
 *
 * 通过 next.config.js 的 webpack alias 控制：
 *   - nodejs 运行时 → 本文件（local-fs.node.ts）
 *   - edge 运行时   → local-fs.edge.ts（桩实现，调用即报配置错误）
 * 业务代码一律从 "@/node-only/local-fs" 导入，不要直接引用本文件。
 */

export function saveLocalUpload(name: string, data: Uint8Array): void {
  const dir = path.join(process.cwd(), "public", "uploads");
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), data);
  } catch {
    throw new Error("演示模式需要可写的本地文件系统；线上部署请在环境变量中配置 Supabase 存储。");
  }
}

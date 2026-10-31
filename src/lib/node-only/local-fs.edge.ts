/**
 * Edge Runtime 桩实现。
 *
 * 本地文件系统在 Cloudflare Pages 上不可用，截图必须走 Supabase Storage。
 * 通过 next.config.js 的 webpack alias 在 edge 构建时替换 local-fs.node.ts。
 */

export function saveLocalUpload(_name: string, _data: Uint8Array): void {
  throw new Error(
    "本地文件上传在 Edge Runtime（Cloudflare Pages）上不可用：请配置 Supabase 环境变量后使用云端存储。"
  );
}

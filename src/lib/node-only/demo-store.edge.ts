import type {
  DemoStore,
} from "./demo-store.node";

/**
 * Edge Runtime 桩实现。
 *
 * 演示模式依赖本地文件系统（fs）与 Node crypto（scrypt），
 * 在 Cloudflare Pages 的 Edge Runtime 上不可用。
 * 生产环境必须配置 Supabase：db.ts 顶部的运行时护栏会在进入演示分支之前拦截。
 *
 * 本文件通过 next.config.js 的 webpack alias 在 edge 构建时替换
 * demo-store.node.ts，保证 fs/node:crypto 永远不进入 edge 依赖图。
 */

export type {
  DemoCategory,
  DemoResource,
  DemoTask,
  DemoSubmission,
  DemoAnnouncement,
  DemoStore,
} from "./demo-store.node";

function edgeUnsupported(): never {
  throw new Error(
    "演示模式在 Edge Runtime（Cloudflare Pages）上不可用：请配置 Supabase 环境变量（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）。"
  );
}

export function demoLoad(): DemoStore {
  edgeUnsupported();
}

export function demoSave(_next: (s: DemoStore) => void): void {
  edgeUnsupported();
}

export function demoVerifyPassword(_email: string, _password: string): boolean {
  edgeUnsupported();
}

export function demoSetToken(_token: string | null): void {
  edgeUnsupported();
}

export function demoCheckToken(_token: string | undefined | null): boolean {
  edgeUnsupported();
}

export function demoReset(): void {
  edgeUnsupported();
}

export function demoSetPassword(_newPassword: string): void {
  edgeUnsupported();
}

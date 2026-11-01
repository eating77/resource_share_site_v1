#!/usr/bin/env node
/**
 * @cloudflare/next-on-pages 的统一构建入口。
 *
 * 为什么需要这个包装：
 * 1) Cloudflare 上不要用 `npx @cloudflare/next-on-pages@1` —— npx 会去 registry
 *    重新拉一个最新版并独立解析依赖，绕开本项目的 package-lock.json 与 .npmrc，
 *    于是报 ERESOLVE peer 冲突。这里改为调用 node_modules 里已装好、版本已锁定
 *    （1.13.16）的官方 CLI，不联网、不重新解析依赖。
 * 2) Windows 本机：next-on-pages 内部用 spawn("npx", ["vercel", "build"]) 调 Vercel CLI，
 *    node 的 spawn 在 Windows 上不会解析 .cmd 垫片，会直接报 `spawn npx ENOENT`。
 *    因此 Windows 下同进程加载 dist/index.js 并给 "npx" 的 spawn 补 shell:true
 *    （只影响本进程，不改依赖源码、不碰任何版本校验）。
 *    Linux/macOS（含 Cloudflare 构建机）走官方 bin 入口，行为与原生完全一致。
 */
import cp from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/@cloudflare/next-on-pages",
);
const cliEntry = path.join(pkgRoot, "dist/index.js");
const binEntry = path.join(pkgRoot, "bin/index.js");

// 注意：曾有一段对 @vercel/next 打补丁（patch-vercel-manifest.mjs，关闭动态路由清单裁剪）
// 的实验性修复，但实测无效且会污染构建产物，现已废弃。所有动态段路由已改为 ?id= 查询参数，
// 不存在动态段函数映射问题，故不再打任何补丁。

if (process.platform !== "win32") {
  // 官方入口：bin/index.js 内部用 process.execPath 起子进程跑真实 CLI
  await import(pathToFileURL(binEntry).href);
} else {
  const origSpawn = cp.spawn;
  // @ts-expect-error 保持与 node spawn 相同的签名
  cp.spawn = function (command, args, options) {
    if (command === "npx") {
      return origSpawn(command, args, { ...(options || {}), shell: true });
    }
    return origSpawn(command, args, options);
  };
  await import(pathToFileURL(cliEntry).href);
}

#!/usr/bin/env node
/**
 * @cloudflare/next-on-pages 的 Windows 包装脚本。
 *
 * 原因：next-on-pages 内部用 spawn("npx", ["vercel", "build"]) 调用 Vercel CLI，
 * 在 Windows 上 node 的 spawn 不会解析 .cmd 垫片，直接报 `spawn npx ENOENT`。
 * 这里对 "npx" 的调用强制加 shell:true（仅影响本进程，不改依赖源码）。
 * 在 Linux/macOS（含 Cloudflare Pages 构建机）上行为与官方 CLI 完全一致。
 */
import cp from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const origSpawn = cp.spawn;
// @ts-expect-error 保持与 node spawn 相同的签名
cp.spawn = function (command, args, options) {
  if (command === "npx" && process.platform === "win32") {
    return origSpawn(command, args, { ...(options || {}), shell: true });
  }
  return origSpawn(command, args, options);
};

const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/@cloudflare/next-on-pages/dist/index.js");
await import(pathToFileURL(cliPath).href);

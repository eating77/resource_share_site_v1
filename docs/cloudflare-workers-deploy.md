# 部署文档：Cloudflare Workers + OpenNext

> 目标：把 `resource_share_site_v1` 部署到 Cloudflare Workers，绑定 `zidy.top`，保留全部后台功能（登录、增删改、截图上传、领取流程）。
>
> 本文档基于 2026-10 实测版本：`@opennextjs/cloudflare@1.20.15`、`next@15.5.28`、`wrangler@4.156.0`。
> 所有版本号均来自 npm registry 实际查询，非推测。

> **执行状态（2026-10-31）**
> 第 5～11 步的代码改造已在分支 `feat/cloudflare-workers` 完成并本地验证通过：
> - `next build` ✅ 通过（全部路由为动态渲染 `ƒ`）
> - `opennextjs-cloudflare build` ✅ 生成 `.open-next/worker.js`
> - `wrangler deploy --dry-run` ✅ 配置合法，**gzip 后 1232.76 KiB**（免费版上限 3 MiB，余量充足）
>
> 剩余工作是需要你在 Cloudflare 控制台完成的动作：配环境变量、接 GitHub、绑域名（第 14～16 步）。

---

## 目录

1. [结论先行：为什么不能用 Pages 静态导出](#1-结论先行为什么不能用-pages-静态导出)
2. [请求链路与架构](#2-请求链路与架构)
3. [版本约束（硬限制）](#3-版本约束硬限制)
4. [前置条件](#4-前置条件)
5. [第一步：升级 Next.js 14 → 15](#5-第一步升级-nextjs-14--15)
6. [第二步：让代码适配 Workers 运行时](#6-第二步让代码适配-workers-运行时)
7. [第三步：安装依赖](#7-第三步安装依赖)
8. [第四步：wrangler.jsonc](#8-第四步wranglerjsonc)
9. [第五步：open-next.config.ts](#9-第五步open-nextconfigts)
10. [第六步：package.json 脚本](#10-第六步packagejson-脚本)
11. [第七步：next.config.js 调整](#11-第七步nextconfigjs-调整)
12. [第八步：public/_headers](#12-第八步public_headers)
13. [第九步：本地预览验证](#13-第九步本地预览验证)
14. [第十步：环境变量（两套，别搞混）](#14-第十步环境变量两套别搞混)
15. [第十一步：接 GitHub 自动部署](#15-第十一步接-github-自动部署)
16. [第十二步：绑定自定义域名 zidy.top](#16-第十二步绑定自定义域名-zidy-top)
17. [第十三步：上线验收清单](#17-第十三步上线验收清单)
18. [故障排查](#18-故障排查)
19. [限制、成本与回滚](#19-限制成本与回滚)

---

## 1. 结论先行：为什么不能用 Pages 静态导出

最初的计划是 **Cloudflare Pages + Next.js (Static HTML Export) + `output: 'export'` + 输出目录 `out`**。这套方案对本项目**不可用**，原因有三层：

| 问题 | 具体后果 |
|---|---|
| `npx next export` 命令已不存在 | Next 13.3 起移除，14.x 执行直接报错。项目是 `next@14.2.25` |
| 静态导出会丢弃全部服务端能力 | 项目有 **20 个 `src/app/api/**/route.ts`** + `src/middleware.ts`。导出后这些全部消失，后台登录、资源增删改、截图提交、领取校验一律 404 |
| 与现有代码直接冲突 | `src/app/layout.tsx` 有 `export const dynamic = "force-dynamic"`，静态导出不支持；`next.config.js` 的 `headers()` 安全响应头在静态托管下不生效 |

本质上：**这不是一个纯前端站点**。数据写入依赖 Supabase 服务端密钥，演示模式还要用 `fs` 写本地文件——静态托管承载不了。

所以改用 **Cloudflare Workers**：

- 保留全部 API 路由、middleware、Supabase SSR Cookie 鉴权
- 同样是 Cloudflare 免费额度内，同样免备案
- `zidy.top` 一样能绑，访问速度一致（都在 Cloudflare 边缘网络）

> Cloudflare 官方的 Next.js Pages 集成（`@cloudflare/next-on-pages`）已进入维护状态，官方推荐路径就是 OpenNext + Workers。不要再用 Pages 接 Next.js。

---

## 2. 请求链路与架构

```
浏览器
  │
  ▼
Cloudflare 边缘节点 (zidy.top)
  │
  ├─ 静态资源 (/_next/static/*, /images/*)  ──► ASSETS 绑定，直接返回，不唤醒 Worker
  │
  └─ 动态请求 (/、/admin、/api/*)
        │
        ▼
     Worker: .open-next/worker.js
        │  内部跑的是 Next.js Node.js 运行时（不是 Edge 运行时）
        │  nodejs_compat 提供 Buffer / crypto / process.env
        │
        ├─► src/middleware.ts    下发 rs_vid 匿名标识、刷新 Supabase 会话
        ├─► src/app/**/page.tsx  服务端渲染
        └─► src/app/api/**       路由处理器
                │
                ▼
           Supabase (Postgres + Storage)
             · anon key   → 读取/会话
             · service_role key → 后台写入、截图上传（仅服务端）
```

关键点：**Worker 运行的是 Node.js 运行时，不是 Edge 运行时**。这是它与旧的 next-on-pages 最重要区别——`Buffer`、`node:crypto`、`process.env` 都能用，`fs` 也在，但**文件系统只读**（这一点决定了第 6 节）。

---

## 3. 版本约束（硬限制）

`@opennextjs/cloudflare@1.20.15` 的 `peerDependencies` 实际值：

```json
{
  "next": ">=15.5.28 <16 || >=16.4.1",
  "wrangler": "^4.148.0",
  "rclone.js": "^0.6.6"
}
```

这条 `next` 约束是本次部署最关键的信息：**项目当前的 `next@14.2.25` 不被支持，必须升级。**

官方兼容性说明（opennext.js.org/cloudflare）：

> All minor and patch versions of Next.js 16 and the latest minors of Next.js 14 and 15 are supported. **Next.js 14 support will be dropped Q1 2026.**

现在已是 2026 年 10 月，Next 14 支持早已移除。而且 Next 14 本身也过了官方维护期，不再收安全补丁——升级本身是应该做的。

### 版本选择

| 组件 | 目标版本 | 说明 |
|---|---|---|
| `next` | **`15.5.28`** | 恰好是适配器要求的最低版本，也是 15.x 最新。风险最小 |
| `react` / `react-dom` | `^19` | Next 15 App Router 要求 React 19 |
| `@opennextjs/cloudflare` | `^1.20.15` | 最新稳定版 |
| `wrangler` | `^4.156.0` | 满足 `^4.148.0` |
| Node（构建机） | **20 或 22** | 不要用 18 |

**为什么选 15 而不是 16？** Next 16.4.3 虽然也满足约束，但 Next 16 彻底删除了同步访问 `cookies()` / `params` 的兼容层，改造面大得多。先用 15.5.28 上线，之后从容迁 16。

---

## 4. 前置条件

- [x] GitHub 仓库已就绪：`https://github.com/eating77/resource_share_site_v1`（代码已推送）
- [ ] Cloudflare 账号，且 **`zidy.top` 已在该账号下托管**（NS 已指向 Cloudflare）
- [ ] Supabase 项目已创建，`supabase/init.sql` 已执行（建表 + `increment_views` 函数 + `task-screenshots` 存储桶）
- [ ] 本地 Node 20 / 22

> 域名不在同一个 Cloudflare 账号下时，Workers 的自定义域名绑定会失败。先去确认 `zidy.top` 的 NS 记录。

---

## 5. 第一步：升级 Next.js 14 → 15

### 5.1 改依赖

```bash
npm install next@15.5.28 react@^19 react-dom@^19
npm install -D @types/react@^19 @types/react-dom@^19 eslint-config-next@15.5.28
```

### 5.2 必须改的代码（不改则 `next build` 类型检查失败）

Next 15 把 `params`、`searchParams` 改成了 **Promise**，并且会对页面 props 做类型校验。声明成同步对象会直接编译报错。

**（1）`src/app/resource/[id]/page.tsx`**

```ts
// 改前
export default async function ResourceDetailPage({ params }: { params: { id: string } }) {
  const [settings, resource] = await Promise.all([getSiteSettingsCached(), getResource(params.id)]);

// 改后
export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [settings, resource] = await Promise.all([getSiteSettingsCached(), getResource(id)]);
```

**（2）另外 3 个页面，同样处理**（都是 `params: { id: string }`）：

- `src/app/category/[id]/page.tsx`
- `src/app/admin/resources/[id]/page.tsx`
- `src/app/resource/[id]/success/page.tsx`

**（3）`src/app/search/page.tsx`**

```ts
// 改前
type Props = { searchParams: { q?: string | string[] } };
export default async function SearchPage({ searchParams }: Props) {

// 改后
type Props = { searchParams: Promise<{ q?: string | string[] }> };
export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
```

### 5.3 API 路由的 `params`（容易漏！）

**这一项极易被忽略**：路由处理器的 `ctx.params` 同样是 Promise，不改会在 `next build` 阶段报
`Type '{ __tag__: "PUT"; ... }' does not satisfy the constraint 'ParamCheck<RouteContext>'`。

共 **7 个文件**，两种写法：

**（1）用 `type Ctx` 的 5 个文件** —— 改类型 + 每个 handler 内 `await ctx.params`：

```ts
// 改前
type Ctx = { params: { id: string } };
// 改后
type Ctx = { params: Promise<{ id: string }> };

// 每个用到 id 的 handler（PUT / GET / DELETE / POST）里加一行：
try {
  const { id } = await ctx.params;   // ← 新增
  ...
  await updateResource(id, { ... }); // ctx.params.id → id
```

涉及文件：

- `src/app/api/announcements/[id]/route.ts`
- `src/app/api/categories/[id]/route.ts`
- `src/app/api/resources/[id]/route.ts`
- `src/app/api/resources/[id]/task/route.ts`
- `src/app/api/submissions/[id]/route.ts`

**（2）内联类型的 3 个文件**：

- `src/app/api/resources/[id]/claim/route.ts`
- `src/app/api/resources/[id]/claim-status/route.ts`
- `src/app/api/resources/[id]/view/route.ts`

```ts
// 改前
export async function POST(_request: Request, ctx: { params: { id: string } }) {
  try {
    const resource = await getResource(ctx.params.id);

// 改后
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const resource = await getResource(id);
```

> 注意：`src/app/resource/[id]/success/page.tsx` 是**客户端组件**（`"use client"`），
> 不能用 `await`，要用 React 的 `use()`：
>
> ```tsx
> import { use, useEffect, useState } from "react";
> export default function SuccessPage({ params }: { params: Promise<{ id: string }> }) {
>   const { id } = use(params);
> ```

### 5.4 `tsconfig.json` 的编译目标

Next 15 默认目标已升到 `ES2017`，本项目 `tsconfig.json` 里显式写着 `"target": "es5"`，会导致：

```
Type 'Map<string, Bucket>' can only be iterated through when using the '--downlevelIteration' flag
```

改一行：

```json
"target": "ES2017"
```

> Workers 运行在 V8 上，现代目标是安全且更优的选择（体积更小、无需 downlevel 辅助代码）。

### 5.5 一处类型收窄修复

`src/app/api/submissions/route.ts` 里 `Array.from(new Set(rawUrls))` 会被推导成 `unknown[]`，
需要显式标注：

```ts
const rawUrls: string[] = Array.isArray(body?.imageUrls)
  ? (body.imageUrls as unknown[])
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.slice(0, 2048))
  : [];

const imageUrls: string[] = Array.from(new Set(rawUrls));
```

### 5.6 `cookies()` 的两条路线

`cookies()` 在 Next 15 变成异步。本项目有 **3 处**同步调用：

- `src/lib/supabase.ts:19` — `createServerSupabase()`
- `src/lib/auth.ts:40` — `getAdminEmail()` 一类
- `src/lib/auth.ts:113` — `getVisitorKey()`

上游还有 `src/lib/db.ts` 里 **8 处** `createServerSupabase()`，以及 `getVisitorKey()` 的 **9 处**调用（分布在 4 个 API 路由）。

**路线 A：快速上线（推荐先用这条）**

用 Next 15 官方提供的逃生舱，保持函数签名不变，零波及：

```ts
import { cookies, type UnsafeUnwrappedCookies } from "next/headers";

// src/lib/supabase.ts
const cookieStore = cookies() as unknown as UnsafeUnwrappedCookies;

// src/lib/auth.ts（两处同样处理）
const token = (cookies() as unknown as UnsafeUnwrappedCookies).get(ADMIN_COOKIE)?.value;
```

运行时正常，只在 dev 打一条 deprecation 警告。**代价**：Next 16 时这套 cast 会失效，需要重做。

**路线 B：彻底迁移（半天工作量，Next 16 前必须做）**

`createServerSupabase()` 改成 `async`，然后给 `db.ts` 里 8 处调用加 `await`（这些方法本身都是 `async`，只是加个 await）；`getVisitorKey()` 同样改 `async`，4 个 API 路由的调用点加 `await`。

> 建议：本次部署走 A，上线稳定后单独开一个分支做 B。两件事不要混在一次改动里。

### 5.7 验证

```bash
npm run build
```

必须看到 `Compiled successfully` 且无类型错误。**这一步不过，不要往下走。**

顺便开 `npm run dev` 点一遍：首页、搜索、资源详情、后台登录、后台新增资源。

---

## 6. 第二步：让代码适配 Workers 运行时

这一步是**静态导出方案不会遇到、但 Workers 一定会遇到**的问题。

### 6.1 演示模式在 Workers 上必然失败

两个致命点：

**（a）文件系统只读。** `src/lib/demo-store.ts:75`：

```ts
const STORE_PATH = path.join(process.cwd(), "data", "demo-store.json");
```

Workers 上 `process.cwd()` 返回 `/`，`/data/demo-store.json` 不存在且不可写。`persist()` 会抛错：

> 演示模式需要可写的本地文件系统；线上部署请在环境变量中配置 Supabase 后再使用后台。

**（b）`scryptSync` 不可用。** `demo-store.ts` 的 `hashPassword()` 用 `crypto.scryptSync`，workerd 的 Node crypto 兼容层不支持 scrypt。而 `load()` 在种子化时会立刻调用它——**所以未配置 Supabase 时，连首页渲染都会 500**，不是只有后台坏。

### 6.2 处理方式

**必须配置 Supabase 环境变量**，让 `isSupabaseConfigured()` 返回 true，代码才会走 `supabaseOps` 分支。

同时建议加一道显式护栏，把「配置漏了」变成可读的错误，而不是一串栈。在 `src/lib/db.ts` 的 `const ops = ...` 之前插入：

```ts
// 生产环境（Workers）不支持演示模式的本地文件读写，必须配置 Supabase
if (process.env.NODE_ENV === "production" && !isSupabaseConfigured()) {
  throw new Error(
    "生产环境缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY。" +
      "演示模式依赖本地文件系统，无法在 Cloudflare Workers 上运行。"
  );
}
```

### 6.3 其他 Workers 相关行为

| 位置 | 情况 | 处理 |
|---|---|---|
| `src/lib/upload.ts:51-55` | 演示模式写 `public/uploads` | Supabase 模式走 Storage，不受影响。护栏加上后这条分支不会被走到 |
| `src/lib/rate-limit.ts` | 内存 `Map` 限流 | Workers 每个 isolate 独立计数，且 isolate 会被回收。**只能算弱防护**，不能当可靠限流。要可靠限流得上 Durable Objects 或 Cloudflare Rate Limiting 规则 |
| `src/middleware.ts` `crypto.randomUUID()` | ✅ 支持 | 无需改动 |
| `src/app/api/upload/route.ts` `Buffer` | ✅ 支持 | 需 `nodejs_compat` 标志（第 8 节已配） |
| `next.config.js` 的 `headers()` | 部分生效 | 服务端渲染响应正常；静态资源走 ASSETS 绑定，需靠 `public/_headers` 补（第 12 节） |

---

## 7. 第三步：安装依赖

```bash
npm install @opennextjs/cloudflare@^1.20.15
npm install -D wrangler@^4.156.0
```

> `rclone.js` 和 `wrangler` 是 peer 依赖，npm 7+ 会自动装。若出现 `ERESOLVE`，先确认 `next` 是否已到 `15.5.28`——版本不对时报的错会伪装成 peer 冲突。

---

## 8. 第四步：wrangler.jsonc

项目根目录新建 `wrangler.jsonc`：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "resource-share-site",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": [
    // Node.js API 兼容层（Buffer / node:crypto / process.env），必需
    "nodejs_compat",
    // 允许应用内发起对外 fetch（访问 Supabase 必需）
    "global_fetch_strictly_public"
  ],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "services": [
    {
      "binding": "WORKER_SELF_REFERENCE",
      "service": "resource-share-site"
    }
  ],
  "observability": {
    "enabled": true
  }
}
```

要点：

- `compatibility_date` 必须 **≥ 2024-09-23**，否则 `nodejs_compat` 行为不完整
- `name` 里的 `resource-share-site` 必须和 `services[].service` 完全一致
- `main` / `assets.directory` 是 OpenNext 的固定产物路径，不要改
- **不需要 R2 绑定**。本项目 `layout.tsx` 是 `force-dynamic`，全站动态渲染，没有 ISR 增量缓存需求（原因见下一节）

---

## 9. 第五步：open-next.config.ts

根目录新建：

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 全站 force-dynamic（src/app/layout.tsx），无 ISR，因此不启用 R2 增量缓存
export default defineCloudflareConfig();
```

**不要照抄官方模板里的 `incrementalCache: r2IncrementalCache`**——那需要先在账号里建 R2 桶并在 `wrangler.jsonc` 里绑定 `NEXT_INC_CACHE_R2_BUCKET`，否则构建/部署会报找不到绑定。本项目用不到。

后续如果想把某些页面改成 ISR（去掉 `force-dynamic` 换 `revalidate`），再补 R2，届时把注释换成：

```ts
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
```

---

## 10. 第六步：package.json 脚本

`scripts` 改成：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
  }
}
```

`build` 保持 `next build` 不要改——`opennextjs-cloudflare build` 会调用它。

---

## 11. 第七步：next.config.js 调整

### 11.1 确认没有静态导出配置

当前 `next.config.js` **没有** `output: 'export'`，✅ 不用改。如果之前按旧计划加过，必须删掉——它和 Workers 部署互斥。

### 11.2 可选：接入本地 bindings 支持

本项目没用到 Cloudflare bindings（KV / R2 / D1），这一步可以跳过。若后续要用，在 `next.config.js` 末尾加：

```js
// 仅本地 next dev 时需要，用于在开发环境模拟 Cloudflare bindings
if (process.env.NODE_ENV === "development") {
  require("@opennextjs/cloudflare").initOpenNextCloudflareForDev();
}
```

### 11.3 CSP 无需改动

现有 CSP 里 `connect-src 'self' https: wss:` 已经放行 Supabase 的 HTTPS 与 WSS；`img-src` 含 `https:` 能加载 Supabase Storage 的图片。部署后如果控制台报 CSP 拦截，优先检查是不是新增了某个外部域。

### 11.4 安全响应头的实际生效范围

`headers()` 返回的 CSP / HSTS / X-Frame-Options 等，对 **Worker 返回的动态响应**有效；`/_next/static/*` 这类静态资源由 ASSETS 绑定直接返回，不经过 Worker，拿不到这些头。这是正常现象，静态资源的安全头优先级低，不必强求。

---

## 12. 第八步：public/_headers

新建 `public/_headers`（Cloudflare 静态资源头配置，构建时会进 `.open-next/assets`）：

```
/_next/static/*
  Cache-Control: public,max-age=31536000,immutable

/fonts/*
  Cache-Control: public,max-age=31536000,immutable
```

带内容哈希的静态资源用一年 immutable 缓存，这是 OpenNext 官方推荐配置，能显著降低回源。

---

## 13. 第九步：本地预览验证

**先本地跑通再上云**，别把问题留到 CI 里排查。

```bash
# 1. 建 .dev.vars（本地预览用，不要提交）
```

`.dev.vars`：

```
NEXTJS_ENV=development
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

```bash
# 2. 构建 + 在 Workers 运行时里本地预览
npm run preview
```

`npm run preview` 会用 workerd 真实运行时跑一遍，比 `next dev` 更接近线上。**如果这里能跑通，线上基本不会出问题。**

重点验：

- 首页正常渲染，**顶部没有"本地演示模式"黄色横幅**
- `/admin/login` 能登录，登录后不掉线
- 后台新增一条资源 → 刷新后还在（说明写进 Supabase 了）
- 上传一张截图 → 返回 Supabase Storage 地址

> `.dev.vars` 已在 `.gitignore` 中（`.dev.vars` / `.dev.vars.*`），不会被提交。

---

## 14. 第十步：环境变量（两套，别搞混）

这是最容易踩坑的地方：**Workers 的「构建期变量」和「运行时变量」是两个独立面板，互不相通。**

### 14.1 为什么需要两套

Next.js 在**构建时**就把 `process.env.NEXT_PUBLIC_*` 的**字面值替换**进了产物代码。所以：

- `NEXT_PUBLIC_*` → **必须在构建期就存在**，否则前端代码里就是 `undefined`，改运行时变量也救不回来
- `SUPABASE_SERVICE_ROLE_KEY`（无 `NEXT_PUBLIC_` 前缀）→ 运行时读取，必须配成**加密 Secret**

### 14.2 配置位置

**（A）构建期变量** — Worker → **Settings → Build → Build variables and secrets**

| 变量 | 值 | 类型 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | 明文 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | 明文 |
| `NODE_VERSION` | `20` | 明文（可选，需锁定 Node 版本时加） |

**（B）运行时变量** — Worker → **Settings → Variables and Secrets**

| 变量 | 值 | 类型 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 同上（冗余，但建议加） | 明文 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上（冗余，但建议加） | 明文 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **Secret（加密）** |

CLI 方式配 Secret：

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### 14.3 密钥安全铁律

- `SUPABASE_SERVICE_ROLE_KEY` **绝不允许**加 `NEXT_PUBLIC_` 前缀 —— 加了就会被内联进浏览器 JS 包，等于把数据库最高权限公开
- 不要写进 `wrangler.jsonc` 的 `vars`（会明文进仓库）
- 不要提交 `.env` / `.dev.vars`
- 项目里 `createServiceSupabase()` 只在服务端调用，这个隔离已经做对了，保持即可

> 泄漏了怎么办：Supabase 控制台 → Settings → API → 轮换 service_role key，然后更新 Worker Secret 并重新部署。

---

## 15. 第十一步：接 GitHub 自动部署

### 15.1 为什么用 Workers Builds 而不是本地 `npm run deploy`

**因为你的开发机是 Windows。** OpenNext 官方明确写了：

> OpenNext can be used on Windows systems but **Windows full support is not guaranteed**.
> Next.js tooling itself has Windows support issues and OpenNext is built on these tools.

官方建议：用 WSL，或者**用 Linux 环境的 CI/CD（如 GitHub Actions / Cloudflare Workers Builds）来构建部署**。

你的代码已经在 GitHub 上了，直接走 Workers Builds 最省事：构建在 Cloudflare 的 Linux 环境跑，本地只负责写代码。

### 15.2 操作步骤

1. Cloudflare 控制台 → **Workers & Pages** → **Create** → **Workers** → **Connect to Git**
2. 授权 GitHub，选中 `eating77/resource_share_site_v1`
3. 填写构建配置：

| 配置项 | 值 |
|---|---|
| Production branch | `main` |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | 留空（仓库根就是项目根） |
| Node version | 20（或由 `NODE_VERSION` 变量指定） |

4. 回到 **Settings → Build → Build variables** 填 `NEXT_PUBLIC_*`（第 14.2 A）
5. 回到 **Settings → Variables and Secrets** 填运行时变量（第 14.2 B）
6. **Save and Deploy**，看构建日志

> 顺序很重要：**先配变量，再触发构建**。变量配晚了，第一次构建出来的包 `NEXT_PUBLIC_*` 是空的，站点会白屏或 500。

构建成功的标志（日志末尾大致长这样）：

```
Total Upload: xxxx KiB / gzip: xxxx KiB
Uploaded resource-share-site
Deployed resource-share-site triggers
  https://resource-share-site.<你的子域>.workers.dev
```

先访问 `*.workers.dev` 这个地址确认站点正常，再绑域名。

### 15.3 备选：本地 CLI 部署

如果你有 WSL 环境，也可以本地推：

```bash
npx wrangler login          # 一次性授权
npm run deploy
```

Windows 原生终端不建议——`npm run build` 阶段可能因路径/软链问题失败。

---

## 16. 第十二步：绑定自定义域名 zidy.top

1. Worker 详情页 → **Settings** → **Domains & Routes** → **Add** → **Custom domain**
2. 填入 `zidy.top`（根域，不带 www）
3. Cloudflare 自动创建 DNS 记录（根域用 CNAME flattening，无需手动改）并开启橙色云代理
4. 等待证书签发（通常 1–3 分钟，状态从 `Initializing` → `Active`）

补充：

- 想同时支持 `www.zidy.top`，**再加一条** Custom domain 填 `www.zidy.top`，或建一条 Redirect Rule 把 www 301 到根域
- 域名必须**已经**在同一个 Cloudflare 账号下托管，否则这里会直接报「zone not found」
- Workers 自定义域名在**免费计划**就支持，不需要付费

验证：

```bash
curl -I https://zidy.top
```

应看到 `HTTP/2 200`，且响应头里带 `content-security-policy`、`strict-transport-security`（说明请求确实走到了 Worker，`headers()` 生效了）。

---

## 17. 第十三步：上线验收清单

按顺序过一遍，全绿才算部署完成。

**基础可用性**

- [ ] `https://zidy.top` 返回 200，首页正常渲染
- [ ] 页面顶部**没有**"本地演示模式"横幅
- [ ] 浏览器控制台无红色报错，无 CSP 拦截
- [ ] 手机 4G 网络访问正常（验证不是仅本地可访问）

**后台功能（核心）**

- [ ] `/admin/login` 用管理员账号能登录
- [ ] 登录后刷新页面**仍处于登录态**（证明 Supabase SSR Cookie 在 Workers 上正常写入）
- [ ] 新增分类成功
- [ ] 新增资源并保存成功，列表能看到
- [ ] 编辑资源、上下移动排序、删除资源均正常
- [ ] 上传封面/截图 → 返回 Supabase Storage URL 且能打开
- [ ] 公告新增/编辑正常
- [ ] 网站外观设置（主色等）保存后前台生效

**前台流程**

- [ ] 搜索页输入关键词能出结果
- [ ] 分类页跳转正常
- [ ] 资源详情页能打开，公开接口**不泄露** `drive_url` / `extract_code`
- [ ] 领取任务流程：上传截图 → 校验通过 → 看到网盘链接

**性能与安全**

- [ ] `/_next/static/*` 响应头含 `cache-control: public,max-age=31536000,immutable`
- [ ] 动态响应头含 CSP
- [ ] 后台接口未登录时返回 401，不是 200
- [ ] Supabase 控制台里能查到刚才写入的数据（确认不是写到内存里假成功）

---

## 18. 故障排查

| 现象 | 根因 | 处理 |
|---|---|---|
| `Unknown command: export` | 还在用 `next export` | Next 13.3 已移除；本项目根本不用静态导出，走 OpenNext |
| `ERESOLVE could not resolve` / peer 冲突 | `next` 版本低于 `15.5.28` | `npm i next@15.5.28` 后再装适配器 |
| 构建报 `Type 'params' is not assignable` | 没改 Next 15 的 Promise 化 props | 按第 5.2 节改 5 个页面 |
| 构建报 `Property 'get' does not exist on type 'Promise<...>'` | 同步访问 `cookies()` | 按第 5.3 节路线 A 加 `UnsafeUnwrappedCookies` cast |
| 运行时报 `Cannot find module 'node:fs'` / `Buffer is not defined` | 没开 `nodejs_compat` | 检查 `wrangler.jsonc` 的 `compatibility_flags`，并确认 `compatibility_date ≥ 2024-09-23` |
| 报 `crypto.scryptSync is not a function` | 跑到了演示模式 | 环境变量没生效，`isSupabaseConfigured()` 为 false。检查构建期变量 |
| 站点白屏、前端请求 `undefined/api/...` | `NEXT_PUBLIC_*` 构建期缺失，被内联成 `undefined` | 在 **Build variables** 补齐后**重新构建**（改运行时变量无效） |
| 登录成功但刷新就掉线 | Supabase 会话 Cookie 未写入 / middleware 未执行 | 检查 `middleware.ts` 是否被正确打包；确认域名是 HTTPS |
| 上传截图 500 | 缺 `SUPABASE_SERVICE_ROLE_KEY` | 补运行时 Secret，重新部署 |
| 上传报 `Bucket not found` | 没执行 `supabase/init.sql` 或没建 `task-screenshots` 桶 | 补建存储桶 |
| 部署报 `Worker exceeded size limit` | 超过 3 MiB（免费）/ 10 MiB（付费）压缩后体积 | 看日志里 gzip 后的数值；超了就升付费计划或裁剪依赖 |
| Windows 本地 `npm run build` 失败 | OpenNext 对 Windows 支持不完整 | 改用 Workers Builds（Linux），或用 WSL |
| Windows 下 opennext 调子进程构建报 `EPERM ... .next\trace` | 嵌套构建进程被安全软件/文件锁拦截 | 拆成两步：先 `next build`，再 `opennextjs-cloudflare build --skipNextBuild`（见下方命令） |
| `--skipNextBuild` 报 `ENOENT ... .next\standalone\...pages-manifest.json` | 跳过了 Next 构建，缺少 standalone 产物 | 构建时补上 OpenNext 内部使用的环境变量（见下方命令） |
| 自定义域名报 `zone not found` | `zidy.top` 不在该 Cloudflare 账号 | 先把域名 NS 迁到该账号 |
| 绑了域名但打开是 Cloudflare 522/1033 | 证书未签发完 / Worker 未部署成功 | 等 3–5 分钟；查 Deployments 是否 Success |
| 静态资源 404 | 构建产物 `.open-next/assets` 未生成 | 确认 `npm run build` 在 opennext 构建**之前**成功执行 |
| 后台操作偶发失效 | `rate-limit.ts` 内存计数在 isolate 间不共享 | 属预期行为，不是 bug；要可靠限流需上 Durable Objects |

### Windows 下的应急构建路径（已验证）

`opennextjs-cloudflare build` 内部会用 `execSync` 再调一次 `npm run build`。在某些 Windows 环境
（安全软件、文件锁、受限沙箱）下，这个嵌套进程会因 `EPERM` 失败。可以拆成两步手动执行：

```bash
# 1) 清掉旧产物
rm -rf .next .open-next

# 2) 以 standalone 模式构建（这两个变量正是 OpenNext 内部会注入的）
NEXT_PRIVATE_STANDALONE=true \
NEXT_PRIVATE_OUTPUT_TRACE_ROOT="$(pwd)" \
npm run build

# 3) 只做 OpenNext 转换，不再触发嵌套构建
npx opennextjs-cloudflare build --skipNextBuild

# 4) 校验产物与体积（不会真的部署）
npx wrangler deploy --dry-run
```

成功标志：

```
Worker saved in `.open-next\worker.js` 🚀
OpenNext build complete.
```

`--dry-run` 会打印实际体积，例如本项目实测 `gzip: 1232.76 KiB`，低于免费版 3 MiB 上限。

> 这是本地应急方案。线上仍建议用 Workers Builds（Linux），一次都不会踩到这些坑。

**通用排查入口**

```bash
# 实时看线上日志（推荐，比控制台翻页快）
npx wrangler tail resource-share-site
```

Cloudflare 控制台 → Worker → **Logs** 里也能看到 `observability` 开启后的请求日志与异常栈。

---

## 19. 限制、成本与回滚

### 免费额度

| 项目 | 免费额度 | 本项目评估 |
|---|---|---|
| 请求数 | 100,000 次/天 | 个人资源站通常远低于此 |
| CPU 时间 | 10ms/请求（免费计划） | ⚠️ **风险点**：SSR + Supabase 往返可能超。若大量 1102 错误，需升付费 |
| Worker 体积 | 3 MiB（压缩后） | ✅ **已实测 1232.76 KiB**，约 1.2 MiB，余量充足 |
| 自定义域名 | 支持 | ✅ |

**付费计划 $5/月起**：CPU 时间放宽到 30 秒、体积 10 MiB。如果上线后频繁出现 `Error 1102 (exceeded CPU)`，就是该升级了。

### 已知限制

- **首次请求冷启动**：Worker 冷启动通常 <50ms，比传统 Serverless 快很多，基本无感
- **无持久本地磁盘**：这也是为什么必须用 Supabase，不能靠本地 JSON 文件
- **内存限流不可靠**：见 6.3，多 isolate 各自计数
- **Worker 无状态**：任何进程内缓存（如 `demo-store.ts` 的 `cache` 变量）在 isolate 回收后丢失

### 回滚

Worker 天然带版本管理：

- 控制台 → Worker → **Deployments** → 选中上一个成功版本 → **Rollback**
- 或 CLI：`npx wrangler rollback`

回滚只影响 Worker 代码，**不影响 Supabase 数据**。若某次改动引入了数据库 schema 变更，回滚代码未必能回滚数据——所以改 `supabase/init.sql` 前先备份。

### 合规提醒

- 境外托管无需 ICP 备案，但**国内部分地区访问速度可能偏慢**，这是物理距离决定的，不是配置问题
- 禁止上传侵权资源。资源站的合规风险主要来自用户上传内容与分享的网盘链接，后台已有的截图审核流程建议保留并真正执行

---

## 附录：本次改动的文件清单

| 文件 | 动作 |
|---|---|
| `package.json` | next→15.5.28、react/react-dom→19；新增 `@opennextjs/cloudflare`、`wrangler`；新增 preview/deploy/cf-typegen 脚本 |
| `package-lock.json` | 随依赖更新 |
| `tsconfig.json` | `target`: `es5` → `ES2017` |
| `wrangler.jsonc` | **新建** |
| `open-next.config.ts` | **新建** |
| `public/_headers` | **新建** |
| `next.config.js` | 末尾加 `initOpenNextCloudflareForDev`（仅 dev，带 try/catch） |
| `src/lib/supabase.ts` | `createServerSupabase()` 用 `UnsafeUnwrappedCookies`（快路径） |
| `src/lib/auth.ts` | 2 处 `cookies()` 同上（快路径） |
| `src/lib/db.ts` | 新增生产环境配置护栏（排除构建阶段） |
| `src/app/resource/[id]/page.tsx` | `params` 改 Promise + await |
| `src/app/category/[id]/page.tsx` | 同上 |
| `src/app/admin/resources/[id]/page.tsx` | 同上 |
| `src/app/resource/[id]/success/page.tsx` | 客户端组件，改用 `use(params)` |
| `src/app/search/page.tsx` | `searchParams` 改 Promise + await |
| `src/app/api/announcements/[id]/route.ts` | `Ctx.params` 改 Promise + 各 handler await |
| `src/app/api/categories/[id]/route.ts` | 同上 |
| `src/app/api/resources/[id]/route.ts` | 同上（4 个 handler） |
| `src/app/api/resources/[id]/task/route.ts` | 同上 |
| `src/app/api/resources/[id]/claim/route.ts` | 内联类型改 Promise + await |
| `src/app/api/resources/[id]/claim-status/route.ts` | 同上 |
| `src/app/api/resources/[id]/view/route.ts` | 同上 |
| `src/app/api/submissions/route.ts` | `imageUrls` 显式标注 `string[]` |
| `.gitignore` | 已含 `.open-next/`、`.wrangler/`、`.dev.vars*`、`/.workbuddy/` |

> 本地验证结果：`next build` ✅ / `opennextjs-cloudflare build` ✅ / `wrangler deploy --dry-run` ✅

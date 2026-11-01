# 交接文档：资源站 Cloudflare Pages 部署（查询参数改造定稿）

> 用途：在新对话中继续本任务时，把本文件内容作为背景一次性提供给 AI。

## 1. 项目与目标

- 项目目录：`C:\Users\eating\Desktop\resource_share_site_v1`
- 技术栈：Next.js **15.4.6** + React 19 + Supabase（真实云库，已导入 9 条示例资源）
- 部署目标：Cloudflare Pages，使用 `@cloudflare/next-on-pages` **1.13.16** + `vercel` CLI **47.0.4**
- Git 分支：`feat/cloudflare-workers`；Cloudflare 项目名：`resource-share-site-pages`（域名 zidy.top 绑定保留）

### 验收标准（不可偏离）

1. **无痕匿名访客**：打开资源详情、点【获取资源】→ 进入任务流程页面，**不得 307 跳到 `/admin/login`**。
2. **管理员账号**：能正常访问 `/admin/login` 和后台面板。
3. 本地/CI 验证通过后，才允许上线。

### 硬性约束

- 不要删除数据库里已导入的 **9 条示例资源**。
- 不要改动 Supabase 表结构、Cloudflare 域名 / DNS / 重定向。
- 不要修改**网盘链接**、网站**标题**。
- 管理员校验（`requireAdminApi()`）只应限定在 `/admin/*` 相关路由；资源领取 / 任务解锁接口必须公开。

## 2. 根因与最终修复

**原始 bug**：匿名访客访问资源详情页被 307 重定向到 `/admin/login`。

**根因**：next-on-pages 1.13.16 在 Next 15（15.4.x / 15.5.x）组合下，对 **`force-dynamic` + `runtime="edge"` 的动态段（`[param]`）页面** 注册失败——`/resource/[resourceId]` 的页面模块在运行时根本没被打包进去，被解析成了 `/admin/login` 页面，于是 `admin/layout.tsx` 的 `requireAdminPage()` 触发 307。同时 `/api/resources/[resourceId]` 等也被错分派到含 401 守卫的处理器。

**最终修复（已落地、已验证）**：把所有动态段路由改为 **查询参数 `?id=`**，从结构上彻底规避该 bug：

| 原动态路由 | 现查询参数路由 |
| --- | --- |
| `/resource/[resourceId]` | `/resource?id=` |
| `/resource/[resourceId]/task` | `/resource/task?id=` |
| `/resource/[resourceId]/success` | `/resource/success?id=` |
| `/category/[categoryId]` | `/category?id=` |
| `/admin/resources/[adminResourceId]` | `/admin/resources/edit?id=` |
| `/api/resources/[resourceId]` 及 `claim/claim-status/task/view` | `/api/resources?id=` 及 `/api/resources/{claim,claim-status,task,view}?id=` |
| `/api/categories/[categoryId]`、`/api/announcements/[announcementId]`、`/api/submissions/[submissionId]` | 同上加 `?id=` |

- `src/app/resource/page.tsx`：server component，`searchParams: Promise<{ id?: string }>`，`if (!id) notFound()`，`force-dynamic` + `runtime="edge"`。
- `src/app/resource/task/page.tsx`：client component，`useSearchParams().get("id")`；调用 `/api/resources?id=` 等；`router.replace("/resource/success?id=" + id)`。
- `src/components/task-entry.tsx`：按钮 `router.push("/resource/task?id=" + resourceId)`（跳页面，非弹窗；`/resource/task` 是正确生成的静态函数）。
- 所有 admin 组件、API 路由同步改为 `?id=`。

**已废弃的方案（勿回退）**：
- 动态段唯一化重命名（`[id]`→`[resourceId]` 等）：未解决根因。
- ISR fallback（`dynamicParams=true` + `generateStaticParams()`）：实测仍注册失败。
- `scripts/patch-vercel-manifest.mjs`（把 `@vercel/next` 的 `isCorrectManifests` 改成 `false`）：实测无效且污染产物，已删除；`pages-build.mjs` 不再引用它。

## 3. 构建 / 部署要点

### 关键坑：本地 Windows 构建的符号链接塌陷

next-on-pages 在 **Windows 本机构建**时，会把 `.vercel/output/functions/api/` 下所有 `.func` 目录**符号链接到 `api/admin/reset-demo.func`**（含 401 守卫），导致所有 `/api/*` 在本地预览/本地直接部署时统一返回 401。**Cloudflare Pages 是 Linux 构建，符号链接正常，该问题只在本地 Windows 出现。** 因此：

> **禁止从本地 Windows 直接 `npm run pages:deploy`**（会部署坏掉的 API）。
> 部署必须由 **Linux 构建** 产出 —— 通过 Cloudflare Git 集成，或本仓库的 GitHub Actions 工作流。

### 部署命令（仅作参考，真正上线走 CI / Git 集成）

```bash
npm ci
npx tsc --noEmit
npm run pages:build            # 生成 .vercel/output
# 仅在 Linux 环境执行：
npx wrangler pages deploy .vercel/output --project-name=resource-share-site-pages
```

`wrangler.toml`：`name = "resource-share-site-pages"`、`pages_build_output_dir = ".vercel/output/static"`、`compatibility_date = "2024-09-23"`、`compatibility_flags = ["nodejs_compat"]`。Cloudflare 会识别 `.vercel/output` 的 `functions/` + `static/` 一并部署。

### CI 工作流（`.github/workflows/pages-linux-build.yml`）

- 触发：push 到 `feat/cloudflare-workers`（及 workflow_dispatch）。
- 步骤：checkout → Node 22 → `npm ci` → `tsc --noEmit` → `npm run pages:build` → **函数清单校验**（检查所有关键 `/api/*` 与页面函数存在、每个 `.func` 的 `.vc-config.json` 的 `name` 与自身路径一致、且无两个函数解析到同一 config——即捕获符号链接塌陷）→ 若仓库配置了 `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` 则自动 `wrangler pages deploy .vercel/output --branch=feat/cloudflare-workers`。
- 校验脚本已随路由重构更新：不再检查旧动态段，改为检查 `?id=` 体系下的函数清单。

### 本地预览测试（Windows，仅用于页面级 307 验证；API 401 是本地符号链接坑，非真 bug）

```bash
npx wrangler pages dev .vercel/output/static --port 8801 --compatibility-flag=nodejs_compat
B=http://127.0.0.1:8801
curl -s -o /dev/null -w "resource=%{http_code} loc=%{redirect_url}\n" "$B/resource?id=FAKE123"   # 期望无 307
curl -s -o /dev/null -w "category=%{http_code} loc=%{redirect_url}\n" "$B/category?id=FAKE123"    # 期望无 307
curl -s -o /dev/null -w "login=%{http_code}\n" "$B/admin/login"                                  # 期望 200
```

## 4. 测试用真实数据 id

- 资源：`82fdfb4d-eafa-4757-9473-6908f2d4aec5`
- 分类：`e531d359-3963-4aaa-b60b-531c7401ad1f`

## 5. 环境备注

- `.env` / `.dev.vars` 含真实 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。
- 构建时若遇 `.next/trace` 的 EPERM，需加 trace 绕过（`scripts/no-next-trace.cjs` + `WB_NO_NEXT_TRACE=1`）。
- 切勿重新引入 `[param]` 动态段或 `isCorrectManifests` 补丁。

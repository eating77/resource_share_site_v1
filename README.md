# 资源分享平台（拾集资源库）

一个真正可用的资源分享与领取网站：管理员发布资源并配置领取任务，用户完成任务、上传截图后自动通过并领取网盘链接。

技术栈：**Next.js 14（App Router）+ TypeScript + Supabase（PostgreSQL / Auth / Storage）**

## 功能总览

- **前台**：首页（分类区 / 热门 / 最新 / 推荐区块，顺序与显隐可在后台配置）、分类页、搜索页、资源详情页、任务页（步骤 + 一键复制关键词/评论文案 + 截图上传预览）、领取成功页、404 页；移动端优先。
- **后台**（`/admin`）：管理员登录、仪表盘、资源管理（增删改 / 排序 / 上下架 / 首页展示 / 热门标记）、分类管理（含删除保护）、任务配置（步骤动态增删排序、截图数量、全部文案）、截图提交记录、网站外观设置（基本信息 / 主题颜色 / 首页布局，带实时预览）、公告管理、前台文案编辑、系统设置。
- **领取流程**：任务启用 → 用户按步骤操作 → 上传 ≥ N 张截图（服务端校验格式/大小/数量）→ 自动通过 → 服务端校验通过后返回网盘链接与提取码。
  > 自动通过仅代表「截图数量与基本格式校验通过」，不代表截图内容真实有效；后台保留提交记录供查看异常。

## 运行模式

系统自动检测环境变量，选择数据存储模式：

| 模式 | 触发条件 | 数据存储 | 说明 |
|---|---|---|---|
| **云端模式** | 已配置 Supabase 环境变量 | Supabase（表 + Auth + Storage） | 生产使用 |
| **演示模式** | 未配置环境变量 | 本地 JSON 文件 `data/demo-store.json` | 仅本地体验，页面顶部有明确标识 |

演示模式默认管理员：`admin@demo.local` / `admin123456`（登录后台后可在「系统设置」修改）。

## 本地启动（Windows）

```bash
npm install
npm run dev
```

打开 http://localhost:3000（前台），http://localhost:3000/admin（后台）。

## 生产构建

```bash
npm run build
npm run start
```

## 接入 Supabase（切换云端模式）

1. 在 [supabase.com](https://supabase.com) 免费创建项目，记录 **Project URL / anon key / service_role key**。
2. **执行数据库初始化**：打开 Supabase 控制台 → SQL Editor，整体粘贴执行根目录 [`supabase/init.sql`](supabase/init.sql)（建表 + RLS + 存储桶 + 初始分类）。
3. **创建管理员账号**：
   - 控制台 → Authentication → Users → 新建用户（填管理员邮箱 + 密码）；
   - 再回 SQL Editor 执行（把邮箱替换成你自己的）：
     ```sql
     insert into public.admin_users (user_id, email)
     select id, email from auth.users where email = '你的管理员邮箱';
     ```
4. **配置环境变量**：复制 `.env.example` 为 `.env.local` 并填写三个变量：
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
   ⚠️ `SUPABASE_SERVICE_ROLE_KEY` 是服务端专用密钥，**严禁**加 `NEXT_PUBLIC_` 前缀、严禁提交到 Git。
5. 重启 `npm run dev`，系统自动进入云端模式；用刚创建的管理员账号登录后台。

## 部署到互联网（Vercel）

1. 把项目推送到 GitHub。
2. 在 [vercel.com](https://vercel.com) → Import Project → 选择该仓库（框架自动识别 Next.js）。
3. Environment Variables 中配置与 `.env.local` 相同的三个变量。
4. Deploy 完成即可访问；后台地址 `https://你的域名/admin`。

无需购买域名即可获得 vercel.app 免费二级域名。

## 环境变量说明

| 变量 | 用途 | 是否可公开 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址（浏览器与服务端均可读） | 可公开（浏览器端） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 匿名密钥（RLS 限制权限） | 可公开（浏览器端） |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端特权密钥（绕过 RLS，用于管理写入/上传/领取校验） | **仅服务端**，严禁外泄 |

## 安全设计

- 后台登录基于 Supabase Auth + `admin_users` 表，页面与 API 双层鉴权（中间件守卫 + 服务端校验），密钥不进入浏览器。
- 领取链接由服务端 `/api/resources/[id]/claim` 在确认「任务启用 + 资源发布 + 该用户提交记录 ≥ 要求数量」后才返回，前端无法绕过。
- 截图上传在服务端校验：扩展名 + **文件头魔数**（防止伪造图片）+ 大小 ≤ 5MB；提交时校验图片 URL 来源与数量。
- 提交记录按匿名标识隔离，仅管理员可见（RLS + 服务端双重限制）。
- 数据库启用 RLS：匿名只读公开数据，全部写入仅管理员；截图存储桶限制 MIME 与大小。

## 已知限制

- 演示模式（本地 JSON）不适用于生产：无云端冗余、无多用户；切换云端模式后演示数据不会迁移。
- 匿名用户通过浏览器 Cookie（`rs_vid`）识别，清空浏览器数据后任务进度会丢失。
- 自动通过不校验截图内容真实性（有意设计，界面已明确提示）。
- 存储桶文件为公开可读（文件名随机不可枚举）；请勿引导用户上传身份证等敏感信息。

## 目录速览

```
src/
  app/             # 路由：前台页面 + admin 后台 + api 路由
  components/      # 前后台共享组件
  lib/
    types.ts       # 类型与默认设置
    db.ts          # 数据访问层（Supabase / 演示模式自动切换）
    auth.ts        # 管理员会话
    upload.ts      # 图片校验与存储
    demo-store.ts  # 演示模式 JSON 存储
supabase/init.sql  # 数据库初始化脚本（表 + RLS + 存储桶）
data/              # 演示模式数据（已 gitignore）
```

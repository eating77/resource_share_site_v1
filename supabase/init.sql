-- ============================================================
-- 资源分享平台 · Supabase 数据库初始化脚本
-- 在 Supabase 控制台 → SQL Editor 中整体执行（或使用 supabase db push）
-- ============================================================

-- 1) 分类表
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '✦',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 2) 资源表
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id uuid references public.categories(id) on delete set null,
  category_name text not null default '',
  description text not null default '',
  cover_emoji text not null default '📦',
  cover_url text not null default '',
  tags text[] not null default '{}',
  size text not null default '',
  rating numeric not null default 5,
  views int not null default 0,
  sort_order int not null default 0,
  is_published boolean not null default true,
  is_home boolean not null default true,
  is_hot boolean not null default false,
  drive_url text not null default '',
  extract_code text not null default '',
  detail_content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) 任务配置表（每个资源一条）
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null unique references public.resources(id) on delete cascade,
  enabled boolean not null default true,
  title text not null default '完成任务',
  description text not null default '',
  steps jsonb not null default '[]'::jsonb,
  required_screenshots int not null default 1 check (required_screenshots between 1 and 20),
  success_message text not null default '',
  button_text text not null default '提交截图并领取',
  updated_at timestamptz not null default now()
);

-- 4) 截图提交记录
create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  user_key text not null,
  status text not null default 'approved',
  screenshot_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_submissions_resource on public.task_submissions(resource_id, user_key);

-- 5) 提交图片
create table if not exists public.submission_images (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.task_submissions(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

-- 6) 网站设置（KV 存储，key='site' 保存整份设置 JSON）
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 7) 公告
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text not null,
  position text not null default 'notice',
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 8) 管理员表（保存管理员 user id，来自 Supabase Auth）
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- 9) 浏览数自增函数（匿名可调用，仅更新指定行）
create or replace function public.increment_views(row_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.resources set views = views + 1 where id = row_id;
$$;

-- ============================================================
-- 行级安全（RLS）
-- 策略总览：
--   · 匿名（anon）：可读 categories/resources/tasks/site_settings/announcements；
--   · 管理员（auth.uid() ∈ admin_users）：可读写全部业务表；
--   · task_submissions / submission_images：匿名不可读（防止查看他人提交），
--     写入由服务端 service_role 完成（不经 RLS），因此不开放匿名 INSERT，防止伪造提交记录。
--   · admin_users：管理员只能读取自己的行。
-- ============================================================
alter table public.categories enable row level security;
alter table public.resources enable row level security;
alter table public.tasks enable row level security;
alter table public.site_settings enable row level security;
alter table public.announcements enable row level security;
alter table public.task_submissions enable row level security;
alter table public.submission_images enable row level security;
alter table public.admin_users enable row level security;

-- 匿名可读（前台展示数据）
create policy "anon read categories" on public.categories for select using (true);
create policy "anon read resources" on public.resources for select using (true);
create policy "anon read tasks" on public.tasks for select using (true);
create policy "anon read site_settings" on public.site_settings for select using (true);
create policy "anon read announcements" on public.announcements for select using (true);

-- 提交记录仅管理员可读（防止用户查看他人私有提交记录）
create policy "admin read submissions" on public.task_submissions for select
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "admin read submission_images" on public.submission_images for select
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- 管理员表自读
create policy "admin view own row" on public.admin_users for select
  using (auth.uid() = user_id);

-- 全部业务表写入仅限管理员（纵深防御；正常流程由服务端 service_role 完成）
create policy "admin write categories" on public.categories for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "admin write resources" on public.resources for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "admin write tasks" on public.tasks for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "admin write site_settings" on public.site_settings for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "admin write announcements" on public.announcements for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "admin write submissions" on public.task_submissions for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "admin write submission_images" on public.submission_images for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- ============================================================
-- 存储桶：任务截图
-- 文件大小限制 5MB；仅允许图片 MIME；public 读取（便于后台展示），
-- 文件名为随机 UUID，不可枚举。上传由服务端 service_role 完成。
-- ============================================================
insert into storage.buckets (id, name, public)
values ('task-screenshots', 'task-screenshots', true)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'task-screenshots';

-- ============================================================
-- 初始分类（可之后在后台修改/新增）
-- ============================================================
insert into public.categories (name, icon, sort_order) values
  ('游戏资源', '🎮', 1),
  ('AI工具', '✦', 2),
  ('学习资料', '▤', 3),
  ('办公模板', '▣', 4),
  ('设计素材', '🎨', 5),
  ('影视资源', '▶', 6),
  ('实用工具', '⚒', 7),
  ('软件工具', '⌘', 8)
on conflict (name) do nothing;

-- ============================================================
-- 创建管理员（重要！二选一执行）
-- 方式一（推荐）：Supabase 控制台 → Authentication → Users → 新建用户（邮箱+密码）
--   然后在 SQL Editor 执行：
--   insert into public.admin_users (user_id, email)
--   select id, email from auth.users where email = '你的管理员邮箱';
-- 方式二（SQL 直建，密码需先用 Supabase 提供的哈希）：
--   参考文档 https://supabase.com/docs/guides/database/managing-user-data
-- ============================================================

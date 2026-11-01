-- ============================================================
-- 拾集资源库 · 初始示例资源（可按需增删）
-- 在 Supabase 控制台 → SQL Editor 中整体执行。
-- category_id 通过「分类名」自动匹配，无需手填 UUID。
-- 重复执行不会报错（依赖下方去重：同名同分类已存在则跳过）。
-- ============================================================

insert into public.resources
  (title, category_id, category_name, description, cover_emoji, tags, size, rating, views, is_published, is_home, is_hot, drive_url, extract_code, detail_content)
select
  v.title, c.id, c.name, v.description, v.cover_emoji, v.tags, v.size, v.rating, v.views,
  true, true, v.is_hot, v.drive_url, v.extract_code, v.detail_content
from (values
  -- 游戏资源
  ('原神资源整合包', '游戏资源', '包含角色培养素材、地图攻略与实用工具合集。', '🎮', array['游戏','攻略','素材'], '1.2GB', 4.9, 1820, true, 'https://pan.example.com/genshin', 'GEN8', '网盘内附使用说明。'),
  ('Steam 喜加一合集', '游戏资源', '每周免费游戏与折扣整理，附领取教程。', '🕹️', array['游戏','折扣','教程'], '320MB', 4.7, 940, false, 'https://pan.example.com/steam', '', '详情见网盘说明。'),
  ('独立像素游戏素材库', '游戏资源', '可商用的像素美术与音效素材合集。', '🎨', array['素材','像素','美术'], '560MB', 4.8, 1330, true, 'https://pan.example.com/pixel', 'PIX9', '授权说明见详情。'),
  -- AI 工具
  ('AI 绘画提示词大全', 'AI工具', '覆盖人物、场景、风格的 Midjourney / SD 提示词模板。', '🤖', array['AI','绘图','提示词'], '88MB', 4.9, 2510, true, 'https://pan.example.com/ai-art', 'AI77', '持续更新。'),
  ('本地大模型部署套件', 'AI工具', 'Ollama + 常用模型一键部署与配置教程。', '🧠', array['AI','部署','教程'], '2.4GB', 4.8, 1760, true, 'https://pan.example.com/llm', 'LLM3', '适合入门。'),
  ('AI 视频字幕工具', 'AI工具', '批量语音转字幕、翻译与压制工具合集。', '🎬', array['AI','字幕','效率'], '410MB', 4.6, 880, false, 'https://pan.example.com/sub', '', '说明见网盘。'),
  -- 学习资料
  ('考研英语核心词汇', '学习资料', '高频词汇带例句与记忆法整理。', '📚', array['考研','英语','词汇'], '120MB', 4.9, 3120, true, 'https://pan.example.com/kaoyan', 'KY28', '适合反复背诵。'),
  ('Python 入门到实战', '学习资料', '面向零基础的 Python 教程与练习项目。', '🐍', array['编程','Python','教程'], '680MB', 4.8, 2050, true, 'https://pan.example.com/python', 'PY66', '含示例代码。'),
  ('高效笔记法模板', '学习资料', 'Notion / Obsidian 双版本笔记模板。', '🗒️', array['笔记','模板','效率'], '45MB', 4.7, 1450, false, 'https://pan.example.com/notes', '', '开箱即用。')
) as v(title, category_name, description, cover_emoji, tags, size, rating, views, is_hot, drive_url, extract_code, detail_content)
join public.categories c on c.name = v.category_name
where not exists (
  select 1 from public.resources r where r.title = v.title and r.category_name = v.category_name
);

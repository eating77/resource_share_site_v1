/** 领取任务要求上传的截图数量：全站统一固定为 3 张，不提供自定义 */
export const REQUIRED_SCREENSHOTS = 3;

export type Category = {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
};

export type Resource = {
  id: string;
  title: string;
  category_id: string | null;
  category_name: string;
  description: string;
  cover_emoji: string;
  cover_url: string;
  tags: string[];
  size: string;
  rating: number;
  views: number;
  sort_order: number;
  is_published: boolean;
  is_home: boolean;
  is_hot: boolean;
  drive_url: string;
  extract_code: string;
  detail_content: string;
  created_at: string;
};

export type TaskStep = {
  title: string;
  description: string;
  display_text: string;
  keyword: string;
  comment: string;
  image_hint: string;
};

export type Task = {
  id: string;
  resource_id: string;
  enabled: boolean;
  title: string;
  description: string;
  steps: TaskStep[];
  required_screenshots: number;
  success_message: string;
  button_text: string;
};

export type Submission = {
  id: string;
  resource_id: string;
  resource_title: string;
  user_key: string;
  status: string;
  screenshot_count: number;
  created_at: string;
  images: string[];
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  position: string;
  enabled: boolean;
  sort_order: number;
  created_at: string;
};

export type SiteSettings = {
  // 基本信息
  name: string;
  subtitle: string;
  logo: string;
  logo_url: string;
  tab_title: string;
  description: string;
  footer: string;
  icp: string;
  contact: string;
  kefu_text: string;
  kefu_url: string;
  // 主题颜色
  primary_color: string;
  accent_color: string;
  button_color: string;
  // 首页布局
  hero_title: string;
  hero_subtitle: string;
  search_placeholder: string;
  category_title: string;
  claim_domain: string;
  hot_title: string;
  latest_title: string;
  featured_title: string;
  show_categories: boolean;
  show_hot: boolean;
  show_latest: boolean;
  show_featured: boolean;
  home_resource_count: number;
  home_block_order: string[];
  // 文案
  copy_search_empty: string;
  copy_get_button: string;
  copy_task_start: string;
  copy_upload_hint: string;
  copy_upload_count: string;
  copy_upload_success: string;
  copy_auto_pass: string;
  copy_claim_success: string;
  copy_copy_success: string;
  copy_error: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  name: "小紫资源库",
  subtitle: "精选优质资源 · 免费领取",
  logo: "☁",
  logo_url: "",
  tab_title: "全网热门资源库",
  description: "整理优质资源，一站式搜索与领取。",
  footer: "© 2026 小紫资源库 · 仅做分享，收藏网址不迷路",
  icp: "",
  contact: "",
  kefu_text: "联系客服",
  kefu_url: "",
  primary_color: "#7c3aed",
  accent_color: "#6d28d9",
  button_color: "#7c3aed",
  hero_title: "海量优质资源\n一站式免费领取",
  hero_subtitle: "学习资料、软件工具、实用模板……精选整理，持续更新，帮你提升效率，收获更多可能！",
  search_placeholder: "输入资源名称、关键词或分类...",
  category_title: "资源分类",
  claim_domain: "xxx.yyy",
  hot_title: "🔥 热门下载",
  latest_title: "🆕 最新发布",
  featured_title: "⭐ 编辑推荐",
  show_categories: true,
  show_hot: true,
  show_latest: true,
  show_featured: true,
  home_resource_count: 8,
  home_block_order: ["hot", "latest", "featured"],
  copy_search_empty: "没有找到匹配的资源，试试其他关键词吧。",
  copy_get_button: "获取资源",
  copy_task_start: "开始任务",
  copy_upload_hint: "请按任务要求上传对应数量的截图，支持 JPG、PNG、WEBP 等常见图片格式。",
  copy_upload_count: "已上传 {current} / {total} 张",
  copy_upload_success: "提交成功！系统已自动通过。",
  copy_auto_pass: "达到规定数量后自动放行，不需要人工审核。",
  copy_claim_success: "截图已提交，系统自动通过。请使用下方链接获取资源。",
  copy_copy_success: "已复制到剪贴板",
  copy_error: "页面出错了，请稍后重试。",
};

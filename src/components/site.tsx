"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Resource, SiteSettings } from "@/lib/types";

/* ---------- 复制按钮（兼容手机浏览器） ---------- */
export function CopyButton({
  text,
  label,
  successText,
  onCopied,
  className,
}: {
  text: string;
  label?: string;
  successText?: string;
  onCopied?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
      } catch {
        window.prompt("请手动复制：", text);
      }
    }
    onCopied?.();
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button className={className ? `copy-btn ${className}` : "copy-btn"} onClick={copy} type="button">
      {copied ? (successText || "已复制 ✓") : (label || "复制")}
    </button>
  );
}

/* ---------- 顶部导航 ---------- */
export function SiteHeader({ settings, query }: { settings: SiteSettings; query?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(query || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/");
  };
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        {settings.logo_url ? (
          <span className="brand-mark brand-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logo_url} alt="logo" />
          </span>
        ) : (
          <span className="brand-mark">{settings.logo || "☁"}</span>
        )}
        <span>
          {settings.name}
          <small>{settings.subtitle}</small>
        </span>
      </Link>
      <nav className={menuOpen ? "open" : ""}>
        <Link href="/">首页</Link>
        <a href="/#all">资源分类</a>
      </nav>
      <form className="top-search" onSubmit={submit}>
        <span>⌕</span>
        <input
          aria-label="搜索资源"
          placeholder={settings.search_placeholder || "搜索资源..."}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      <div className="header-actions">
        <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="菜单">
          ☰
        </button>
      </div>
    </header>
  );
}

/* ---------- 页脚 ---------- */
export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer>
      <div>
        {settings.footer}
        {settings.icp && <span className="footer-icp">备案号：{settings.icp}</span>}
      </div>
      <div className="footer-right">
        {settings.contact && <span>联系方式：{settings.contact}</span>}
        {settings.kefu_text && settings.kefu_url && (
          <a href={settings.kefu_url} target="_blank" rel="noreferrer">
            {settings.kefu_text} →
          </a>
        )}
      </div>
    </footer>
  );
}

/* ---------- 资源卡片 ---------- */
export function ResourceCard({ resource, settings, compact }: { resource: Resource; settings: SiteSettings; compact?: boolean }) {
  return (
    <article className="resource-card">
      <Link href={`/resource?id=${resource.id}`} className="cover">
        {resource.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resource.cover_url} alt={resource.title} className="cover-img" />
        ) : (
          resource.cover_emoji || "📦"
        )}
        {resource.is_hot && <span className="cover-badge">🔥 热门</span>}
      </Link>
      <div className="resource-info">
        <div className="resource-title">{resource.title}</div>
        <span className="tag">{resource.category_name || "未分类"}</span>
        <p>{resource.description}</p>
        <div className="meta">
          <span>◉ {(resource.views || 0).toLocaleString()}</span>
          {resource.size && <span>♧ {resource.size}</span>}
          <span className="rating">★ {resource.rating}</span>
        </div>
        <Link className="get-button" href={`/resource?id=${resource.id}`}>
          {settings.copy_get_button || "获取资源"} <span>→</span>
        </Link>
      </div>
    </article>
  );
}

export function ResourceGrid({
  resources,
  settings,
  emptyText,
}: {
  resources: Resource[];
  settings: SiteSettings;
  emptyText?: string;
}) {
  if (resources.length === 0) {
    return <div className="empty">{emptyText || settings.copy_search_empty || "暂无资源"}</div>;
  }
  return (
    <div className="resource-grid">
      {resources.map((r) => (
        <ResourceCard key={r.id} resource={r} settings={settings} />
      ))}
    </div>
  );
}

/* ---------- 首页交互区（搜索 + 分类筛选，数据来自真实存储） ---------- */
export function HomeClient({
  settings,
  initialResources,
  categories,
}: {
  settings: SiteSettings;
  initialResources: Resource[];
  categories: { id: string; name: string; icon: string }[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部资源");
  const router = useRouter();
  const list = category === "全部资源" ? initialResources : initialResources.filter((r) => r.category_name === category);
  const filtered = query.trim()
    ? list.filter((r) => `${r.title} ${r.description} ${(r.tags || []).join(" ")} ${r.category_name}`.toLowerCase().includes(query.trim().toLowerCase()))
    : list;

  const heroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/");
  };
  return (
    <>
      <section className="hero" id="home">
        <div className="hero-copy">
          <span className="eyebrow">✦ 你的专属资源库</span>
          <h1>
            {(settings.hero_title || "海量优质资源").split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 ? <br /> : null}
              </span>
            ))}
          </h1>
          <p className="hero-sub">{settings.hero_subtitle}</p>
          <form className="hero-search" onSubmit={heroSearch}>
            <span>⌕</span>
            <input
              aria-label="搜索资源"
              placeholder={settings.search_placeholder || "输入资源名称、关键词或分类..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit">⌕ 搜索</button>
          </form>
        </div>
      </section>

      <section className="section" id="all">
        <div className="section-heading">
          <div>
            <h2>全部资源</h2>
            <span>{settings.subtitle}</span>
          </div>
          <button
            onClick={() => {
              setCategory("全部资源");
              setQuery("");
            }}
          >
            重置筛选 ↗
          </button>
        </div>
        <div className="filter-bar">
          <div className="filter-cats">
            <button className={category === "全部资源" ? "on" : ""} onClick={() => setCategory("全部资源")}>
              全部
            </button>
            {categories.map((c) => (
              <button key={c.id} className={category === c.name ? "on" : ""} onClick={() => setCategory(c.name)}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="filter-search">
            <span>⌕</span>
            <input
              aria-label="筛选资源"
              placeholder={settings.search_placeholder || "搜索资源..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <ResourceGrid resources={filtered} settings={settings} />
      </section>
    </>
  );
}

/* ---------- 访问量统计（详情页挂载时上报） ---------- */
export function ViewCounter({ resourceId }: { resourceId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    fetch(`/api/resources/view?id=${resourceId}`, { method: "POST" }).catch(() => {});
  }, [resourceId]);
  return null;
}

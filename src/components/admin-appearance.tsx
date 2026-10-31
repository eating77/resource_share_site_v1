"use client";

import { useEffect, useState } from "react";
import type { SiteSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { apiFetch, ColorField, StatusInline, Switch } from "@/components/admin-ui";

type Tab = "basic" | "theme" | "layout";

export function AppearanceForm({ settings }: { settings: SiteSettings }) {
  const [tab, setTab] = useState<Tab>("basic");
  const [form, setForm] = useState<SiteSettings>({ ...DEFAULT_SETTINGS, ...settings });
  const [status, setStatus] = useState<{ type: "success" | "error" | "info" | ""; text: string }>({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    setStatus({ type: "info", text: "保存中..." });
    try {
      await apiFetch("/api/site-settings", { method: "PUT", body: JSON.stringify(form) });
      setStatus({ type: "success", text: "设置已保存，前台立即生效" });
      setDirty(false);
    } catch (e) {
      setStatus({ type: "error", text: e instanceof Error ? e.message : "保存失败" });
    } finally {
      setBusy(false);
    }
  };

  const restoreDefaults = (scope: Tab) => {
    if (scope === "theme") {
      setForm((f) => ({ ...f, primary_color: DEFAULT_SETTINGS.primary_color, accent_color: DEFAULT_SETTINGS.accent_color, button_color: DEFAULT_SETTINGS.button_color }));
    } else if (scope === "basic") {
      setForm((f) => ({
        ...f,
        name: DEFAULT_SETTINGS.name,
        subtitle: DEFAULT_SETTINGS.subtitle,
        logo: DEFAULT_SETTINGS.logo,
        logo_url: DEFAULT_SETTINGS.logo_url,
        tab_title: DEFAULT_SETTINGS.tab_title,
        description: DEFAULT_SETTINGS.description,
        footer: DEFAULT_SETTINGS.footer,
        icp: DEFAULT_SETTINGS.icp,
        contact: DEFAULT_SETTINGS.contact,
        kefu_text: DEFAULT_SETTINGS.kefu_text,
        kefu_url: DEFAULT_SETTINGS.kefu_url,
      }));
    } else {
      setForm((f) => ({
        ...f,
        hero_title: DEFAULT_SETTINGS.hero_title,
        hero_subtitle: DEFAULT_SETTINGS.hero_subtitle,
        search_placeholder: DEFAULT_SETTINGS.search_placeholder,
        category_title: DEFAULT_SETTINGS.category_title,
        claim_domain: DEFAULT_SETTINGS.claim_domain,
        hot_title: DEFAULT_SETTINGS.hot_title,
        latest_title: DEFAULT_SETTINGS.latest_title,
        featured_title: DEFAULT_SETTINGS.featured_title,
        show_categories: DEFAULT_SETTINGS.show_categories,
        show_hot: DEFAULT_SETTINGS.show_hot,
        show_latest: DEFAULT_SETTINGS.show_latest,
        show_featured: DEFAULT_SETTINGS.show_featured,
        home_resource_count: DEFAULT_SETTINGS.home_resource_count,
        home_block_order: [...DEFAULT_SETTINGS.home_block_order],
      }));
    }
    setDirty(true);
  };

  const color = (v: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : "#109b83");

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>网站外观设置</h2>
          <p style={{ color: "#8b9c99", fontSize: 12, margin: "4px 0 0" }}>修改标题、颜色、首页文案与区块，保存后前台立即生效，无需改代码。</p>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === "basic" ? "on" : ""} onClick={() => setTab("basic")}>
          基本信息
        </button>
        <button className={tab === "theme" ? "on" : ""} onClick={() => setTab("theme")}>
          主题颜色
        </button>
        <button className={tab === "layout" ? "on" : ""} onClick={() => setTab("layout")}>
          首页布局
        </button>
      </div>

      <div className="panel">
        {tab === "basic" && (
          <div className="form-grid">
            <div className="field">
              <label>网站名称</label>
              <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="field">
              <label>网站副标题</label>
              <input type="text" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
            </div>
            <div className="field">
              <label>Logo 文字/Emoji（未设置 Logo 图片时展示）</label>
              <input type="text" value={form.logo} maxLength={8} onChange={(e) => set("logo", e.target.value)} />
            </div>
            <div className="field">
              <label>Logo 图片 URL（可选）</label>
              <input type="url" value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://... 或 /uploads/xxx.png" />
            </div>
            <div className="field">
              <label>浏览器标签页标题</label>
              <input type="text" value={form.tab_title} onChange={(e) => set("tab_title", e.target.value)} />
            </div>
            <div className="field">
              <label>网站简介（SEO 描述）</label>
              <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="field full">
              <label>页脚文字</label>
              <input type="text" value={form.footer} onChange={(e) => set("footer", e.target.value)} />
            </div>
            <div className="field">
              <label>备案信息</label>
              <input type="text" value={form.icp} onChange={(e) => set("icp", e.target.value)} placeholder="如 京ICP备xxxxxxxx号（留空不显示）" />
            </div>
            <div className="field">
              <label>联系方式</label>
              <input type="text" value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="邮箱 / 微信号等" />
            </div>
            <div className="field">
              <label>客服入口文字</label>
              <input type="text" value={form.kefu_text} onChange={(e) => set("kefu_text", e.target.value)} />
            </div>
            <div className="field">
              <label>客服链接</label>
              <input type="url" value={form.kefu_url} onChange={(e) => set("kefu_url", e.target.value)} placeholder="https://..." />
            </div>
            <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
              <button className="btn primary" onClick={save} disabled={busy}>
                {busy ? "保存中..." : "保存基本信息"}
              </button>
              <button className="btn ghost" onClick={() => restoreDefaults("basic")}>
                恢复默认
              </button>
              {dirty && <span className="badge orange">有未保存修改</span>}
            </div>
          </div>
        )}

        {tab === "theme" && (
          <>
            <div className="form-grid" style={{ maxWidth: 520 }}>
              <ColorField label="主色（按钮、链接、强调）" value={form.primary_color} onChange={(v) => set("primary_color", v)} />
              <ColorField label="辅助色（深色渐变、悬停）" value={form.accent_color} onChange={(v) => set("accent_color", v)} />
              <ColorField label="按钮颜色" value={form.button_color} onChange={(v) => set("button_color", v)} />
            </div>

            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: 12, color: "#5c726d", fontWeight: 700, display: "block", marginBottom: 8 }}>
                实时预览
              </label>
              <div className="color-preview">
                <span className="swatch" style={{ background: color(form.primary_color) }} />
                <span className="swatch" style={{ background: color(form.accent_color) }} />
                <span className="swatch" style={{ background: color(form.button_color) }} />
                <span style={{ flex: 1 }}>
                  示例按钮：
                  <span
                    className="btn primary"
                    style={{ background: `linear-gradient(100deg, ${color(form.button_color)}, ${color(form.accent_color)})` }}
                  >
                    领取资源
                  </span>
                </span>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn primary" onClick={save} disabled={busy}>
                {busy ? "保存中..." : "保存主题颜色"}
              </button>
              <button className="btn ghost" onClick={() => restoreDefaults("theme")}>
                恢复默认主题
              </button>
              {dirty && <span className="badge orange">有未保存修改</span>}
            </div>
            <p className="subtle" style={{ marginTop: 10 }}>
              颜色配置保存在统一主题变量中，全站共享同一套颜色；修改后所有页面自动生效。
            </p>
          </>
        )}

        {tab === "layout" && (
          <div className="form-grid">
            <div className="field full">
              <label>首页主标题（支持换行）</label>
              <textarea value={form.hero_title} onChange={(e) => set("hero_title", e.target.value)} style={{ minHeight: 60 }} />
            </div>
            <div className="field full">
              <label>首页副标题</label>
              <textarea value={form.hero_subtitle} onChange={(e) => set("hero_subtitle", e.target.value)} style={{ minHeight: 55 }} />
            </div>
            <div className="field full">
              <label>搜索框提示文字</label>
              <input type="text" value={form.search_placeholder} onChange={(e) => set("search_placeholder", e.target.value)} />
            </div>
            <div className="field">
              <label>分类区标题</label>
              <input type="text" value={form.category_title} onChange={(e) => set("category_title", e.target.value)} />
            </div>
            <div className="field">
              <label>领取文案域名</label>
              <input
                type="text"
                value={form.claim_domain}
                onChange={(e) => set("claim_domain", e.target.value)}
                placeholder="如 xxx.yyy（按第一个点拆成前后两段用于可复制文案）"
              />
            </div>
            <div className="field">
              <label>首页全部资源展示数量（上限 50）</label>
              <input type="number" min={1} max={50} value={form.home_resource_count} onChange={(e) => set("home_resource_count", Number(e.target.value))} />
            </div>
            <div className="field full">
              <label>区块显示控制</label>
              <div style={{ display: "grid", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <Switch checked={Boolean(form.show_categories)} onChange={(v) => set("show_categories", v)} />
                  <span style={{ fontSize: 12 }}>显示分类区</span>
                </span>
              </div>
            </div>
            <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
              <button className="btn primary" onClick={save} disabled={busy}>
                {busy ? "保存中..." : "保存首页布局"}
              </button>
              <button className="btn ghost" onClick={() => restoreDefaults("layout")}>
                恢复默认
              </button>
              {dirty && <span className="badge orange">有未保存修改</span>}
            </div>
          </div>
        )}
      </div>

      <StatusInline status={status.type} text={status.text} />
    </>
  );
}

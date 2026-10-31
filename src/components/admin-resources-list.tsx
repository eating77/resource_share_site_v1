"use client";

import Link from "next/link";
import { useState } from "react";
import type { Resource } from "@/lib/types";
import { apiFetch, ConfirmDialog, Switch } from "@/components/admin-ui";

export function AdminResourcesList({ initial, categories }: { initial: Resource[]; categories: { id: string; name: string }[] }) {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");
  const [confirm, setConfirm] = useState<Resource | null>(null);
  const [notice, setNotice] = useState("");

  const filtered = items.filter((r) => {
    const matchQ = !query.trim() || `${r.title} ${r.description} ${r.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchC = !cat || r.category_id === cat;
    return matchQ && matchC;
  });

  const toggle = async (r: Resource, key: "is_published" | "is_home" | "is_hot") => {
    try {
      await apiFetch(`/api/resources/${r.id}`, { method: "PUT", body: JSON.stringify({ [key]: !r[key] }) });
      setItems((list) => list.map((x) => (x.id === r.id ? { ...x, [key]: !x[key] } : x)));
      setNotice(`已更新「${r.title}」`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "更新失败");
    }
  };

  const move = async (r: Resource, dir: "up" | "down") => {
    try {
      await apiFetch(`/api/resources/${r.id}?move=${dir}`, { method: "POST" });
      // 排序改变，直接刷新页面获取最新顺序
      window.location.reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "调整排序失败");
    }
  };

  const remove = async () => {
    if (!confirm) return;
    try {
      await apiFetch(`/api/resources/${confirm.id}`, { method: "DELETE" });
      setItems((list) => list.filter((x) => x.id !== confirm.id));
      setConfirm(null);
      setNotice(`已删除「${confirm.title}」`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "删除失败");
      setConfirm(null);
    }
  };

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>资源管理</h2>
          <p style={{ color: "#8b9c99", fontSize: 12, margin: "4px 0 0" }}>新增、编辑、删除资源，调整排序与展示状态，保存后前台立即更新。</p>
        </div>
        <Link href="/admin/resources/new" className="btn primary">
          ＋ 新增资源
        </Link>
      </div>

      <div className="panel">
        <div className="filter-bar" style={{ marginBottom: 14 }}>
          <div className="filter-search" style={{ minWidth: 220 }}>
            <span>⌕</span>
            <input aria-label="搜索资源" placeholder="搜索资源名称/标签..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ height: 36, border: "1px solid #e3efed", borderRadius: 10, background: "#fff", fontSize: 12, padding: "0 10px" }}>
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {notice && <div className="alert success">{notice}</div>}

        {filtered.length === 0 ? (
          <div className="empty-state">没有匹配的资源。点击右上角「新增资源」创建第一条资源。</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>排序</th>
                  <th>资源</th>
                  <th>分类</th>
                  <th>标签</th>
                  <th style={{ width: 200 }}>展示状态</th>
                  <th style={{ width: 190 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <span className="row-actions">
                        <button className="btn small ghost" disabled={i === 0} onClick={() => move(r, "up")} aria-label="上移">
                          ↑
                        </button>
                        <button className="btn small ghost" disabled={i === filtered.length - 1} onClick={() => move(r, "down")} aria-label="下移">
                          ↓
                        </button>
                      </span>
                    </td>
                    <td>
                      <span className="row-title">
                        {r.cover_emoji || "📦"} {r.title}
                        <small>{r.size || "—"}</small>
                      </span>
                    </td>
                    <td>{r.category_name || "未分类"}</td>
                    <td>
                      <span style={{ color: "#6c827e" }}>
                        {r.tags.length ? r.tags.map((t) => `#${t}`).join(" ") : "—"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Switch checked={Boolean(r.is_published)} onChange={() => toggle(r, "is_published")} />
                          <small>发布</small>
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Switch checked={Boolean(r.is_home)} onChange={() => toggle(r, "is_home")} />
                          <small>首页</small>
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Switch checked={Boolean(r.is_hot)} onChange={() => toggle(r, "is_hot")} />
                          <small>热门</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="row-actions">
                        <Link className="btn small" href={`/admin/resources/${r.id}`}>
                          编辑
                        </Link>
                        <button className="btn small danger" onClick={() => setConfirm(r)}>
                          删除
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="删除资源"
        message={`确定要删除「${confirm?.title}」吗？该资源的任务配置与提交记录将一并删除，此操作不可恢复。`}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />
    </>
  );
}

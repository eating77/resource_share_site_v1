"use client";

import { useState } from "react";
import type { Category } from "@/lib/types";
import { apiFetch, ConfirmDialog } from "@/components/admin-ui";

export function CategoryManager({ initial, resourceCounts }: { initial: Category[]; resourceCounts: Record<string, number> }) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✦");
  const [editing, setEditing] = useState<Category | null>(null);
  const [confirm, setConfirm] = useState<Category | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const add = async () => {
    if (!name.trim()) {
      setNotice({ type: "error", text: "请输入分类名称" });
      return;
    }
    try {
      const d = await apiFetch("/api/categories", { method: "POST", body: JSON.stringify({ name, icon }) });
      setItems((l) => [...l, d.data]);
      setName("");
      setIcon("✦");
      setNotice({ type: "success", text: "分类已新增，前台立即生效" });
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "新增失败" });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!name.trim()) {
      setNotice({ type: "error", text: "分类名称不能为空" });
      return;
    }
    try {
      await apiFetch(`/api/categories?id=${editing.id}`, { method: "PUT", body: JSON.stringify({ name, icon }) });
      setItems((l) => l.map((c) => (c.id === editing.id ? { ...c, name: name.trim(), icon } : c)));
      setEditing(null);
      setName("");
      setIcon("✦");
      setNotice({ type: "success", text: "分类已更新" });
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "修改失败" });
    }
  };

  const remove = async () => {
    if (!confirm) return;
    try {
      await apiFetch(`/api/categories?id=${confirm.id}`, { method: "DELETE" });
      setItems((l) => l.filter((c) => c.id !== confirm.id));
      setConfirm(null);
      setNotice({ type: "success", text: "分类已删除" });
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "删除失败" });
      setConfirm(null);
    }
  };

  const reorder = async (id: string, dir: -1 | 1) => {
    // 分类排序：交换 sort_order
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[j];
    try {
      await apiFetch(`/api/categories?id=${a.id}`, { method: "PUT", body: JSON.stringify({ name: a.name, icon: a.icon, sort_order: b.sort_order }) });
      await apiFetch(`/api/categories?id=${b.id}`, { method: "PUT", body: JSON.stringify({ name: b.name, icon: b.icon, sort_order: a.sort_order }) });
      setItems((l) =>
        l.map((c) => {
          if (c.id === a.id) return { ...c, sort_order: b.sort_order };
          if (c.id === b.id) return { ...c, sort_order: a.sort_order };
          return c;
        })
      );
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "调整排序失败" });
    }
  };

  return (
    <>
      <div className="panel">
        <h2>{editing ? `编辑分类：${editing.name}` : "新增分类"}</h2>
        <p>分类用于前台筛选与首页入口。删除仍有资源关联的分类时，系统会先提示处理关联资源。</p>
        <div className="form-grid">
          <div className="field">
            <label>分类名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：游戏资源" />
          </div>
          <div className="field">
            <label>图标（Emoji 或符号）</label>
            <input type="text" value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} placeholder="🎮 / ✦" />
          </div>
        </div>
        <div className="form-actions">
          {editing ? (
            <>
              <button className="btn primary" onClick={saveEdit}>
                保存修改
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  setEditing(null);
                  setName("");
                  setIcon("✦");
                }}
              >
                取消
              </button>
            </>
          ) : (
            <button className="btn primary" onClick={add}>
              ＋ 新增分类
            </button>
          )}
        </div>
      </div>

      {notice && <div className={`alert ${notice.type === "success" ? "success" : "error"}`}>{notice.text}</div>}

      <div className="panel">
        <h2>分类列表（{items.length}）</h2>
        {items.length === 0 ? (
          <div className="empty-state">暂无分类</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>排序</th>
                  <th>分类</th>
                  <th>关联资源</th>
                  <th style={{ width: 170 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {[...items]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((c, i) => (
                    <tr key={c.id}>
                      <td>
                        <span className="row-actions">
                          <button className="btn small ghost" disabled={i === 0} onClick={() => reorder(c.id, -1)}>
                            ↑
                          </button>
                          <button className="btn small ghost" disabled={i === items.length - 1} onClick={() => reorder(c.id, 1)}>
                            ↓
                          </button>
                        </span>
                      </td>
                      <td>
                        <span className="row-title">
                          {c.icon} {c.name}
                        </span>
                      </td>
                      <td>{resourceCounts[c.id] || 0} 个</td>
                      <td>
                        <span className="row-actions">
                          <button
                            className="btn small"
                            onClick={() => {
                              setEditing(c);
                              setName(c.name);
                              setIcon(c.icon);
                            }}
                          >
                            编辑
                          </button>
                          <button className="btn small danger" onClick={() => setConfirm(c)}>
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
        title="删除分类"
        message={`确定要删除分类「${confirm?.name}」吗？`}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />
    </>
  );
}

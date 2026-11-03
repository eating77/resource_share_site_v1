"use client";

import { useState } from "react";
import type { Submission } from "@/lib/types";
import { apiFetch, ConfirmDialog } from "@/components/admin-ui";
import { formatTime } from "@/lib/format";

export function SubmissionsList({ initial }: { initial: Submission[] }) {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<Submission | null>(null);
  const [notice, setNotice] = useState("");

  const filtered = items.filter((s) => {
    if (!query.trim()) return true;
    return `${s.resource_title} ${s.user_key} ${s.status}`.toLowerCase().includes(query.trim().toLowerCase());
  });

  const remove = async () => {
    if (!confirm) return;
    try {
      await apiFetch(`/api/submissions?id=${confirm.id}`, { method: "DELETE" });
      setItems((l) => l.filter((x) => x.id !== confirm.id));
      setConfirm(null);
      setNotice("记录已删除");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "删除失败");
      setConfirm(null);
    }
  };

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>提交记录</h2>
          <p style={{ color: "#8b9c99", fontSize: 12, margin: "4px 0 0" }}>
            只记录「资源 + 截图数量 + 提交时间」，访客上传的截图不保存、不做留存，随时可删记录。达到要求数量即自动通过。
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="filter-bar" style={{ marginBottom: 14 }}>
          <div className="filter-search" style={{ minWidth: 220 }}>
            <span>⌕</span>
            <input aria-label="搜索提交记录" placeholder="搜索资源名/提交标识..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {notice && <div className="alert success">{notice}</div>}

        {filtered.length === 0 ? (
          <div className="empty-state">暂无提交记录。</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>资源名称</th>
                  <th>截图数量</th>
                  <th>处理状态</th>
                  <th>提交时间</th>
                  <th style={{ width: 90 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="row-title">
                        {s.resource_title}
                        <small>{s.user_key.slice(0, 10)}</small>
                      </span>
                    </td>
                    <td>{s.screenshot_count} 张</td>
                    <td>
                      <span className="badge green">自动通过</span>
                    </td>
                    <td>{formatTime(s.created_at)}</td>
                    <td>
                      <button className="btn small danger" onClick={() => setConfirm(s)}>
                        删除
                      </button>
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
        title="删除提交记录"
        message={`确定要删除「${confirm?.resource_title}」的这条提交记录吗？删除后该用户可能失去领取资格。`}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />
    </>
  );
}

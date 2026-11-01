"use client";

import { useState } from "react";
import type { Submission } from "@/lib/types";
import { apiFetch, ConfirmDialog, ImageModal } from "@/components/admin-ui";
import { formatTime } from "@/lib/format";

export function SubmissionsList({ initial }: { initial: Submission[] }) {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
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
          <h2 style={{ margin: 0, fontSize: 18 }}>截图提交记录</h2>
          <p style={{ color: "#8b9c99", fontSize: 12, margin: "4px 0 0" }}>
            当前版本采用自动通过：达到要求截图数量即放行，不代表截图内容真实。保留记录供查看异常情况。
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
                  <th>截图</th>
                  <th>图片数</th>
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
                    <td>
                      <div className="submit-imgs">
                        {s.images.slice(0, 6).map((img, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={img} alt={`截图${i + 1}`} onClick={() => setPreview(img)} />
                        ))}
                        {s.images.length > 6 && <span style={{ alignSelf: "center", fontSize: 11, color: "#8b9c99" }}>+{s.images.length - 6}</span>}
                      </div>
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

      <ImageModal src={preview} onClose={() => setPreview(null)} />
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

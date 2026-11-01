"use client";

import { useState } from "react";
import type { Announcement, SiteSettings } from "@/lib/types";
import { apiFetch, ConfirmDialog, StatusInline, Switch } from "@/components/admin-ui";
import { formatTime } from "@/lib/format";

type Tab = "announcements" | "copy";

const COPY_FIELDS: { key: keyof SiteSettings; label: string; hint: string }[] = [
  { key: "copy_search_empty", label: "搜索无结果提示", hint: "搜索或筛选后没有资源时显示的文案" },
  { key: "copy_get_button", label: "资源获取按钮", hint: "资源卡片上的按钮文字" },
  { key: "copy_task_start", label: "任务开始按钮", hint: "详情页“开始任务”按钮文字" },
  { key: "copy_upload_hint", label: "截图上传提示", hint: "任务页上传区的提示文案" },
  { key: "copy_upload_count", label: "截图数量提示", hint: "支持 {current} 与 {total} 占位符" },
  { key: "copy_upload_success", label: "上传成功提示", hint: "提交成功后的提示文案" },
  { key: "copy_auto_pass", label: "自动通过提示", hint: "上传区底部与详情页任务横幅的提示" },
  { key: "copy_claim_success", label: "领取成功提示", hint: "领取成功页的说明文案" },
  { key: "copy_copy_success", label: "复制成功提示", hint: "点击复制按钮后的反馈文案" },
  { key: "copy_error", label: "页面错误提示", hint: "通用错误提示" },
];

export function AnnouncementsPage({ initial, settings }: { initial: Announcement[]; settings: SiteSettings }) {
  const [tab, setTab] = useState<Tab>("announcements");
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ title: "", content: "", position: "notice" as "notice" | "home_top", enabled: true });
  const [confirm, setConfirm] = useState<Announcement | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [copy, setCopy] = useState<SiteSettings>(settings);
  const [copyStatus, setCopyStatus] = useState("");

  const startEdit = (a: Announcement) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, position: a.position as "notice" | "home_top", enabled: a.enabled });
  };

  const save = async () => {
    if (!form.content.trim()) {
      setNotice({ type: "error", text: "公告内容不能为空" });
      return;
    }
    try {
      if (editing) {
        await apiFetch(`/api/announcements?id=${editing.id}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        const d = await apiFetch("/api/announcements", { method: "POST", body: JSON.stringify(form) });
        setItems((l) => [...l, d.data]);
      }
      setNotice({ type: "success", text: "公告已保存，前台立即更新" });
      setEditing(null);
      setForm({ title: "", content: "", position: "notice", enabled: true });
      if (editing) {
        // 刷新列表数据
        const d = await apiFetch("/api/announcements", { method: "GET" });
        setItems(d.data);
      }
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "保存失败" });
    }
  };

  const toggle = async (a: Announcement) => {
    try {
      await apiFetch(`/api/announcements?id=${a.id}`, { method: "PUT", body: JSON.stringify({ ...a, enabled: !a.enabled }) });
      setItems((l) => l.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)));
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "操作失败" });
    }
  };

  const remove = async () => {
    if (!confirm) return;
    try {
      await apiFetch(`/api/announcements?id=${confirm.id}`, { method: "DELETE" });
      setItems((l) => l.filter((x) => x.id !== confirm.id));
      setConfirm(null);
      setNotice({ type: "success", text: "公告已删除" });
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "删除失败" });
      setConfirm(null);
    }
  };

  const saveCopy = async () => {
    try {
      await apiFetch("/api/site-settings", { method: "PUT", body: JSON.stringify(copy) });
      setCopyStatus("文案已保存，前台立即生效");
    } catch (e) {
      setCopyStatus(e instanceof Error ? e.message : "保存失败");
    }
  };

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>公告与文案</h2>
          <p style={{ color: "#8b9c99", fontSize: 12, margin: "4px 0 0" }}>管理公告与前台通用文案，无需修改代码。</p>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === "announcements" ? "on" : ""} onClick={() => setTab("announcements")}>
          公告管理
        </button>
        <button className={tab === "copy" ? "on" : ""} onClick={() => setTab("copy")}>
          文案编辑
        </button>
      </div>

      {tab === "announcements" && (
        <>
          <div className="panel">
            <h2>{editing ? "编辑公告" : "新增公告"}</h2>
            <p>公告内容支持中文、换行与常见标点。显示位置：首页顶部公告 / 普通通知。</p>
            <div className="form-grid">
              <div className="field">
                <label>公告标题</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：资源持续更新中" />
              </div>
              <div className="field">
                <label>显示位置</label>
                <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value as "notice" | "home_top" })}>
                  <option value="notice">普通通知</option>
                  <option value="home_top">首页顶部公告</option>
                </select>
              </div>
              <div className="field full">
                <label>公告内容</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} style={{ minHeight: 90 }} placeholder="支持换行与标点" />
              </div>
              <div className="field">
                <label>是否开启</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8 }}>
                  <Switch checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
                  <span className="badge green">{form.enabled ? "开启" : "关闭"}</span>
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn primary" onClick={save}>
                {editing ? "保存修改" : "发布公告"}
              </button>
              {editing && (
                <button
                  className="btn ghost"
                  onClick={() => {
                    setEditing(null);
                    setForm({ title: "", content: "", position: "notice", enabled: true });
                  }}
                >
                  取消编辑
                </button>
              )}
            </div>
          </div>

          {notice && <div className={`alert ${notice.type}`}>{notice.text}</div>}

          <div className="panel">
            <h2>公告列表（{items.length}）</h2>
            {items.length === 0 ? (
              <div className="empty-state">暂无公告</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>标题</th>
                      <th>位置</th>
                      <th>状态</th>
                      <th>更新时间</th>
                      <th style={{ width: 160 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) => (
                      <tr key={a.id}>
                        <td className="row-title">
                          {a.title || "（无标题）"}
                          <small>{a.content.slice(0, 30)}</small>
                        </td>
                        <td>{a.position === "home_top" ? "首页顶部" : "普通通知"}</td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <Switch checked={a.enabled} onChange={() => toggle(a)} />
                            <span className={`badge ${a.enabled ? "green" : "gray"}`}>{a.enabled ? "开启" : "关闭"}</span>
                          </span>
                        </td>
                        <td>{formatTime(a.created_at)}</td>
                        <td>
                          <span className="row-actions">
                            <button className="btn small" onClick={() => startEdit(a)}>
                              编辑
                            </button>
                            <button className="btn small danger" onClick={() => setConfirm(a)}>
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
        </>
      )}

      {tab === "copy" && (
        <div className="panel">
          <h2>前台文案编辑</h2>
          <p>以下文案集中管理，前台自动读取。带 {`{current}`} / {`{total}`} 的字段支持数量占位。</p>
          <div className="form-grid">
            {COPY_FIELDS.map((f) => (
              <div className="field full" key={f.key}>
                <label>
                  {f.label} <span className="hint">{f.hint}</span>
                </label>
                <input type="text" value={String(copy[f.key] || "")} onChange={(e) => setCopy({ ...copy, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn primary" onClick={saveCopy}>
              保存全部文案
            </button>
            <StatusInline status={copyStatus ? "success" : ""} text={copyStatus} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title="删除公告"
        message={`确定要删除公告「${confirm?.title || "无标题"}」吗？`}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />
    </>
  );
}

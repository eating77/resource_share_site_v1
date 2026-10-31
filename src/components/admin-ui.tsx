"use client";

import { useState } from "react";

/* 统一的 API 请求封装：非 2xx 抛错 */
export async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const d = await res.json().catch(() => ({ ok: false, error: "服务器返回异常" }));
  if (!res.ok || !d.ok) {
    throw new Error(d.error || `请求失败（${res.status}）`);
  }
  return d;
}

export function StatusInline({ status, text }: { status: "success" | "error" | "info" | ""; text: string }) {
  if (!text) return null;
  return <p className={`status-inline ${status ? "status-message " + status : "status-message"}`}>{text}</p>;
}

/* 二次确认弹窗 */
export function ConfirmDialog({
  open,
  title,
  message,
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="confirm-mask" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="row-actions">
          <button className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button className={`btn ${danger ? "danger" : "primary"}`} onClick={onConfirm}>
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

/* 图片放大查看 */
export function ImageModal({ src, onClose }: { src: string | null; onClose: () => void }) {
  if (!src) return null;
  return (
    <div className="img-modal" onClick={onClose}>
      <button className="close" onClick={onClose} aria-label="关闭">
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="截图预览" />
    </div>
  );
}

/* 开关 */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="switch" title={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  );
}

/* 标签编辑器 */
export function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t) && value.length < 10) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="tags-input">
      {value.map((t) => (
        <span className="tag-item" key={t}>
          {t}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            aria-label={`移除标签 ${t}`}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder="输入后回车添加"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

/* 颜色选择：取色器 + 十六进制输入框 */
export function ColorField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#109b83";
  return (
    <div className="field">
      <label>{label}</label>
      <div className="color-row">
        <div className="color-input">
          <input type="color" value={normalized} onChange={(e) => onChange(e.target.value)} aria-label={`${label}颜色选择器`} />
        </div>
        <input
          className="hex-input"
          type="text"
          value={value}
          maxLength={7}
          placeholder="#109b83"
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label}十六进制输入`}
        />
      </div>
    </div>
  );
}

/* 区块排序器 */
export function OrderEditor({ items, labels, onChange }: { items: string[]; labels: Record<string, string>; onChange: (v: string[]) => void }) {
  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="order-editor">
      {items.map((key, i) => (
        <div className="order-item" key={key}>
          <span>{labels[key] || key}</span>
          <span className="row-actions">
            <button type="button" className="btn small ghost" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="btn small ghost" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

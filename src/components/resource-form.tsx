"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REQUIRED_SCREENSHOTS, type Category, type Resource, type Task } from "@/lib/types";
import { apiFetch, StatusInline, Switch, TagInput } from "@/components/admin-ui";

export function ResourceForm({
  resource,
  task,
  categories,
  isNew,
}: {
  resource: Resource | null;
  task: Task | null;
  categories: Category[];
  isNew: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Partial<Resource>>(
    resource || {
      title: "",
      category_id: categories[0]?.id || null,
      description: "",
      cover_emoji: "📦",
      cover_url: "",
      tags: [],
      size: "",
      rating: 5,
      is_published: true,
      is_home: true,
      is_hot: false,
      drive_url: "",
      extract_code: "",
      detail_content: "",
    }
  );
  const [taskForm, setTaskForm] = useState<Task>(
    task || {
      id: "",
      resource_id: resource?.id || "",
      enabled: true,
      title: "完成任务",
      description: "",
      steps: [],
      required_screenshots: REQUIRED_SCREENSHOTS,
      success_message: "截图已提交，系统自动通过。请使用下方链接获取资源。",
      button_text: "🚀 提交截图获取地址",
    }
  );
  const [status, setStatus] = useState<{ type: "success" | "error" | "info" | ""; text: string }>({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

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

  const set = <K extends keyof Resource>(key: K, value: Resource[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };
  const setT = <K extends keyof Task>(key: K, value: Task[K]) => {
    setTaskForm((t) => ({ ...t, [key]: value }));
    setDirty(true);
  };

  // 上传资源图标图片（复用 /api/upload，结果写入 cover_url）
  const uploadIcon = async (file: File) => {
    setIconUploading(true);
    setStatus({ type: "info", text: "正在上传图标..." });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "上传失败");
      set("cover_url", d.data.url);
      setStatus({ type: "success", text: "图标上传成功" });
    } catch (e) {
      setStatus({ type: "error", text: e instanceof Error ? e.message : "图标上传失败" });
    } finally {
      setIconUploading(false);
      if (iconInputRef.current) iconInputRef.current.value = "";
    }
  };

  const onIconPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadIcon(f);
  };

  const save = async () => {
    if (!form.title?.trim()) {
      setStatus({ type: "error", text: "资源名称不能为空" });
      return;
    }
    setBusy(true);
    setStatus({ type: "info", text: "保存中..." });
    try {
      let id = resource?.id || "";
      if (isNew) {
        const d = await apiFetch("/api/resources", { method: "POST", body: JSON.stringify(form) });
        id = d.data.id;
      } else {
        await apiFetch(`/api/resources?id=${id}`, { method: "PUT", body: JSON.stringify(form) });
      }
      await apiFetch(`/api/resources/task?id=${id}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: taskForm.enabled,
          button_text: taskForm.button_text,
        }),
      });
      setStatus({ type: "success", text: "保存成功！前台已更新。" });
      setDirty(false);
      if (isNew) router.replace(`/admin/resources/edit?id=${id}`);
    } catch (e) {
      setStatus({ type: "error", text: e instanceof Error ? e.message : "保存失败" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>{isNew ? "新增资源" : "编辑资源"}</h2>
          {!isNew && <LinkBack id={resource!.id} />}
        </div>
        <div className="form-grid">
          <div className="field full">
            <label>
              资源名称 <span className="hint">必填</span>
            </label>
            <input type="text" value={form.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="例如：轻松熊刺绣教程" />
          </div>
          <div className="field">
            <label>所属分类</label>
            <select value={form.category_id || ""} onChange={(e) => set("category_id", e.target.value || null)}>
              <option value="">未分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>
              封面 Emoji <span className="hint">未上传封面图时展示</span>
            </label>
            <input type="text" value={form.cover_emoji || ""} maxLength={8} onChange={(e) => set("cover_emoji", e.target.value)} placeholder="📦" />
          </div>
          <div className="field full">
            <label>
              资源图标图片 <span className="hint">上传截图/图片作为资源图标，替代 Emoji 展示，更醒目</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/jpg"
                onChange={onIconPick}
                style={{ display: "none" }}
                id="icon-upload"
              />
              <button
                type="button"
                className="btn small"
                onClick={() => iconInputRef.current?.click()}
                disabled={iconUploading}
              >
                {iconUploading ? "上传中..." : form.cover_url ? "更换图标" : "上传图标"}
              </button>
              {form.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.cover_url} alt="图标预览" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, border: "1px solid #e3efed" }} />
              ) : (
                <span style={{ fontSize: 13, color: "#8b9c99" }}>未上传，将使用 Emoji</span>
              )}
            </div>
            <input
              type="url"
              value={form.cover_url || ""}
              onChange={(e) => set("cover_url", e.target.value)}
              placeholder="https://... 或 /uploads/xxx.png（也可点上方按钮上传）"
              style={{ marginTop: 8 }}
            />
          </div>
          <div className="field full">
            <label>资源简介</label>
            <textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="一句话介绍资源内容" />
          </div>
          <div className="field">
            <label>资源大小</label>
            <input type="text" value={form.size || ""} onChange={(e) => set("size", e.target.value)} placeholder="如 100MB / 5GB" />
          </div>
          <div className="field">
            <label>评分（0-10）</label>
            <input type="number" min={0} max={10} step={0.1} value={form.rating ?? 5} onChange={(e) => set("rating", Number(e.target.value))} />
          </div>
          <div className="field full">
            <label>标签（最多 10 个）</label>
            <TagInput value={form.tags || []} onChange={(v) => set("tags", v)} />
          </div>
          <div className="field full">
            <label>资源详情页内容（支持换行）</label>
            <textarea value={form.detail_content || ""} onChange={(e) => set("detail_content", e.target.value)} placeholder="详细介绍资源内容、包含清单、注意事项等" style={{ minHeight: 120 }} />
          </div>
          <div className="field full">
            <label>
              网盘领取地址 <span className="hint">仅在用户满足领取条件后展示，请勿随意填写无效链接</span>
            </label>
            <input type="url" value={form.drive_url || ""} onChange={(e) => set("drive_url", e.target.value)} placeholder="https://pan.baidu.com/s/..." />
          </div>
          <div className="field">
            <label>提取码</label>
            <input type="text" value={form.extract_code || ""} onChange={(e) => set("extract_code", e.target.value)} placeholder="如 abcd" />
          </div>
          <div className="field">
            <label>排序值（数字越小越靠前）</label>
            <input type="number" value={form.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))} />
          </div>
          <div className="field">
            <label>
              是否发布 <span className="hint">未发布前台不可见</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8 }}>
              <Switch checked={Boolean(form.is_published)} onChange={(v) => set("is_published", v)} />
              <span className="badge green">已发布</span>
            </div>
          </div>
          <div className="field">
            <label>展示在首页（最新发布区）</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8 }}>
              <Switch checked={Boolean(form.is_home)} onChange={(v) => set("is_home", v)} />
              <span className="badge orange">首页展示</span>
            </div>
          </div>
          <div className="field">
            <label>标记为热门</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8 }}>
              <Switch checked={Boolean(form.is_hot)} onChange={(v) => set("is_hot", v)} />
              <span className="badge red">🔥 热门</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>领取任务配置</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#627a74" }}>启用任务</span>
            <Switch checked={taskForm.enabled} onChange={(v) => setT("enabled", v)} />
          </div>
        </div>
        <p className="subtle" style={{ fontSize: 12, color: "#8b9c99", margin: "0 0 14px", lineHeight: 1.8 }}>
          领取三步流程全站统一：① 去三个相关作品评论区发布文案 → ② 保存 3 张评论截图 → ③ 提交截图自动放行。
          截图数量固定为 {REQUIRED_SCREENSHOTS} 张，无需单独配置；可复制文案与站点域名在「网站外观 → 首页布局」中设置。
        </p>
        <div className="form-grid">
          <div className="field full">
            <label>领取按钮文字</label>
            <input type="text" value={taskForm.button_text} onChange={(e) => setT("button_text", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" onClick={save} disabled={busy}>
          {busy ? "保存中..." : "保存资源与任务"}
        </button>
        {!isNew && (
          <LinkPreview id={resource!.id} />
        )}
        {dirty && <span className="badge orange">有未保存的修改</span>}
        <StatusInline status={status.type} text={status.text} />
      </div>
    </>
  );
}

function LinkBack({ id }: { id: string }) {
  return (
    <a href={`/resource?id=${id}`} target="_blank" rel="noreferrer" className="btn small ghost">
      查看前台页面 ↗
    </a>
  );
}

function LinkPreview({ id }: { id: string }) {
  return (
    <a href={`/resource?id=${id}`} target="_blank" rel="noreferrer" className="btn ghost">
      预览前台 ↗
    </a>
  );
}

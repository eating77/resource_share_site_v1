"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { REQUIRED_SCREENSHOTS, type Resource, type SiteSettings, type Task } from "@/lib/types";
import { CopyButton } from "@/components/site";

type UploadedFile = { file: File; url: string; preview: string };

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_SIZE = 5 * 1024 * 1024;

/* ---- 可复制文案：每次复制都换一批随机词，避免平台按重复文案拦截 ---- */
const COPY_WORDS = [
  "扇光", "晚风", "云朵", "海盐", "小满", "星河", "绘梨", "柠檬", "山茶", "松果",
  "拾光", "白桃", "青柚", "雾岛", "小鹿", "北巷", "南风", "半夏", "拾柒", "甜筒",
  "橘子", "月光", "初夏", "晴天", "汽水", "青柠", "木棉", "远山", "砂糖", "豆乳",
];
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 评论文案格式固定为：xxx.随机词yyy随机词去掉便是
 * 其中 xxx / yyy 来自后台设置的域名（按第一个「.」拆成前后两段），
 * 同一个随机词出现两次，结尾「去掉便是」固定不变。
 */
function makeComment(domain: string, previous?: string): string {
  const raw = (domain || "xxx.yyy")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
  const dot = raw.indexOf(".");
  const prefix = dot > 0 ? raw.slice(0, dot) : raw;
  const suffix = dot > 0 ? raw.slice(dot + 1) : "";
  let text = "";
  for (let i = 0; i < 8; i++) {
    const word = pickOne(COPY_WORDS);
    text = `${prefix}.${word}${suffix}${word}去掉便是`;
    if (text !== previous) break;
  }
  return text;
}

export default function TaskPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [resource, setResource] = useState<Resource | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [message, setMessage] = useState<{ type: "info" | "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [comment, setComment] = useState("");
  const [success, setSuccess] = useState<{ title: string; driveUrl: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rotateComment = () => setComment((prev) => makeComment(settings?.claim_domain || "xxx.yyy", prev));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rRes, tRes, sRes, cRes] = await Promise.all([
          fetch(`/api/resources/${params.id}`, { cache: "no-store" }),
          fetch(`/api/resources/${params.id}/task`, { cache: "no-store" }),
          fetch(`/api/site-settings`, { cache: "no-store" }),
          fetch(`/api/resources/${params.id}/claim-status`, { cache: "no-store" }),
        ]);
        const r = (await rRes.json()) as { ok: boolean; data?: Resource; error?: string };
        const t = (await tRes.json()) as { ok: boolean; data?: Task | null };
        const s = (await sRes.json()) as { ok: boolean; data?: SiteSettings };
        const c = (await cRes.json()) as { ok: boolean; approved?: boolean };
        if (!alive) return;
        if (!r.ok || !r.data || !r.data.is_published) {
          setMessage({ type: "error", text: "资源不存在或已下架" });
        } else {
          setResource(r.data);
        }
        setTask(t.ok ? (t.data ?? null) : null);
        setSettings(s.ok ? s.data! : null);
        setKeyword(r.data?.title || "");
        setComment(makeComment(s.data?.claim_domain || "xxx.yyy"));
        if (c.ok && c.approved) {
          router.replace(`/resource/${params.id}/success`);
          return;
        }
      } catch {
        if (alive) setMessage({ type: "error", text: "页面加载失败，请刷新重试" });
      } finally {
        if (alive) {
          setLoading(false);
          setChecked(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.id, router]);

  const required = task && !task.enabled ? 0 : REQUIRED_SCREENSHOTS;

  const onFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const chosen = Array.from(e.target.files || []);
      e.target.value = "";
      if (chosen.length === 0) return;
      const bad = chosen.filter((f) => !f.type.startsWith("image/") || !ACCEPT.includes(f.type) || f.size > MAX_SIZE);
      if (bad.length > 0) {
        setMessage({ type: "error", text: `${bad.length} 个文件不符合要求（仅支持 JPG/PNG/WEBP/GIF，且每个不超过 5MB）` });
        return;
      }
      const newFiles: UploadedFile[] = chosen.map((f) => ({
        file: f,
        url: "",
        preview: URL.createObjectURL(f),
      }));
      setFiles((prev) => [...prev, ...newFiles].slice(0, REQUIRED_SCREENSHOTS));
      setMessage(null);
    },
    []
  );

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed && removed.preview.startsWith("blob:")) URL.revokeObjectURL(removed.preview);
      return next;
    });
    setMessage(null);
  };

  const uploadAll = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const f of files) {
      if (f.url) {
        urls.push(f.url);
        continue;
      }
      const fd = new FormData();
      fd.append("file", f.file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "上传失败");
      urls.push(d.data.url);
      setFiles((prev) => prev.map((x) => (x.preview === f.preview ? { ...x, url: d.data.url } : x)));
    }
    return urls;
  };

  const submit = async () => {
    if (!resource) return;
    if (files.length < required) {
      setMessage({ type: "error", text: `请再上传 ${required - files.length} 张截图（已上传 ${files.length}/${required} 张）` });
      return;
    }
    setSubmitting(true);
    setMessage({ type: "info", text: "正在上传并提交..." });
    try {
      const urls = await uploadAll();
      if (urls.length < required) throw new Error("部分图片上传失败，请重试");
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: resource.id, imageUrls: urls.slice(0, required) }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "提交失败");
      // 提交成功：直接取回领取链接，弹出「提交成功」弹窗
      let driveUrl = "";
      try {
        const claimRes = await fetch(`/api/resources/${resource.id}/claim`, { method: "POST", cache: "no-store" });
        const claim = await claimRes.json();
        if (claimRes.ok && claim.ok && claim.data) driveUrl = claim.data.driveUrl || "";
      } catch {
        // 忽略，弹窗中提示联系站长
      }
      setSuccess({ title: resource.title, driveUrl });
      setSubmitting(false);
      setMessage(null);
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "提交失败，请重试" });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="task-page">
        <div className="task-wrap">
          <p className="status-message">正在加载任务信息...</p>
        </div>
      </main>
    );
  }

  if (!resource) {
    return (
      <main className="task-page">
        <div className="task-wrap">
          <div className="empty">{message?.text || "资源不存在"}</div>
          <Link href="/" className="back-link">
            ← 返回首页
          </Link>
        </div>
      </main>
    );
  }

  const s = settings || ({} as SiteSettings);

  if (task && !task.enabled) {
    return (
      <main className="task-page">
        <div className="task-wrap">
          <Link href={`/resource/${resource.id}`} className="back-link">
            ← 返回资源详情
          </Link>
          <div className="empty">该资源暂未启用领取任务。</div>
        </div>
      </main>
    );
  }

  return (
    <main className="task-page">
      <div className="task-wrap">
        <Link href={`/resource/${resource.id}`} className="back-link">
          ← 返回资源详情
        </Link>
        <section className="resource-summary">
          <div className="detail-cover">
            {resource.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resource.cover_url} alt={resource.title} />
            ) : (
              resource.cover_emoji || "📦"
            )}
          </div>
          <div className="summary-copy">
            <span className="tag">{resource.category_name || "未分类"}</span>
            <h1>{resource.title}</h1>
            <p>{resource.description}</p>
          </div>
        </section>

        <section className="claim-intro">
          <h2>
            完成以下简单三步
            <br />
            免费获得当前资源
          </h2>
          <p className="claim-flow">相关作品发布评论 → 截图保存 → 提交截图免费获取</p>
          <p>
            因为资源本身不需要付费也没有广告，宣传一下让更多人拿到，30 秒即可完成。
            分享文案为明文，可直接复制使用。
          </p>
        </section>

        <section className="claim-step-card">
          <div className="claim-step-head">
            <span className="claim-step-badge">第一步</span>
            <h3>打开任意 APP 去三个相关作品评论</h3>
          </div>
          <div className="claim-platforms">
            <span className="claim-platform">
              <i className="platform-icon douyin">♪</i>
              <b>抖音</b>
            </span>
            <span className="claim-platform">
              <i className="platform-icon xhs">红</i>
              <b>小红书</b>
            </span>
            <span className="claim-platform">
              <i className="platform-icon kuaishou">▷</i>
              <b>快手</b>
            </span>
          </div>
          <div className="claim-note">
            前往抖音、小红书、快手任意平台 → 搜索当前资源相关帖子 → 复制文案 →
            发布到相关内容的评论区中 →（需发布三处相关作品）
          </div>
          <div className="claim-copy-grid">
            <div className="claim-copy-box">
              <label>相关帖子关键词</label>
              <div className="claim-copy-value">{keyword}</div>
              <CopyButton
                className="claim-copy-btn"
                text={keyword}
                label="点我复制搜索关键词"
                successText="已复制到剪贴板 ✓"
              />
            </div>
            <div className="claim-copy-box">
              <label>评论区发布文案</label>
              <div className="claim-copy-value">{comment}</div>
              <CopyButton
                className="claim-copy-btn"
                text={comment}
                label="点我复制评论文案"
                successText="已复制，再点换新文案 ✓"
                onCopied={rotateComment}
              />
            </div>
          </div>
        </section>

        <section className="claim-step-card">
          <div className="claim-step-head">
            <span className="claim-step-badge">第二步</span>
            <h3>保存三张相关评论发布成功截图</h3>
          </div>
          <div className="claim-note">
            每次发布成功一个评论截一张图，截图需包含完整的分享文案（截图包含评论即可，无需裁剪）
          </div>
          <div className="claim-example">
            <div className="claim-comment">
              <div className="claim-comment-row">
                <i className="claim-avatar">冰</i>
                <div>
                  <b>冰美式加冰</b>
                  <p>求</p>
                  <small>1 分钟前 · 陕西</small>
                </div>
                <span className="claim-like">♡</span>
              </div>
              <div className="claim-comment-row highlight">
                <i className="claim-avatar">D</i>
                <div>
                  <b>Daisy</b>
                  <p className="claim-comment-text">{comment}</p>
                  <small>1 分钟前 · 四川</small>
                </div>
                <span className="claim-like liked">♥ 2</span>
              </div>
              <div className="claim-comment-row">
                <i className="claim-avatar">早</i>
                <div>
                  <b>早点水饺</b>
                  <p>我会一直发的！</p>
                  <small>41 分钟前 · 山东</small>
                </div>
                <span className="claim-like">♡ 26</span>
              </div>
              <div className="claim-comment-input">分享你此刻的想法</div>
            </div>
            <p className="claim-example-foot">截图示例</p>
          </div>
          <p className="claim-example-tip">① 给刚发布的评论点赞　② 要能清晰看到自己的评论和头像</p>
        </section>

        <section className="claim-step-card">
          <div className="claim-step-head">
            <span className="claim-step-badge">第三步</span>
            <h3>提交三张评论截图免费领取</h3>
          </div>
          <div className="claim-note">
            点击下方按钮选择 {required} 张截图，系统将自动审核（约 2 秒），通过后即可免费领取。
          </div>

          <div className="upload-box claim-upload">
            <div className="upload-icon">⇧</div>
            <b>上传评论截图</b>
            <p>
              {(s.copy_upload_count || "已上传 {current} / {total} 张")
                .replace("{current}", String(files.length))
                .replace("{total}", String(required))}
            </p>
            <label className="upload-button">
              选择 {required} 张截图
              <input ref={inputRef} type="file" accept={ACCEPT} multiple onChange={onFiles} />
            </label>
            <div className="upload-progress">
              <span style={{ width: `${Math.min(100, (files.length / required) * 100)}%` }} />
            </div>

            {files.length > 0 && (
              <div className="preview-grid">
                {files.map((f, i) => (
                  <div className="preview-item" key={`${f.preview}-${i}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.preview} alt={f.file.name} />
                    <button onClick={() => removeFile(i)} aria-label="移除图片">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {message && (
              <p className={`status-message ${message.type === "success" ? "success" : message.type === "error" ? "error" : ""}`}>
                {message.text}
              </p>
            )}

            <button className="submit-button claim-submit-button" onClick={submit} disabled={submitting}>
              {submitting ? "提交中..." : task?.button_text || "🚀 提交截图获取地址"}
            </button>
            <small>请提交正确的评论截图 否则资源会失效❤</small>
          </div>
        </section>

        <p className="claim-footnote">资源每日更新 · 安全连接 · 精品资源</p>

        <div className="task-footer">
          <Link href="/">返回首页</Link>
          <span>© {s.name || "拾集资源库"}</span>
        </div>
      </div>

      {success && (
        <div className="claim-success-mask" role="dialog" aria-modal="true" aria-label="提交成功">
          <div className="claim-success-box">
            <div className="success-icon">✓</div>
            <h2>提交成功</h2>
            <p>
              截图已验证通过，点击下方按钮立即获取「{success.title}」。
            </p>
            {success.driveUrl ? (
              <a className="submit-button claim-get-button" href={success.driveUrl} target="_blank" rel="noreferrer">
                立即获取 →
              </a>
            ) : (
              <p className="status-message error">资源链接暂未配置，请联系站长补充。</p>
            )}
            <Link href="/" className="claim-success-home">
              返回首页
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

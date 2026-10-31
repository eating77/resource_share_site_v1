"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
type ClaimData = { title: string; driveUrl: string };

export const runtime = "edge";

export default function SuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/resources/${id}/claim`, { method: "POST", cache: "no-store" });
        const d = await res.json();
        if (!alive) return;
        if (res.ok && d.ok && d.data) {
          setClaim(d.data);
        } else if (res.status === 403) {
          router.replace(`/resource/${id}/task`);
          return;
        } else {
          setError(d.error || "领取信息获取失败");
        }
      } catch {
        if (alive) setError("网络异常，请稍后重试");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, router]);

  return (
    <main className="task-page">
      <div className="task-wrap">
        <Link href="/" className="back-link">
          ← 返回首页
        </Link>
        {loading && <p className="status-message">正在验证领取条件...</p>}

        {error && (
          <div className="empty">
            <p>{error}</p>
            <Link className="submit-button" href={`/resource/${id}`} style={{ display: "inline-block", marginTop: 16 }}>
              返回资源详情
            </Link>
          </div>
        )}

        {claim && (
          <section className="claim-card">
            <div className="success-icon">✓</div>
            <h2>提交成功</h2>
            <p>「{claim.title}」截图已验证通过，点击下方按钮立即获取资源。</p>
            {claim.driveUrl ? (
              <a className="submit-button claim-get-button" href={claim.driveUrl} target="_blank" rel="noreferrer">
                立即获取 →
              </a>
            ) : (
              <p className="status-message error">资源链接暂未配置，请联系站长补充。</p>
            )}
            <p className="subtle">如链接失效，可联系站方更新资源。</p>
          </section>
        )}

        <div className="task-footer">
          <Link href="/">返回首页</Link>
          <Link href="/">继续浏览资源 →</Link>
        </div>
      </div>
    </main>
  );
}

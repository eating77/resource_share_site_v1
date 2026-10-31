"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch, StatusInline } from "@/components/admin-ui";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "edge";

export default function AdminLogin() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error" | "info" | ""; text: string }>({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const demo = !isSupabaseConfigured();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus({ type: "", text: "" });
    try {
      const d = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (d.ok) {
        const from = sp.get("from");
        router.push(from && from.startsWith("/admin") ? from : "/admin");
      }
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "登录失败" });
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <Link href="/" className="brand">
          <span className="brand-mark">☁</span>
          <span>拾集资源库后台</span>
        </Link>
        <h1>管理员登录</h1>
        <p>{demo ? "演示模式账号：admin@demo.local / admin123456" : "请使用在 Supabase 中创建的管理员账号登录"}</p>
        {demo && (
          <div className="alert info" style={{ marginBottom: 16 }}>
            当前为本地演示模式。正式使用请按 README 配置 Supabase 环境变量（登录后自动切换云端）。
          </div>
        )}
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <div className="field">
            <label>邮箱</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required autoComplete="username" />
          </div>
          <div className="field">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
          </div>
          <StatusInline status={status.type} text={status.text} />
          <button className="btn primary" type="submit" disabled={busy} style={{ padding: 13 }}>
            {busy ? "登录中..." : "登录后台"}
          </button>
        </form>
        <p style={{ marginTop: 18, textAlign: "center" }}>
          <Link href="/" style={{ color: "var(--primary)", fontSize: 12 }}>
            ← 返回网站前台
          </Link>
        </p>
      </div>
    </div>
  );
}

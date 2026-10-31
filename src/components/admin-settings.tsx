"use client";

import { useState } from "react";
import { apiFetch, ConfirmDialog, StatusInline } from "@/components/admin-ui";

export function SystemSettings({ mode }: { mode: "supabase" | "demo" }) {
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error" | "info" | ""; text: string }>({ type: "", text: "" });
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const changePassword = async () => {
    setBusy(true);
    setStatus({ type: "info", text: "修改中..." });
    try {
      const d = await apiFetch("/api/admin/password", { method: "POST", body: JSON.stringify({ password: newPassword }) });
      setStatus({ type: "success", text: d.message || "密码已修改" });
      setNewPassword("");
    } catch (e) {
      setStatus({ type: "error", text: e instanceof Error ? e.message : "修改失败" });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/admin/reset-demo", { method: "POST" });
      window.location.href = "/admin";
    } catch (e) {
      setStatus({ type: "error", text: e instanceof Error ? e.message : "重置失败" });
      setConfirmReset(false);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="panel">
        <h2>数据存储状态</h2>
        <p>系统会自动检测环境变量，选择对应的数据存储模式。</p>
        {mode === "supabase" ? (
          <div className="alert success">已连接 Supabase 云端数据库与存储（PostgreSQL + Auth + Storage）。</div>
        ) : (
          <div className="alert warn">
            当前为本地演示模式：数据保存在项目 <code>data/demo-store.json</code> 文件中，仅适合本地体验，不具备云端多用户能力。
            按 README 配置 <code>NEXT_PUBLIC_SUPABASE_URL</code>、<code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>、
            <code>SUPABASE_SERVICE_ROLE_KEY</code> 并执行 SQL 初始化脚本后，系统自动切换为云端模式。
          </div>
        )}
        <ul style={{ fontSize: 12, color: "#5c726d", lineHeight: 2, margin: "10px 0 0", paddingLeft: 18 }}>
          <li>管理员登录：后台 /admin/login，权限在服务端校验（页面 + API 双重保护）。</li>
          <li>领取链接：仅在服务端确认满足任务条件后返回，前端无法绕过。</li>
          <li>截图上传：服务端校验格式（魔数）、大小（≤5MB）、数量。</li>
          <li>提交记录：仅管理员可查看，匿名用户相互隔离。</li>
        </ul>
      </div>

      {mode === "demo" && (
        <>
          <div className="panel">
            <h2>演示管理员账号</h2>
            <p>
              当前账号：<code>admin@demo.local</code>（演示模式专用）。切换云端模式后，请使用在 Supabase 中创建并加入
              <code>admin_users</code> 表的管理员账号登录。
            </p>
            <div className="form-grid" style={{ maxWidth: 460 }}>
              <div className="field">
                <label>新密码（至少 6 位）</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn primary" onClick={changePassword} disabled={busy || newPassword.length < 6}>
                {busy ? "处理中..." : "修改演示密码"}
              </button>
              <StatusInline status={status.type} text={status.text} />
            </div>
          </div>

          <div className="panel">
            <h2>危险操作</h2>
            <p>重置本地演示数据：清空资源、分类、公告、提交记录与设置，恢复到初始示例状态（仅演示模式可用）。</p>
            <button className="btn danger" onClick={() => setConfirmReset(true)} disabled={busy}>
              重置演示数据
            </button>
          </div>
        </>
      )}

      <div className="panel">
        <h2>部署检查清单</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>步骤</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1. 创建 Supabase 项目</td>
                <td>supabase.com 免费创建，记录 Project URL / anon key / service_role key</td>
              </tr>
              <tr>
                <td>2. 执行数据库初始化 SQL</td>
                <td>项目根目录 <code>supabase/init.sql</code>（建表 + RLS + 存储桶）</td>
              </tr>
              <tr>
                <td>3. 创建管理员账号</td>
                <td>Supabase 控制台 Authentication → Users 创建账号，并将 user id 插入 admin_users 表</td>
              </tr>
              <tr>
                <td>4. 配置环境变量</td>
                <td>复制 .env.example 为 .env.local 并填写（service_role key 仅服务端使用，切勿加 NEXT_PUBLIC_ 前缀）</td>
              </tr>
              <tr>
                <td>5. 部署</td>
                <td>Vercel 导入项目，环境变量同步配置；部署后 /admin/login 登录即可运营</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="重置演示数据"
        message="将清空所有本地数据并恢复初始示例。此操作不可恢复，确定继续吗？"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={reset}
      />
    </>
  );
}

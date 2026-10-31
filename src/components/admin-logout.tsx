"use client";

import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };
  return (
    <button className="logout-btn" onClick={logout}>
      退出登录
    </button>
  );
}

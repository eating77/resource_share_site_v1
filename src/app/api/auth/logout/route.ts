import { NextResponse } from "next/server";
import { adminLogout, ADMIN_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await adminLogout();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "退出失败" }, { status: 500 });
  }
}

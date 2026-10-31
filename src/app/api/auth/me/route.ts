import { NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = await getAdminEmail();
  return NextResponse.json({
    ok: true,
    email,
    mode: isSupabaseConfigured() ? "supabase" : "demo",
  });
}

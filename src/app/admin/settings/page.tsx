import { isSupabaseConfigured } from "@/lib/db";
import { SystemSettings } from "@/components/admin-settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  return <SystemSettings mode={isSupabaseConfigured() ? "supabase" : "demo"} />;
}

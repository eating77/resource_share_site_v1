import { getSiteSettings } from "@/lib/db";
import { AppearanceForm } from "@/components/admin-appearance";

export const dynamic = "force-dynamic";

export default async function AdminAppearancePage() {
  const settings = await getSiteSettings();
  return <AppearanceForm settings={settings} />;
}

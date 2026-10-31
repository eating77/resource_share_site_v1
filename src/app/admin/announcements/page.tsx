import { getSiteSettings, listAnnouncements } from "@/lib/db";
import { AnnouncementsPage } from "@/components/admin-announcements";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsRoute() {
  const [announcements, settings] = await Promise.all([listAnnouncements(), getSiteSettings()]);
  return <AnnouncementsPage initial={announcements} settings={settings} />;
}

import { getSiteSettingsCached, listAnnouncements, listCategories, listResources } from "@/lib/db";
import { HomeClient, SiteFooter, SiteHeader } from "@/components/site";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function Home() {
  const settings = await getSiteSettingsCached();
  const categories = await listCategories();
  const [allResources, announcements] = await Promise.all([
    listResources({ publishedOnly: true, homeOnly: true, limit: settings.home_resource_count || 100 }),
    listAnnouncements({ enabledOnly: true }),
  ]);
  const topAnnouncements = announcements.filter((a) => a.position === "home_top");
  const noticeAnnouncements = announcements.filter((a) => a.position === "notice");

  return (
    <main>
      <SiteHeader settings={settings} />
      <HomeClient settings={settings} initialResources={allResources} categories={categories} />
      {topAnnouncements.map((a) => (
        <section className="notice top-notice" key={a.id}>
          <span>📌</span>
          <div>
            <b>{a.title || "顶部公告"}</b>
            <p style={{ whiteSpace: "pre-wrap" }}>{a.content}</p>
          </div>
        </section>
      ))}
      {noticeAnnouncements.map((a) => (
        <section className="notice" key={a.id}>
          <span>✦</span>
          <div>
            <b>{a.title || "站内公告"}</b>
            <p style={{ whiteSpace: "pre-wrap" }}>{a.content}</p>
          </div>
        </section>
      ))}
      <SiteFooter settings={settings} />
    </main>
  );
}

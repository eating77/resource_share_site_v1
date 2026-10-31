import Link from "next/link";
import { getSiteSettingsCached } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { SiteFooter, SiteHeader } from "@/components/site";

export const dynamic = "force-dynamic";

export default async function NotFoundPage() {
  let settings = DEFAULT_SETTINGS;
  try {
    settings = (await getSiteSettingsCached()) || DEFAULT_SETTINGS;
  } catch {
    settings = DEFAULT_SETTINGS;
  }
  return (
    <main>
      <SiteHeader settings={settings} />
      <div className="not-found">
        <h1>404</h1>
        <p>页面不存在或已被移除。</p>
        <Link href="/" className="submit-button" style={{ display: "inline-block" }}>
          返回首页
        </Link>
      </div>
      <SiteFooter settings={settings} />
    </main>
  );
}

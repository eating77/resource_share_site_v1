import { getSiteSettingsCached, listResources } from "@/lib/db";
import { ResourceGrid, SiteFooter, SiteHeader } from "@/components/site";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const settings = await getSiteSettingsCached();
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (raw || "").trim().slice(0, 100);
  const results = q ? await listResources({ search: q, publishedOnly: true, limit: 100 }) : [];

  return (
    <main>
      <SiteHeader settings={settings} query={q} />
      <div className="page-head">
        <h1>{q ? `“${q}” 的搜索结果` : "资源搜索"}</h1>
        <p>{q ? `共找到 ${results.length} 个相关资源` : "请输入关键词进行搜索"}</p>
      </div>
      <div className="page-body">
        <ResourceGrid resources={results} settings={settings} emptyText={settings.copy_search_empty || "没有找到匹配的资源，试试其他关键词吧。"} />
      </div>
      <SiteFooter settings={settings} />
    </main>
  );
}

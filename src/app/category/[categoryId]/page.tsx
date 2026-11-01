import { getSiteSettingsCached, listCategories, listResources } from "@/lib/db";
import { ResourceGrid, SiteFooter, SiteHeader } from "@/components/site";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function CategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const [settings, categories] = await Promise.all([getSiteSettingsCached(), listCategories()]);
  const category = categories.find((c) => c.id === categoryId);
  if (!category) notFound();
  const resources = await listResources({ categoryId: category.id, publishedOnly: true, limit: 100 });

  return (
    <main>
      <SiteHeader settings={settings} />
      <div className="page-head">
        <h1>
          {category.icon} {category.name}
        </h1>
        <p>共 {resources.length} 个资源</p>
      </div>
      <div className="page-body">
        <ResourceGrid resources={resources} settings={settings} />
      </div>
      <SiteFooter settings={settings} />
    </main>
  );
}

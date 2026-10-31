import { listCategories, listResources } from "@/lib/db";
import { CategoryManager } from "@/components/admin-categories";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function AdminCategoriesPage() {
  const [categories, resources] = await Promise.all([listCategories(), listResources({ limit: 1000 })]);
  const counts: Record<string, number> = {};
  for (const r of resources) {
    if (r.category_id) counts[r.category_id] = (counts[r.category_id] || 0) + 1;
  }
  return <CategoryManager initial={categories} resourceCounts={counts} />;
}

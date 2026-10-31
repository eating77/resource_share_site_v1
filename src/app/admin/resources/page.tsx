import { listCategories, listResources } from "@/lib/db";
import { AdminResourcesList } from "@/components/admin-resources-list";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function AdminResourcesPage() {
  const [resources, categories] = await Promise.all([listResources({ limit: 1000 }), listCategories()]);
  return <AdminResourcesList initial={resources} categories={categories} />;
}

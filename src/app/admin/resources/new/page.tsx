import Link from "next/link";
import { listCategories, getResource, getTask } from "@/lib/db";
import { ResourceForm } from "@/components/resource-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewResourcePage() {
  const categories = await listCategories();
  return (
    <>
      <div className="panel-head" style={{ marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>新增资源</h2>
          <p style={{ color: "#8b9c99", fontSize: 12, margin: "4px 0 0" }}>
            保存后前台立即展示最新数据；可在下方继续配置领取任务。
          </p>
        </div>
        <Link href="/admin/resources" className="btn ghost small">
          ← 返回资源列表
        </Link>
      </div>
      <ResourceForm resource={null} task={null} categories={categories} isNew />
    </>
  );
}

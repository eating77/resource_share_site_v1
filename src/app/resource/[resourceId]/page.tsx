import Link from "next/link";
import { notFound } from "next/navigation";
import { getResource, getSiteSettingsCached, getTask } from "@/lib/db";
import { SiteFooter, SiteHeader, ViewCounter } from "@/components/site";
import { TaskEntry } from "@/components/task-entry";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function ResourceDetailPage({ params }: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await params;
  const [settings, resource] = await Promise.all([getSiteSettingsCached(), getResource(resourceId)]);
  if (!resource || !resource.is_published) notFound();
  const task = await getTask(resource.id);

  return (
    <main>
      <SiteHeader settings={settings} />
      <ViewCounter resourceId={resource.id} />
      <div className="task-page">
        <div className="task-wrap detail-wrap">
          <Link href="/" className="back-link">
            ← 返回首页
          </Link>
          <section className="resource-summary">
            <div className="detail-cover">
              {resource.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resource.cover_url} alt={resource.title} />
              ) : (
                resource.cover_emoji || "📦"
              )}
            </div>
            <div className="summary-copy">
              <span className="tag">{resource.category_name || "未分类"}</span>
              <h1>{resource.title}</h1>
              <p>{resource.description}</p>
              <div className="meta">
                <span>◉ {(resource.views || 0).toLocaleString()} 次浏览</span>
                {resource.size && <span>♧ {resource.size}</span>}
                <span className="rating">★ {resource.rating}</span>
                {resource.tags.length > 0 && (
                  <span className="tags">
                    {resource.tags.map((t) => `#${t}`).join(" ")}
                  </span>
                )}
              </div>
            </div>
          </section>

          {resource.detail_content && (
            <section className="detail-content card">
              <h2>资源介绍</h2>
              <div style={{ whiteSpace: "pre-wrap" }}>{resource.detail_content}</div>
            </section>
          )}

          <TaskEntry
            resourceId={resource.id}
            settings={{ copy_task_start: settings.copy_task_start, copy_auto_pass: settings.copy_auto_pass }}
            taskEnabled={task ? task.enabled : true}
          />

          <div className="task-footer">
            <Link href="/">返回首页</Link>
            <span>© {settings.name}</span>
          </div>
        </div>
      </div>
      <SiteFooter settings={settings} />
    </main>
  );
}

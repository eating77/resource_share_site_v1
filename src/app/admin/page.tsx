import Link from "next/link";
import { listCategories, listResources, listSubmissions } from "@/lib/db";
import { formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [all, categories, submissions] = await Promise.all([
    listResources({ limit: 1000 }),
    listCategories(),
    listSubmissions(),
  ]);
  const published = all.filter((r) => r.is_published).length;
  const home = all.filter((r) => r.is_home && r.is_published).length;
  const recent = submissions.slice(0, 6);

  return (
    <>
      <div className="stats-row">
        <div>
          <span>资源总数</span>
          <b>{all.length}</b>
        </div>
        <div>
          <span>已发布 / 展示首页</span>
          <b>
            {published} / {home}
          </b>
        </div>
        <div>
          <span>分类数</span>
          <b>{categories.length}</b>
        </div>
        <div>
          <span>截图提交记录</span>
          <b>{submissions.length}</b>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>快捷操作</h2>
        </div>
        <div className="row-actions" style={{ gap: 10 }}>
          <Link className="btn primary" href="/admin/resources/new">
            ＋ 新增资源
          </Link>
          <Link className="btn" href="/admin/categories">
            管理分类
          </Link>
          <Link className="btn" href="/admin/appearance">
            外观设置
          </Link>
          <Link className="btn" href="/admin/announcements">
            公告与文案
          </Link>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>最近截图提交</h2>
          <Link className="btn small ghost" href="/admin/submissions">
            查看全部 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">暂无提交记录。前台用户完成截图上传后会自动通过并出现在这里。</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>资源</th>
                  <th>图片数</th>
                  <th>状态</th>
                  <th>提交时间</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td className="row-title">{s.resource_title}</td>
                    <td>{s.screenshot_count} 张</td>
                    <td>
                      <span className="badge green">自动通过</span>
                    </td>
                    <td>{formatTime(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** 资源详情页的任务入口：查询领取状态，已通过则展示领取入口，否则展示开始任务 */
export function TaskEntry({ resourceId, settings, taskEnabled }: { resourceId: string; settings: { copy_task_start: string; copy_auto_pass: string }; taskEnabled: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "todo" | "done">("loading");
  useEffect(() => {
    let alive = true;
    fetch(`/api/resources/${resourceId}/claim-status`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setState(d.ok && d.approved ? "done" : "todo");
      })
      .catch(() => alive && setState("todo"));
    return () => {
      alive = false;
    };
  }, [resourceId]);

  if (!taskEnabled) {
    return (
      <div className="task-banner">
        <span>📌</span>
        <div>
          <b>本资源暂未设置领取任务</b>
          <p>管理员尚未为该资源配置任务，请稍后再来。</p>
        </div>
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className="task-banner done">
        <span>✅</span>
        <div>
          <b>你已满足领取条件</b>
          <p>点击下方按钮立即获取资源。</p>
        </div>
        <Link className="submit-button" href={`/resource/${resourceId}/success`}>
          立即获取 →
        </Link>
      </div>
    );
  }
  return (
    <div className="task-banner">
      <span>📌</span>
      <div>
        <b>完成宣传任务，免费领取资源</b>
        <p>30秒完成，超级简单❤</p>
      </div>
      <button className="submit-button" onClick={() => router.push(`/resource/${resourceId}/task`)}>
        {settings.copy_task_start || "开始任务"} →
      </button>
    </div>
  );
}

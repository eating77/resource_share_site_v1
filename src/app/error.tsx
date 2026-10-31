"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <div className="not-found">
        <h1>出错了</h1>
        <p>页面暂时无法加载，请稍后重试。</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="submit-button" onClick={() => reset()}>
            重新加载
          </button>
          <a className="submit-button" href="/">
            返回首页
          </a>
        </div>
      </div>
    </main>
  );
}

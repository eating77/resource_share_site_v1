"use client";

/**
 * 根布局级别错误兜底：当根 layout 自身抛错时展示，避免白屏。
 * 必须自带 html/body 标签。
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#f6faf9",
          color: "#16302b",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 40, margin: "0 0 12px" }}>服务暂时不可用</h1>
          <p style={{ color: "#5c726d", margin: "0 0 20px" }}>站点初始化失败，请稍后刷新重试。</p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "#7c3aed",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            重新加载
          </button>
        </div>
      </body>
    </html>
  );
}

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext Cloudflare 配置。
 *
 * 本项目 src/app/layout.tsx 声明了 force-dynamic，全站动态渲染、没有 ISR，
 * 因此不启用 R2 增量缓存（启用它需要额外创建 R2 桶并绑定 NEXT_INC_CACHE_R2_BUCKET）。
 *
 * 后续若要使用 ISR（把页面的 force-dynamic 换成 revalidate），改为：
 *   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
 *   export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
 */
export default defineCloudflareConfig();

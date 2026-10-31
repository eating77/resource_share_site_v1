/**
 * 轻量级内存限流器。
 *
 * 说明：部署在单实例（或常规 Vercel 函数实例）时可以有效拦截暴力登录、刷上传等滥用行为；
 * 多实例/无服务器环境下每个实例独立计数，仅作为基础防护，不能替代网关级限流。
 */

type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export type RateLimitResult = { ok: boolean; retryAfter: number; remaining: number };

/** 滑动窗口计数：同一 key 在 windowMs 内最多 limit 次 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.reset) {
    if (buckets.size > MAX_BUCKETS) {
      for (const [k, v] of buckets) {
        if (now >= v.reset) buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)), remaining: 0 };
  }

  bucket.count += 1;
  return { ok: true, retryAfter: 0, remaining: limit - bucket.count };
}

/** 获取请求方 IP（兼容常见反向代理头），失败时回退到 unknown */
export function clientIp(request: Request): string {
  const h = request.headers;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || "unknown";
}

/** 统一生成限流响应 */
export function tooManyRequests(retryAfter: number) {
  return Response.json(
    { ok: false, error: "操作过于频繁，请稍后再试" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

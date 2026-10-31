/**
 * 仅本机 Windows 沙箱使用的构建补丁（不影响 Cloudflare 构建机）。
 *
 * 背景：本机沙箱会拦截 Next.js 创建诊断文件 `.next/trace`，
 * 导致 `next build` 在编译一开始就抛 `EPERM: operation not permitted, open '.next/trace'`。
 * 该文件只是 Next 的性能诊断日志（trace reporter），与构建产物无关。
 *
 * 用法（仅本地需要时）：
 *   WB_NO_NEXT_TRACE=1 NODE_OPTIONS="--require=<绝对路径>/scripts/no-next-trace.cjs" npm run pages:build
 *
 * 通过 NODE_OPTIONS 注入，因此 vercel CLI / next build 等子进程同样生效；
 * 仅当 WB_NO_NEXT_TRACE=1 时启用，且只拦截 `.next/trace` 这一个路径，其余文件写入不受影响。
 */
if (process.env.WB_NO_NEXT_TRACE === "1") {
  const fs = require("fs");
  const { Writable } = require("stream");
  const original = fs.createWriteStream;

  fs.createWriteStream = function (target, ...rest) {
    const file = String(target);
    if (/[\\/]\.next[\\/]trace$/.test(file)) {
      const sink = new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      });
      sink.path = file;
      sink.bytesWritten = 0;
      sink.close = (callback) => {
        if (typeof callback === "function") callback();
      };
      return sink;
    }
    return original.call(fs, target, ...rest);
  };
}

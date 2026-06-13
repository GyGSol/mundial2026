/** Logs API response time and exposes X-Response-Time for baseline measurement. */
export function requestTimingMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  const originalEnd = res.end;
  res.end = function endWithTiming(...args) {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${elapsedMs.toFixed(1)}ms`);
    } else {
      try {
        res.setHeader('X-Response-Time', `${elapsedMs.toFixed(1)}ms`);
      } catch {
        // response already committed
      }
    }

    if (req.path.startsWith('/api') && elapsedMs >= 200) {
      console.log(
        `[perf] ${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(0)}ms`
      );
    }

    return originalEnd.apply(this, args);
  };

  next();
}

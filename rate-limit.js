const { createHmac } = require("node:crypto");

function createApiRateLimitMiddleware({ sharedRateLimiter, localRateLimit, logger = console, keyForRequest = req => req.ip }) {
  return async function apiRateLimitMiddleware(req, res, next) {
    if (!sharedRateLimiter) return localRateLimit(req, res, next);
    try {
      const result = await sharedRateLimiter.limit(keyForRequest(req));
      res.set("RateLimit-Limit", String(result.limit));
      res.set("RateLimit-Remaining", String(result.remaining));
      if (!result.success) {
        res.set("Retry-After", String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))));
        return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
      }
      return next();
    } catch (error) {
      logger.error("Shared API rate limiter unavailable:", error.message);
      return res.status(503).json({ error: "The API is temporarily unavailable. Please try again shortly." });
    }
  };
}

function createIpFingerprint(secret) {
  return ip => createHmac("sha256", secret).update(String(ip)).digest("hex");
}

module.exports = { createApiRateLimitMiddleware, createIpFingerprint };

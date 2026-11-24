const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createApiRateLimitMiddleware, createIpFingerprint } = require("../rate-limit");

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("shared rate limiter forwards allowed requests and publishes quota headers", async () => {
  let checkedIp;
  let advanced = false;
  const middleware = createApiRateLimitMiddleware({
    sharedRateLimiter: { limit: async ip => { checkedIp = ip; return { success: true, limit: 30, remaining: 29 }; } },
    localRateLimit: () => assert.fail("local limiter should not run")
  });
  const res = responseRecorder();
  await middleware({ ip: "203.0.113.4" }, res, () => { advanced = true; });
  assert.equal(checkedIp, "203.0.113.4");
  assert.equal(advanced, true);
  assert.equal(res.headers["RateLimit-Limit"], "30");
  assert.equal(res.headers["RateLimit-Remaining"], "29");
});

test("shared rate limiter returns 429 and a retry delay when exhausted", async () => {
  const middleware = createApiRateLimitMiddleware({
    sharedRateLimiter: { limit: async () => ({ success: false, limit: 30, remaining: 0, reset: Date.now() + 12_000 }) },
    localRateLimit: () => assert.fail("local limiter should not run")
  });
  const res = responseRecorder();
  let advanced = false;
  await middleware({ ip: "203.0.113.5" }, res, () => { advanced = true; });
  assert.equal(advanced, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "12");
  assert.match(res.body.error, /too many requests/i);
});

test("shared rate limiter fails closed with 503 when Redis is unavailable", async () => {
  const logged = [];
  const middleware = createApiRateLimitMiddleware({
    sharedRateLimiter: { limit: async () => { throw new Error("connection unavailable"); } },
    localRateLimit: () => assert.fail("must not silently switch to per-instance limits"),
    logger: { error: (...args) => logged.push(args) }
  });
  const res = responseRecorder();
  let advanced = false;
  await middleware({ ip: "203.0.113.6" }, res, () => { advanced = true; });
  assert.equal(advanced, false);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /temporarily unavailable/i);
  assert.equal(logged.length, 1);
});

test("uses the local limiter when shared storage is not configured", async () => {
  let called = false;
  const localRateLimit = (req, res, next) => { called = req.ip === "127.0.0.1"; return next(); };
  const middleware = createApiRateLimitMiddleware({ sharedRateLimiter: null, localRateLimit });
  let advanced = false;
  await middleware({ ip: "127.0.0.1" }, responseRecorder(), () => { advanced = true; });
  assert.equal(called, true);
  assert.equal(advanced, true);
});


test("shared rate limit identifiers are keyed by a one-way HMAC fingerprint", async () => {
  const ip = "203.0.113.7";
  const fingerprint = createIpFingerprint("test-private-secret");
  assert.equal(fingerprint(ip), fingerprint(ip));
  assert.notEqual(fingerprint(ip), ip);
  assert.notEqual(fingerprint(ip), createIpFingerprint("different-secret")(ip));
  let storedKey;
  const middleware = createApiRateLimitMiddleware({
    sharedRateLimiter: { limit: async key => { storedKey = key; return { success: true, limit: 30, remaining: 29 }; } },
    localRateLimit: () => assert.fail("local limiter should not run"),
    keyForRequest: req => fingerprint(req.ip)
  });
  await middleware({ ip }, responseRecorder(), () => {});
  assert.equal(storedKey, fingerprint(ip));
  assert.notEqual(storedKey, ip);
});

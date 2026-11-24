const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { after, before, test } = require("node:test");
const app = require("../server");

let server;
let baseUrl;

async function withMockedGroq(responseBody, run) {
  const originalFetch = global.fetch;
  const savedKey = process.env.GROQ_API_KEY;
  let capturedRequest;
  process.env.GROQ_API_KEY = "test-key-not-a-real-secret";
  global.fetch = async (url, options) => {
    if (String(url) === "https://api.groq.com/openai/v1/chat/completions") {
      capturedRequest = { url: String(url), options };
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };
  try {
    return await run(() => capturedRequest);
  } finally {
    global.fetch = originalFetch;
    if (savedKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = savedKey;
  }
}

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test("serves the HealMeal home page", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /HealMeal - AI Meal & Nutrition Assistant/);
});

test("home page has keyboard navigation and named chat controls", async () => {
  const html = await readFile(require.resolve("../index.html"), "utf8");
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(html, /id="conversationArea"[^>]*role="log"/);
  assert.match(html, /id="voiceBtn"[^>]*aria-label="Start voice input"/);
  assert.match(html, /id="voiceInput"[^>]*aria-label="Type your health question"/);
  assert.match(html, /id="sendBtn"[^>]*aria-label="Send question"/);
});

test("health endpoint responds with JSON", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("rejects an empty chat question without calling Groq", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "" })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /question/i);
});

test("explains server-side key setup when the Groq key is missing", async () => {
  const savedKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What are general nutrition basics?" })
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /server environment/i);
  } finally {
    if (savedKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = savedKey;
  }
});

test("chat returns a Groq answer and keeps the key on the server", async () => {
  await withMockedGroq({ choices: [{ message: { content: "A varied diet can support general wellbeing." } }] }, async getRequest => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What supports general wellbeing?" })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { answer: "A varied diet can support general wellbeing." });
    const request = getRequest();
    assert.equal(request.options.headers.Authorization, "Bearer test-key-not-a-real-secret");
    assert.equal(request.options.body.includes("test-key-not-a-real-secret"), false);
  });
});

test("rejects an empty meal-plan concern without calling Groq", async () => {
  const response = await fetch(`${baseUrl}/api/meal-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ healthConcern: "" })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /health concern/i);
});

test("meal-plan endpoint validates the AI result and returns relevant references", async () => {
  const plan = {
    overview: "These are general meal ideas to discuss with a clinician.",
    meals: ["Breakfast", "Lunch", "Dinner", "Snack"].map(meal => ({
      meal, name: `${meal} option`, description: "A familiar, balanced meal idea.",
      calories: 350, protein_g: 14, carbs_g: 45, fiber_g: 7
    })),
    nutrition_focus: ["Variety", "Regular meals", "Seasonal produce"],
    helpful_foods: ["Dal", "Curd", "Vegetables", "Rice"],
    disclaimer: "Review changes with a clinician."
  };
  await withMockedGroq({ choices: [{ message: { content: JSON.stringify(plan) } }] }, async getRequest => {
    const response = await fetch(`${baseUrl}/api/meal-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ healthConcern: "heartburn" })
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.meals.length, 4);
    assert.ok(result.sources.some(source => source.label.includes("GERD")));
    assert.equal(getRequest().options.headers.Authorization, "Bearer test-key-not-a-real-secret");
  });
});

test("rejects empty speech text without calling ElevenLabs", async () => {
  const response = await fetch(`${baseUrl}/api/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "" })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /text/i);
});

test("sets security headers and hides Express's version header", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  assert.match(response.headers.get("content-security-policy"), /object-src 'none'/);
});

test("trusts one proxy hop for Vercel client IP handling", () => {
  assert.equal(app.get("trust proxy"), 1);
});


test("Vercel applies browser security headers before preserving API and static routes", async () => {
  const config = JSON.parse(await readFile(require.resolve("../vercel.json"), "utf8"));
  const headerRoute = config.routes[0];
  assert.equal(headerRoute.src, "/(.*)");
  assert.equal(headerRoute.continue, true);
  assert.match(headerRoute.headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(headerRoute.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(config.routes[1].src, "/api/(.*)");
  assert.equal(config.routes[1].dest, "/server.js");
  assert.equal(config.routes[2].src, "/(.*)");
  assert.equal(config.routes[2].dest, "/$1");
});

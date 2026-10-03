import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
function compile(path, imports) {
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", source)(module, module.exports, imports);
  return module.exports;
}
const worker = compile("worker/src/index.ts", name => {
  if (name === "./discussion") return {};
  if (name === "@block65/webcrypto-web-push") return {};
  throw new Error(`Unexpected import: ${name}`);
}).default;
const values = new Map();
const env = { VIEW_COUNTER: {
  async get(key) { return values.get(key) ?? null; },
  async put(key, value) { values.set(key, value); },
  async delete(key) { values.delete(key); },
  async list({ prefix, cursor }) {
    const keys = [...values.keys()].filter(key => key.startsWith(prefix));
    const offset = cursor ? Number(cursor) : 0;
    return { keys: keys.slice(offset, offset + 1).map(name => ({ name })), list_complete: offset + 1 >= keys.length, cursor: String(offset + 1) };
  }
} };
const context = { waitUntil() {} };
const call = (path, options = {}, binding = env) => worker.fetch(new Request(`https://worker.test${path}`, options), binding, context);
const signup = email => call("/subscribe", { method: "POST", body: JSON.stringify({ email }) });
for (const email of ["bad", "a b@example.com", "x@@example.com", "<x>@example.com"]) assert.equal((await signup(email)).status, 400);
assert.equal((await call("/subscribe", { method: "POST", body: "null" })).status, 400);
assert.equal((await call("/subscribe", { method: "POST", body: "x".repeat(2049) })).status, 413);
assert.equal((await call("/subscribe")).status, 405);
assert.equal((await signup("Reader@Example.com")).status, 201, "Saving succeeds without mail provider credentials");
let records = [...values.entries()].filter(([key]) => key.startsWith("subscriber:"));
assert.equal(records.length, 1);
let saved = JSON.parse(records[0][1]);
assert.equal(saved.email, "reader@example.com");
assert.equal(saved.verified, true);
assert.equal(saved.consent, "signup-form");
assert.ok(saved.subscribedAt);
assert.ok(![...values.keys()].some(key => key.startsWith("confirm:")));
const duplicate = await (await signup("reader@example.com")).json();
assert.equal(duplicate.alreadySubscribed, true);
assert.equal([...values.keys()].filter(key => key.startsWith("subscriber:")).length, 1);
assert.equal((await call("/admin/subscribers")).status, 401, "Unset secret fails closed");
env.SUBSCRIBER_ADMIN_SECRET = "test-only-admin-secret";
assert.equal((await call("/admin/subscribers", { headers: { Authorization: "Bearer wrong" } })).status, 401);
const auth = { headers: { Authorization: "Bearer test-only-admin-secret" } };
let page = await (await call("/admin/subscribers", auth)).json();
assert.equal(page.subscribers[0].email, saved.email);
assert.equal(page.subscribers[0].active, true);
assert.ok(!JSON.stringify(page).includes(saved.unsubscribeToken));
assert.ok(!JSON.stringify(page).includes(saved.unsubscribeHash));
await signup("second@example.com");
page = await (await call("/admin/subscribers", auth)).json();
assert.ok(page.nextCursor);
assert.equal((await (await call(`/admin/subscribers?cursor=${page.nextCursor}`, auth)).json()).subscribers[0].email, "second@example.com");
assert.equal((await call("/admin/subscribers", { ...auth, method: "POST" })).status, 405);
const unavailable = { VIEW_COUNTER: { ...env.VIEW_COUNTER, async put() { throw new Error("storage down"); } } };
assert.equal((await call("/subscribe", { method: "POST", body: JSON.stringify({ email: "fail@example.com" }) }, unavailable)).status, 503);
assert.equal((await call(`/subscribe/unsubscribe?token=${saved.unsubscribeToken}`)).status, 200);
assert.equal(await env.VIEW_COUNTER.get(records[0][0]), null);
// Re-signing up a legacy pending address activates only that address.
records = [...values.entries()].filter(([key]) => key.startsWith("subscriber:"));
saved = JSON.parse(records[0][1]); saved.verified = false;
await env.VIEW_COUNTER.put(records[0][0], JSON.stringify(saved));
assert.equal((await signup("second@example.com")).status, 201);
assert.equal(JSON.parse(await env.VIEW_COUNTER.get(records[0][0])).verified, true);

const route = compile("app/api/bug-report/route.ts", require);
const report = payload => route.POST(new Request("https://base31.org/api/bug-report", { method: "POST", body: JSON.stringify(payload) }));
assert.equal((await report({ kind: "url", url: "javascript:alert(1)", message: "A useful discovery" })).status, 400);
assert.equal((await report({ kind: "url", url: "https://user:pass@example.com", message: "A useful discovery" })).status, 400);
const oldFetch = globalThis.fetch;
const oldKey = process.env.RESEND_API_KEY;
const oldFrom = process.env.RESEND_FROM_EMAIL;
try {
  process.env.RESEND_API_KEY = "test-only-key";
  process.env.RESEND_FROM_EMAIL = "test@example.com";
  let message;
  globalThis.fetch = async (_url, options) => { message = JSON.parse(options.body); return new Response("{}", { status: 200 }); };
  assert.equal((await report({ kind: "url", url: "https://spriteframe.com/png-to-sprite-sheet", message: "Helpful <frames> for games" })).status, 202);
  assert.equal(message.subject, "New base31.org URL suggestion");
  assert.match(message.text, /https:\/\/spriteframe.com\/png-to-sprite-sheet/);
  assert.match(message.html, /&lt;frames&gt;/);
  globalThis.fetch = async () => new Response("{}", { status: 500 });
  assert.equal((await report({ kind: "url", url: "https://example.com", message: "A useful discovery" })).status, 502);
} finally {
  globalThis.fetch = oldFetch;
  if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
  if (oldFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = oldFrom;
}
const homepage = fs.readFileSync("components/home-page.tsx", "utf8");
assert.match(homepage, /<CoolAis[^\n]+\/>\s*<UrlSubmission \/>/);
assert.match(homepage, /href="#submit-url"/);
for (const url of ["https://dev.to/base31", "https://medium.com/@base31dotorg"]) assert.ok(homepage.includes(url));
console.log("Subscription and suggestion tests passed: immediate storage, deduplication, protected admin pagination, unsubscribe, failure responses and URL review delivery.");

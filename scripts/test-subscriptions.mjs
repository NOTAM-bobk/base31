import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const compiled = ts.transpileModule(fs.readFileSync("worker/src/index.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", "require", compiled)(module, module.exports, name => {
  if (name === "./discussion" || name === "@block65/webcrypto-web-push") return {};
  if (name === "../../lib/vote-ranking") {
    const ranking = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync("lib/vote-ranking.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    new Function("module", "exports", code)(ranking, ranking.exports);
    return ranking.exports;
  }
  throw new Error(`Unexpected import: ${name}`);
});
const worker = module.exports.default;
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
assert.equal((await (await signup("reader@example.com")).json()).alreadySubscribed, true);
assert.equal([...values.keys()].filter(key => key.startsWith("subscriber:")).length, 1);
assert.equal((await call("/admin/data")).status, 401, "Unset secret fails closed");
env.COUNTER_SECRET = "test-only-admin-secret";
assert.equal((await call("/admin/data", { headers: { Authorization: "Bearer wrong" } })).status, 401);
const auth = { headers: { Authorization: "Bearer test-only-admin-secret" } };
let page = await (await call("/admin/data", auth)).json();
assert.equal(page.subscribers[0].email, saved.email);
assert.equal(page.subscribers[0].verified, true);
assert.ok(!JSON.stringify(page).includes(saved.unsubscribeToken));
assert.ok(!JSON.stringify(page).includes(saved.unsubscribeHash));
await signup("second@example.com");
page = await (await call("/admin/data", auth)).json();
assert.equal(page.subscribers.length, 2, "Existing admin loads paginated KV records");
assert.equal((await call("/admin/data", { ...auth, method: "POST" })).status, 405);
// GET /quality backs /quality-report: the public health-check report. It has to
// stay read-only, report the same fields the admin panel shows, and count what
// the page prints without the page recounting.
const now = Date.now();
const putSite = (slug, record) => values.set(`pub:${slug}`, JSON.stringify({ slug, title: slug, description: "d", tags: [], indexPath: "index.html", files: [], createdAt: now, active: true, ...record }));
putSite("fresh-one", { lastCheckedAt: now - 60_000, healthFailures: 0 });
putSite("never-checked", {});
putSite("failing", { lastCheckedAt: now - 3_600_000, healthFailures: 3 });
putSite("hidden", { active: false, lastCheckedAt: now - 10 * 86_400_000, healthFailures: 2 });
assert.equal((await call("/quality", { method: "POST" })).status, 405);
const qualityResponse = await call("/quality");
assert.equal(qualityResponse.status, 200);
assert.equal(qualityResponse.headers.get("Cache-Control"), "public, max-age=300");
const quality = await qualityResponse.json();
assert.equal(quality.summary.sites, 4);
assert.equal(quality.summary.checked, 3);
assert.equal(quality.summary.neverChecked, 1);
assert.equal(quality.summary.failing, 2, "A failure count or a hidden site both count as failing");
assert.equal(quality.summary.hidden, 1);
assert.equal(quality.summary.stale, 1, "Only the site with no check in a week is overdue");
assert.equal(quality.summary.staleAfterDays, 7);
assert.ok(quality.summary.lastCheckedAt > 0);
assert.equal(quality.checks.length, 4);
assert.deepEqual(quality.checks.map((site) => site.slug), ["never-checked", "hidden", "failing", "fresh-one"], "Oldest check first, never-checked at the top");
assert.ok(quality.checks.every((site) => site.title && site.url.startsWith("https://worker.test/s/") && typeof site.active === "boolean"));
assert.ok(!JSON.stringify(quality).includes("indexPath"), "The public report must not leak stored file paths");

const unavailable = { VIEW_COUNTER: { ...env.VIEW_COUNTER, async put() { throw new Error("storage down"); } } };
assert.equal((await call("/subscribe", { method: "POST", body: JSON.stringify({ email: "fail@example.com" }) }, unavailable)).status, 503);
assert.equal((await call(`/subscribe/unsubscribe?token=${saved.unsubscribeToken}`)).status, 200);
assert.equal(await env.VIEW_COUNTER.get(records[0][0]), null);
records = [...values.entries()].filter(([key]) => key.startsWith("subscriber:"));
saved = JSON.parse(records[0][1]); saved.verified = false;
await env.VIEW_COUNTER.put(records[0][0], JSON.stringify(saved));
assert.equal((await signup("second@example.com")).status, 201);
assert.equal(JSON.parse(await env.VIEW_COUNTER.get(records[0][0])).verified, true);
const suggest = (body, ip) => call("/request-url", { method: "POST", headers: { "CF-Connecting-IP": ip }, body: JSON.stringify(body) });
assert.equal((await suggest({ url: "javascript:alert(1)", title: "bad" }, "1")).status, 400);
assert.equal((await suggest({ url: "https://spriteframe.com/png-to-sprite-sheet", title: "SpriteFrame", note: "Useful sprites" }, "2")).status, 201);
page = await (await call("/admin/data", auth)).json();
assert.equal(page.requests[0].title, "SpriteFrame");
assert.equal(page.requests[0].url, "https://spriteframe.com/png-to-sprite-sheet");
await env.VIEW_COUNTER.put("votes:popular:up", "2");
await env.VIEW_COUNTER.put("votes:popular:down", "10");
await env.VIEW_COUNTER.put("votes:liked:up", "9");
const stats = await (await call("/stats")).json();
assert.equal(stats.top[0].key, "popular", "Stats ranks by all votes, not net likes or upvotes alone");
const homepage = fs.readFileSync("components/home-page.tsx", "utf8");
// The four plain off-directory strips are marked off with dividers, and the
// URL request form still follows them.
assert.match(homepage, /<CoolAis[^\n]+\/>[\s\S]{0,200}<UrlRequest \/>/, "CoolAis is followed by the URL request form");
assert.match(homepage, /<CoolSites[^\n]+\/>[\s\S]*?<hr className="section-divider"[\s\S]*?<CoolApis/, "CoolSites and CoolApis are separated by a divider");
assert.match(homepage, /<CoolApis[^\n]+\/>[\s\S]*?<hr className="section-divider"[\s\S]*?<CoolApps/, "CoolApis and CoolApps are separated by a divider");
assert.match(homepage, /<CoolApps[^\n]+\/>[\s\S]*?<hr className="section-divider"[\s\S]*?<CoolAis/, "CoolApps and CoolAis are separated by a divider");
assert.equal((homepage.match(/<UrlRequest \/>/g) || []).length, 2);
// The form is on both faces now: the hero's submit button anchors to the copy
// the current page renders, and the phone drawer still links /explore's own.
assert.match(homepage, /href="#request-url"/, "The submit button anchors to the form the current page renders");
assert.match(homepage, /"\/explore#request-url"/, "The drawer still links the form on /explore");
// The landing page leads with its keys into every directory section, including
// the tag shelf, so the indexes stay reachable without opening the drawer.
// The editor's picks key is gone: that carousel is the landing page's alone.
for (const jump of ["sites", "cool-sites", "cool-apis", "cool-apps", "cool-ais"]) {
  assert.ok(homepage.includes(`{ href: "/explore#${jump}"`), `The landing page's keys include /explore#${jump}`);
}
// No-code AI tools has a key like the rest, and it is the one that leaves for
// the section's own page rather than a hash on this one.
assert.ok(homepage.includes('{ href: "/explore/no-code-ai-tools"'), "The landing page's keys include the no-code AI tools section");
assert.ok(homepage.includes('{ href: "/tags"'), "The landing page's keys include the tag index");
for (const url of ["https://dev.to/base31", "https://medium.com/@base31dotorg"]) assert.ok(homepage.includes(url));
const notifications = fs.readFileSync("components/directory-notifications.tsx", "utf8");
assert.ok(notifications.includes("result?.success !== true"), "Signup success requires the Worker storage acknowledgement");
assert.ok(notifications.includes("newsletter-status") && notifications.includes("No confirmation needed."));
assert.ok(fs.readFileSync("components/admin-community-sites.tsx", "utf8").includes('subscriber.verified ? "active" : "pending"'));
console.log("Subscription tests passed: immediate storage, deduplication, existing admin authorization and listing, unsubscribe, failures and private URL request queue.");

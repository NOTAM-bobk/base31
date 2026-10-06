import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";

const compiled = ts.transpileModule(fs.readFileSync("worker/src/discussion.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", compiled)(module, module.exports);
const { DiscussionRoom, validateMessage, handleDiscussion } = module.exports;
assert.equal(validateMessage(null), null);
assert.equal(validateMessage([]), null);
assert.equal(validateMessage({ name: "<admin>", body: "hello" }), null);
assert.equal(validateMessage({ name: "x".repeat(33), body: "hello" }), null);
assert.equal(validateMessage({ name: "Jane", body: "x".repeat(2001) }), null);
assert.equal(validateMessage({ name: "Jane", body: "hello", replyTo: "1" }), null);
assert.deepEqual(validateMessage({ name: " Jane ", body: " hello\nworld " }), { name: "Jane", body: "hello\nworld", replyTo: null });

const db = new DatabaseSync(":memory:");
const sql = { exec(query, ...bindings) {
  if (query.includes("CREATE TABLE")) { db.exec(query); return { toArray: () => [] }; }
  const statement = db.prepare(query);
  const rows = statement.all(...bindings);
  return { toArray: () => rows };
} };
const state = { storage: { sql, transactionSync(callback) {
  db.exec("BEGIN");
  try { const result = callback(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
} } };
const room = new DiscussionRoom(state, { DISCUSSION_MODERATOR_SECRET: "test-only-secret" });
const visitor = value => value.toString(16).padStart(64, "0");
const request = (body, who = 1, path = "/discussion", extra = {}) => new Request(`https://test.invalid${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-discussion-visitor": visitor(who), ...extra }, body: JSON.stringify(body) });
let response = await room.fetch(request({ name: "Jane", body: "<script>alert(1)</script>" }));
assert.equal(response.status, 201);
const root = (await response.json()).message;
assert.equal(root.body, "<script>alert(1)</script>", "Plain text stays literal; React escapes it, no HTML rendering");
assert.equal((await room.fetch(request({ name: "Jane", body: "too soon" }))).status, 429);
assert.equal((await room.fetch(request({ name: "Sam", body: "bad parent", replyTo: 999 }, 2))).status, 404);
response = await room.fetch(request({ name: "Sam", body: "Hello Jane", replyTo: root.id }, 2));
assert.equal(response.status, 201);
const reply = (await response.json()).message;
response = await room.fetch(request({ name: "Kim", body: "Hello Sam", replyTo: reply.id }, 3));
assert.equal(response.status, 201);
assert.equal((await response.json()).message.rootId, root.id);
const [first, second] = await Promise.all([room.fetch(request({ name: "A", body: "first" }, 4)), room.fetch(request({ name: "A", body: "second" }, 4))]);
assert.deepEqual([first.status, second.status].sort(), [201, 429]);
let page = await (await room.fetch(new Request("https://test.invalid/discussion"))).json();
assert.equal(page.threads.find(thread => thread.id === root.id).replies.length, 2);
assert.equal((await room.fetch(new Request("https://test.invalid/discussion?before=nope"))).status, 400);
assert.equal((await room.fetch(request(null, 5))).status, 400);
assert.equal((await room.fetch(request({ name: "A", body: "x".repeat(12000) }, 5))).status, 400);
assert.equal((await room.fetch(request({ id: root.id }, 6, "/discussion/moderate"))).status, 401);
assert.equal((await room.fetch(request({ id: reply.id }, 6, "/discussion/moderate", { "x-discussion-secret": "test-only-secret" }))).status, 200);
assert.equal((await room.fetch(request({ name: "A", body: "reply to removed", replyTo: reply.id }, 7))).status, 404);
assert.equal((await room.fetch(request({ id: root.id }, 6, "/discussion/moderate", { "x-discussion-secret": "test-only-secret" }))).status, 200);
assert.equal((await room.fetch(request({ name: "A", body: "closed thread", replyTo: 3 }, 7))).status, 409);
for (let index = 10; index < 35; index++) assert.equal((await room.fetch(request({ name: "Visitor", body: `Message ${index}` }, index))).status, 201);
page = await (await room.fetch(new Request("https://test.invalid/discussion"))).json();
assert.equal(page.threads.length, 20);
assert.ok(page.nextCursor);
const older = await (await room.fetch(new Request(`https://test.invalid/discussion?before=${page.nextCursor}`))).json();
assert.ok(older.threads.length > 0);
assert.ok(older.threads.every(thread => thread.id < page.nextCursor));
assert.equal((await handleDiscussion(new Request("https://test.invalid/discussion"), {})).status, 503);
assert.equal((await handleDiscussion(request({ id: 1 }, 1, "/discussion/moderate"), {})).status, 401);
assert.equal((await handleDiscussion(new Request("https://test.invalid/discussion/unknown"), {})).status, 404);
let trustedSignal = "";
await handleDiscussion(request({ name: "Jane", body: "hello" }), { DISCUSSION: { idFromName: name => name, get: () => ({ fetch: async req => { trustedSignal = req.headers.get("x-discussion-visitor"); return new Response("{}"); } }) } });
assert.match(trustedSignal, /^[a-f0-9]{64}$/);
assert.notEqual(trustedSignal, visitor(1), "The Worker replaces client-supplied rate-limit signals");
const homepage = fs.readFileSync("components/home-page.tsx", "utf8");
// The prose half of the landing page: the support hub sits directly under About
// the directory, and the board follows that pair.
assert.match(homepage, /<AboutSection \/>[\s\S]*?<SupportSection \/>/, "The support hub sits directly under About the directory");
assert.ok(homepage.indexOf("<SupportSection />") < homepage.indexOf("<DiscussionBoard />"), "The board follows the About and Support pair");
const board = fs.readFileSync("components/discussion-board.tsx", "utf8");
assert.ok(!board.includes("dangerouslySetInnerHTML"));

// Avatars: DiceBear draws a deterministic picture from the display name, and
// the name only ever travels as an encoded seed.
const avatarModule = { exports: {} };
new Function("module", "exports", ts.transpileModule(fs.readFileSync("lib/discussion-avatar.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(avatarModule, avatarModule.exports);
const { discussionAvatarUrl, DISCUSSION_AVATAR_STYLE } = avatarModule.exports;
assert.equal(DISCUSSION_AVATAR_STYLE, "bottts");
assert.equal(discussionAvatarUrl("Jane"), "https://api.dicebear.com/9.x/bottts/svg?seed=Jane");
assert.equal(discussionAvatarUrl("  A B & C  "), "https://api.dicebear.com/9.x/bottts/svg?seed=A%20B%20%26%20C");
assert.ok(discussionAvatarUrl("x?y=1").includes("seed=x%3Fy%3D1"), "The seed must be URL-encoded so a name cannot escape the query string");
assert.equal(discussionAvatarUrl("Jane"), discussionAvatarUrl("Jane"), "The same name must draw the same avatar");
assert.notEqual(discussionAvatarUrl("Jane"), discussionAvatarUrl("Sam"));
assert.ok(board.includes("discussionAvatarUrl(message.name)"), "Every message builds its avatar from the display name");
assert.ok(board.includes('loading="lazy"') && board.includes('alt=""'), "Avatars are decorative and lazy-loaded");
assert.ok(!board.includes("message.name.slice(0, 1)"), "The old initial-letter placeholder is gone");
db.close();
console.log("Discussion tests passed: persisted threads, nested replies, atomic rate limits, pagination, moderation and validation.");

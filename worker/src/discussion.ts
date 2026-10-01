// Minimal runtime interfaces, matching the existing Worker's dependency-free types.
interface Sql {
  exec<T = Record<string, unknown>>(query: string, ...bindings: (string | number | null)[]): { toArray(): T[] };
}
interface State { storage: { sql: Sql; transactionSync<T>(callback: () => T): T } }
export interface DiscussionBinding {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}
interface DiscussionEnv { DISCUSSION?: DiscussionBinding; DISCUSSION_MODERATOR_SECRET?: string }
type Message = { id: number; rootId: number | null; replyTo: number | null; name: string; body: string; createdAt: number; removed: number };
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

export function validateMessage(value: unknown): { name: string; body: string; replyTo: number | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || typeof input.body !== "string") return null;
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name || name.length > 32 || /[\x00-\x1f\x7f<>]/.test(name)) return null;
  if (!body || body.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body)) return null;
  if (input.replyTo != null && !positiveId(input.replyTo)) return null;
  return { name, body, replyTo: input.replyTo == null ? null : input.replyTo as number };
}

async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw new Error("Use JSON");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 12000) { await reader.cancel(); throw new Error("Body too large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function handleDiscussion(request: Request, env: DiscussionEnv): Promise<Response> {
  const url = new URL(request.url);
  if (!["/discussion", "/discussion/moderate"].includes(url.pathname)) return json({ error: "Not found" }, 404);
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (url.pathname.endsWith("/moderate") && (request.method !== "POST" || !env.DISCUSSION_MODERATOR_SECRET || request.headers.get("x-discussion-secret") !== env.DISCUSSION_MODERATOR_SECRET)) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!env.DISCUSSION) return json({ error: "Community chat is not deployed yet. Please check back soon." }, 503);
  try {
    const forwarded = new Request(request);
    forwarded.headers.delete("x-discussion-visitor");
    // Daily hash used only for rate limiting; raw IPs are never stored.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${new Date().toISOString().slice(0, 10)}:${ip}`));
    forwarded.headers.set("x-discussion-visitor", Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join(""));
    return await env.DISCUSSION.get(env.DISCUSSION.idFromName("base31-community-v1")).fetch(forwarded);
  } catch { return json({ error: "Community chat is temporarily unavailable. Try again shortly." }, 503); }
}

// A single SQLite-backed object serializes writes; it is separate from counter KV.
export class DiscussionRoom {
  private sql: Sql;
  constructor(private state: State, private env: DiscussionEnv) {
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, rootId INTEGER, replyTo INTEGER,
      name TEXT NOT NULL, body TEXT NOT NULL, createdAt INTEGER NOT NULL, removed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS message_roots ON messages(rootId, id);
    CREATE TABLE IF NOT EXISTS limits (visitor TEXT PRIMARY KEY, lastPost INTEGER NOT NULL, count INTEGER NOT NULL);`);
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/discussion" && request.method === "GET") {
      const raw = url.searchParams.get("before");
      const before = raw === null ? Number.MAX_SAFE_INTEGER : Number(raw);
      if (!positiveId(before)) return json({ error: "Invalid page cursor" }, 400);
      const roots = this.sql.exec<Message>("SELECT * FROM messages WHERE rootId IS NULL AND id < ? ORDER BY id DESC LIMIT 21", before).toArray();
      const page = roots.slice(0, 20);
      const threads = page.map(root => ({ ...root, replies: this.sql.exec<Message>("SELECT * FROM messages WHERE rootId = ? ORDER BY id LIMIT 100", root.id).toArray() }));
      return json({ threads, nextCursor: roots.length > 20 ? page[page.length - 1].id : null });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    let payload: unknown;
    try { payload = await readBody(request); } catch { return json({ error: "Send a JSON message smaller than 12 KB." }, 400); }
    if (url.pathname === "/discussion/moderate") {
      if (!this.env.DISCUSSION_MODERATOR_SECRET || request.headers.get("x-discussion-secret") !== this.env.DISCUSSION_MODERATOR_SECRET) return json({ error: "Unauthorized" }, 401);
      const id = (payload as { id?: unknown } | null)?.id;
      if (!positiveId(id)) return json({ error: "Invalid message ID" }, 400);
      if (!this.sql.exec("SELECT id FROM messages WHERE id = ?", id).toArray().length) return json({ error: "Message not found" }, 404);
      this.sql.exec("UPDATE messages SET name = 'Moderator', body = 'This message was removed.', removed = 1 WHERE id = ?", id);
      return json({ ok: true });
    }
    if (url.pathname !== "/discussion") return json({ error: "Not found" }, 404);
    const input = validateMessage(payload);
    if (!input) return json({ error: "Use a name of 1–32 characters and a message of 1–2,000 characters." }, 400);
    const visitor = request.headers.get("x-discussion-visitor");
    if (!visitor || !/^[a-f0-9]{64}$/.test(visitor)) return json({ error: "Missing visitor signal" }, 400);
    return this.state.storage.transactionSync(() => {
      let rootId: number | null = null;
      if (input.replyTo !== null) {
        const parent = this.sql.exec<Message>("SELECT * FROM messages WHERE id = ?", input.replyTo).toArray()[0];
        if (!parent || parent.removed) return json({ error: "That message is no longer available for replies." }, 404);
        rootId = parent.rootId ?? parent.id;
        const root = this.sql.exec<Message>("SELECT * FROM messages WHERE id = ?", rootId).toArray()[0];
        if (!root || root.removed) return json({ error: "This conversation is closed." }, 409);
        const total = this.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM messages WHERE rootId = ?", rootId).toArray()[0].count;
        if (total >= 100) return json({ error: "This thread is full. Start a new conversation." }, 409);
      }
      const now = Date.now();
      const limit = this.sql.exec<{ lastPost: number; count: number }>("SELECT lastPost, count FROM limits WHERE visitor = ?", visitor).toArray()[0];
      if (limit && (now - limit.lastPost < 15000 || limit.count >= 50)) return json({ error: "Please wait 15 seconds between messages. The daily limit is 50 per network." }, 429);
      this.sql.exec("DELETE FROM limits WHERE lastPost < ?", now - 86400000);
      this.sql.exec("INSERT INTO limits(visitor, lastPost, count) VALUES (?, ?, 1) ON CONFLICT(visitor) DO UPDATE SET lastPost = excluded.lastPost, count = count + 1", visitor, now);
      const message = this.sql.exec<Message>("INSERT INTO messages(rootId, replyTo, name, body, createdAt) VALUES (?, ?, ?, ?, ?) RETURNING *", rootId, input.replyTo, input.name, input.body, now).toArray()[0];
      return json({ message }, 201);
    });
  }
}

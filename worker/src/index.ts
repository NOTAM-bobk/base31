// Self-contained KV binding type so the root Next.js tsconfig can typecheck
// this file without needing @cloudflare/workers-types. Wrangler supplies the
// real KVNamespace binding at runtime.
interface KVBinding {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  VIEW_COUNTER: KVBinding;
  COUNTER_SECRET?: string;
}

// A visitor's choice: 1 = thumbs up, -1 = thumbs down, 0 = no vote.
type Vote = -1 | 0 | 1;

type VoteTotals = { up: number; down: number };

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-counter-secret",
  "Access-Control-Max-Age": "86400",
};

const MAX_KEY_LENGTH = 128;
const MAX_BULK_KEYS = 100;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, "Cache-Control": "no-store" },
  });

const isValidKey = (key: unknown): key is string =>
  typeof key === "string" && key.length > 0 && key.length <= MAX_KEY_LENGTH && /^[A-Za-z0-9._:-]+$/.test(key);

const readCount = async (env: Env, storageKey: string): Promise<number> => {
  const raw = await env.VIEW_COUNTER.get(storageKey);
  const value = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const voteKey = (key: string, side: "up" | "down") => `votes:${key}:${side}`;

const readVotes = async (env: Env, key: string): Promise<VoteTotals> => {
  const [up, down] = await Promise.all([
    readCount(env, voteKey(key, "up")),
    readCount(env, voteKey(key, "down")),
  ]);
  return { up, down };
};

// KV has no atomic increment, so every step is a read-modify-write. A vote only
// touches one counter per step and the client sends both its previous and its
// new choice, so switching (or clearing) a vote can never double-count. At the
// traffic this directory sees the remaining drift risk is irrelevant; move to a
// Durable Object or D1 if votes ever need to be exact under heavy concurrency.
const shiftVote = async (env: Env, key: string, side: "up" | "down", delta: 1 | -1): Promise<void> => {
  const storageKey = voteKey(key, side);
  const next = Math.max(0, (await readCount(env, storageKey)) + delta);
  await env.VIEW_COUNTER.put(storageKey, String(next));
};

const applyVote = async (env: Env, key: string, from: Vote, to: Vote): Promise<VoteTotals> => {
  if (from === to) return readVotes(env, key);
  if (from === 1) await shiftVote(env, key, "up", -1);
  if (from === -1) await shiftVote(env, key, "down", -1);
  if (to === 1) await shiftVote(env, key, "up", 1);
  if (to === -1) await shiftVote(env, key, "down", 1);
  return readVotes(env, key);
};

const parseVote = (value: unknown): Vote | null =>
  value === 1 || value === 0 || value === -1 ? (value as Vote) : null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

    const url = new URL(request.url);

    // Optional shared-secret mode: set the COUNTER_SECRET secret via
    // `wrangler secret put COUNTER_SECRET`; requests then send header
    // x-counter-secret. When unset, the endpoints stay open.
    if (env.COUNTER_SECRET) {
      const provided = request.headers.get("x-counter-secret");
      if (provided && provided !== env.COUNTER_SECRET) return json({ error: "Invalid secret" }, 401);
    }

    // GET /votes?keys=a,b,c → { votes: { a: { up, down }, b: … } }
    if (url.pathname === "/votes") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      const keys = (url.searchParams.get("keys") || "")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean)
        .slice(0, MAX_BULK_KEYS);
      if (keys.length === 0) return json({ error: "Missing required keys param" }, 400);
      if (keys.some((key) => !isValidKey(key))) return json({ error: "Invalid key" }, 400);
      try {
        const pairs = await Promise.all(keys.map(async (key) => ({ key, totals: await readVotes(env, key) })));
        const votes: Record<string, VoteTotals> = {};
        for (const pair of pairs) votes[pair.key] = pair.totals;
        return json({ votes });
      } catch {
        return json({ error: "Counter temporarily unavailable" }, 503);
      }
    }

    // POST /vote { key, from, to } → { key, up, down } for the new totals.
    if (url.pathname === "/vote") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      let payload: { key?: unknown; from?: unknown; to?: unknown };
      try {
        payload = (await request.json()) as typeof payload;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!isValidKey(payload.key)) return json({ error: "Invalid key" }, 400);
      const from = parseVote(payload.from);
      const to = parseVote(payload.to);
      if (from === null || to === null) return json({ error: "from and to must be 1, 0 or -1" }, 400);
      try {
        return json({ key: payload.key, ...(await applyVote(env, payload.key, from, to)) });
      } catch {
        return json({ error: "Counter temporarily unavailable" }, 503);
      }
    }

    // GET /?key=<name> → { views } (increments the view counter).
    if (url.pathname !== "/") return new Response("Not found", { status: 404 });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });

    const key = url.searchParams.get("key");
    if (!isValidKey(key)) return json({ error: "Invalid key" }, 400);

    let views: number;
    try {
      views = (await readCount(env, key)) + 1;
      await env.VIEW_COUNTER.put(key, String(views));
    } catch {
      return json({ error: "Counter temporarily unavailable" }, 503);
    }

    return json({ views });
  },
};

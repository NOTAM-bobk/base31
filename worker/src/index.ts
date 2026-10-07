import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";
import { handleDiscussion, type DiscussionBinding } from "./discussion";
import { compareVotes } from "../../lib/vote-ranking";
export { DiscussionRoom } from "./discussion";

// Self-contained KV binding type so the root Next.js tsconfig can typecheck
// this file without needing @cloudflare/workers-types. Wrangler supplies the
// real KVNamespace binding at runtime.
interface KVBinding {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export interface Env {
  VIEW_COUNTER: KVBinding;
  DISCUSSION?: DiscussionBinding;
  DISCUSSION_MODERATOR_SECRET?: string;
  COUNTER_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  // Optional: when set, every published community site is also committed to
  // the repository under public/sites/<slug>/. See mirrorSiteToRepo.
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  PUBLIC_WORKER_URL?: string;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

// A visitor's choice: 1 = thumbs up, -1 = thumbs down, 0 = no vote.
type Vote = -1 | 0 | 1;

// `fires` is not a third vote: it is how many fires on this key are still
// inside their 24 hours. Each one is worth `FIRE_VOTE_WEIGHT` votes to the one
// ranking rule the site and the Worker share (lib/vote-ranking.ts).
type VoteTotals = { up: number; down: number; fires?: number };

// A file published as part of a community site. `data` is stored separately
// (base64) so this record stays small enough to read on every request.
type PublishedFile = { path: string; type: string; size: number };

type PublishedSite = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  indexPath: string;
  files: PublishedFile[];
  createdAt: number;
  active?: boolean;
  lastCheckedAt?: number;
  healthFailures?: number;
};

type UrlRequest = {
  id: string;
  url: string;
  title: string;
  note: string;
  email?: string;
  createdAt: number;
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-counter-secret, x-discussion-secret",
  "Access-Control-Max-Age": "86400",
};

const MAX_KEY_LENGTH = 128;
const MAX_BULK_KEYS = 100;

// Fires. A fire is a boost with a clock on it: it is worth ten votes while it
// lasts and stops counting by itself after a day, so nothing anywhere stores a
// score that has to be decremented later. The storage is the list of the
// timestamps the fires were cast at, and every read drops the ones that have
// already expired — that is the whole of the expiry rule.
const FIRE_PREFIX = "fires:";
const FIRE_WINDOW_MS = 24 * 60 * 60 * 1000;
// A ceiling on how many timestamps one key stores in a day, so a single popular
// entry can never grow a KV value without bound. Past the ceiling the oldest
// fires fall off first, which is the right end to lose: they are the ones
// closest to expiring anyway.
const MAX_FIRES_PER_KEY = 400;
// The 24 hours plus two hours of slack, so KV only collects a value once every
// timestamp inside it has expired on its own duty rather than by TTL.
const FIRE_TTL_SECONDS = 26 * 60 * 60;

// Publishing limits. KV values cap out at 25 MiB, so these keep a single
// uploaded site comfortably inside one namespace.
const MAX_FILES = 40;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_LISTED_SITES = 500;
const SUBMIT_LIMIT = 3;
const SUBMIT_WINDOW_SECONDS = 60 * 60;
const RATE_PREFIX = "@rate:submit:";
const REQUEST_PREFIX = "request:url:";
const DMCA_PREFIX = "request:dmca:";
const REPORT_PREFIX = "request:report:";
const HEALTH_FAILURE_THRESHOLD = 2;
const SUBSCRIBER_PREFIX = "subscriber:";
const CONFIRM_PREFIX = "confirm:";
const UNSUBSCRIBE_PREFIX = "unsubscribe:";
const PUSH_PREFIX = "push:";
const emailKey = (emailHash: string) => `${SUBSCRIBER_PREFIX}${emailHash}`;
const pushKey = (endpointHash: string) => `${PUSH_PREFIX}${endpointHash}`;

// Metadata keys use `pub:` and file bodies use `pubfile:` — the prefixes do not
// overlap, so `list({ prefix: "pub:" })` returns metadata only.
const SITE_PREFIX = "pub:";
const FILE_PREFIX = "pubfile:";
const siteKey = (slug: string) => `${SITE_PREFIX}${slug}`;
const fileKey = (slug: string, path: string) => `${FILE_PREFIX}${slug}:${path}`;
const rateKey = (identity: string) => `${RATE_PREFIX}${identity}`;
const requestKey = (id: string) => `${REQUEST_PREFIX}${id}`;
const dmcaKey = (id: string) => `${DMCA_PREFIX}${id}`;
const reportKey = (id: string) => `${REPORT_PREFIX}${id}`;

// A copyright takedown request filed from dmca.base31.org. Stored in the same
// KV namespace as URL requests and surfaced in the admin inbox for review.
type DmcaRequest = {
  id: string;
  name: string;
  email: string;
  organization?: string;
  infringingUrl: string;
  originalWork: string;
  details: string;
  signature: string;
  createdAt: number;
};

// A bug report or feature idea filed from the community panel on the site. It
// is stored beside the URL requests and the takedown notices and listed in the
// same admin inbox, rather than emailed, so the queue lives in the site's own
// storage and cannot be lost to a mail provider.
type BugReport = {
  id: string;
  message: string;
  page: string;
  email?: string;
  createdAt: number;
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, "Cache-Control": "no-store" },
  });

const notFound = () => new Response("Not found", { status: 404, headers: CORS_HEADERS });

const adminAuthorized = (request: Request, env: Env): boolean => {
  const secret = env.COUNTER_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") && header.slice(7) === secret;
};

const requestIdentity = async (request: Request): Promise<string> => {
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
  const agent = request.headers.get("User-Agent") || "unknown";
  return (await sha256Hex(`${ip}|${agent}`)).slice(0, 32);
};

// `subject` is for the routes the Next.js server calls on a visitor's behalf:
// the connection those arrive on is the server, not the person, so the
// browser's address travels in a header and takes the request's place.
const takeSubmitSlot = async (request: Request, env: Env, subject?: string): Promise<number | null> => {
  const key = rateKey(subject ? await sha256Hex(`report:${subject}`) : await requestIdentity(request));
  const raw = await env.VIEW_COUNTER.get(key);
  const now = Math.floor(Date.now() / 1000);
  let state: { count: number; resetAt: number } = { count: 0, resetAt: now + SUBMIT_WINDOW_SECONDS };
  if (raw) {
    try { state = JSON.parse(raw) as typeof state; } catch {}
    if (!Number.isFinite(state.resetAt) || state.resetAt <= now) state = { count: 0, resetAt: now + SUBMIT_WINDOW_SECONDS };
  }
  if (state.count >= SUBMIT_LIMIT) return Math.max(1, state.resetAt - now);
  await env.VIEW_COUNTER.put(key, JSON.stringify({ count: state.count + 1, resetAt: state.resetAt }), { expirationTtl: Math.max(1, state.resetAt - now) });
  return null;
};

const validHttpUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const listPrefixRecords = async <T>(env: Env, prefix: string): Promise<T[]> => {
  const records: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await env.VIEW_COUNTER.list({ prefix, limit: 100, cursor });
    const raws = await Promise.all(page.keys.map((entry) => env.VIEW_COUNTER.get(entry.name)));
    for (const raw of raws) {
      if (!raw) continue;
      try { records.push(JSON.parse(raw) as T); } catch {}
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return records;
};

const isValidKey = (key: unknown): key is string =>
  typeof key === "string" && key.length > 0 && key.length <= MAX_KEY_LENGTH && /^[A-Za-z0-9._:-]+$/.test(key);

const isValidSlug = (slug: unknown): slug is string =>
  typeof slug === "string" && /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug);

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");

const sanitizePath = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const path = raw.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!path || path.length > 120) return null;
  if (path.includes("..")) return null;
  if (!/^[A-Za-z0-9._/-]+$/.test(path)) return null;
  return path;
};

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  webmanifest: "application/manifest+json",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
  wasm: "application/wasm",
  map: "application/json; charset=utf-8",
};

const contentTypeFor = (path: string): string => {
  const ext = path.includes(".") ? path.split(".").pop()!.toLowerCase() : "";
  return CONTENT_TYPES[ext] || "application/octet-stream";
};

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

const base64Size = (data: string): number => {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
};

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const readCount = async (env: Env, storageKey: string): Promise<number> => {
  const raw = await env.VIEW_COUNTER.get(storageKey);
  const value = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
};

// The directory's own view counter. The homepage increments this key on every
// visit and `/stats` reports it as the headline total.
const DIRECTORY_KEY = "base31-directory";

// Daily view history, which is what `/stats` draws its graph from. The "@"
// prefix sits outside `isValidKey`'s allowed characters on purpose: a visitor
// can never send `?key=@day:…`, so a day bucket can't be overwritten or
// collided with through the public counter endpoint.
const DAY_PREFIX = "@day:";
// Day buckets are tiny but there is one per day forever, so give them a
// lifetime slightly longer than a year of history.
const DAY_TTL_SECONDS = 400 * 24 * 60 * 60;
const STATS_MAX_DAYS = 90;
const dayKey = (date: string) => `${DAY_PREFIX}${date}`;
const utcDate = (offsetDays = 0) => new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);

// Records today's view. Deliberately best-effort: the graph is a nice-to-have
// and must never be the reason a view fails to count.
const bumpDay = async (env: Env): Promise<void> => {
  try {
    const key = dayKey(utcDate());
    const next = (await readCount(env, key)) + 1;
    await env.VIEW_COUNTER.put(key, String(next), { expirationTtl: DAY_TTL_SECONDS });
  } catch {
    // Ignored on purpose; see above.
  }
};

// Unique visitors — a count of distinct people, not page loads.
//
// The view counter above counts every request, so a reload, a second tab or a
// refresh from the same browser all add to it. This counter is the other half
// of the picture: a visitor is counted once. Each visitor is reduced to a
// one-way SHA-256 hash of the connection's address and the browser's
// User-Agent string — neither is ever stored, and the hash cannot be turned
// back into either — and that hash is written to KV as a mark. On a later
// request the mark is already there, so the total does not move. The mark
// expires after 400 days, so a visitor who comes back a year later counts once
// more rather than never again.
//
// Both keys carry the "@" prefix, which `isValidKey` rejects: a visitor cannot
// aim the public `?key=` endpoint at the total or at a visitor's mark.
const UNIQUE_KEY = "@unique";
const UNIQUE_PREFIX = "@uv:";
// One bucket per day, holding how many *different* people were seen that day —
// the unique half of the graph `/stats` draws. It shares the mark prefix's
// lifetime, because a day is only as complete as the marks behind it.
const UNIQUE_DAY_PREFIX = "@ud:";
const UNIQUE_TTL_SECONDS = 400 * 24 * 60 * 60;
const uniqueDayKey = (date: string) => `${UNIQUE_DAY_PREFIX}${date}`;

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

// Counts a visitor once and hands back the running total, so the caller can
// answer with it rather than making the page ask twice. Still best-effort in
// the same way as `bumpDay`: a KV failure returns `null` and the caller prints
// a dash, because this number must never be the reason a view fails to count.
//
// A first sighting moves two counters: the all-time total, and today's bucket
// of *people* (as opposed to `bumpDay`'s bucket of loads), which is what the
// second graph on /stats is drawn from.
const bumpUnique = async (env: Env, request: Request): Promise<number | null> => {
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const agent = request.headers.get("User-Agent") || "";
    const mark = `${UNIQUE_PREFIX}${(await sha256Hex(`${ip}|${agent}`)).slice(0, 32)}`;
    if (await env.VIEW_COUNTER.get(mark)) return await readCount(env, UNIQUE_KEY);
    await env.VIEW_COUNTER.put(mark, "1", { expirationTtl: UNIQUE_TTL_SECONDS });
    const next = (await readCount(env, UNIQUE_KEY)) + 1;
    await env.VIEW_COUNTER.put(UNIQUE_KEY, String(next));
    const today = uniqueDayKey(utcDate());
    const todayNext = (await readCount(env, today)) + 1;
    await env.VIEW_COUNTER.put(today, String(todayNext), { expirationTtl: UNIQUE_TTL_SECONDS });
    return next;
  } catch {
    // Ignored on purpose; see above.
    return null;
  }
};

const voteKey = (key: string, side: "up" | "down") => `votes:${key}:${side}`;

const fireStoreKey = (key: string) => `${FIRE_PREFIX}${key}`;

// The fires on one key that are still running, oldest first. Anything older
// than the window is discarded here rather than swept up on a schedule: this is
// the only place the expiry is expressed, so it cannot drift.
const readFires = async (env: Env, key: string, now: number): Promise<number[]> => {
  let stored: unknown;
  try {
    stored = JSON.parse((await env.VIEW_COUNTER.get(fireStoreKey(key))) || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];
  const cutoff = now - FIRE_WINDOW_MS;
  return stored.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > cutoff,
  );
};

// Records one fire and hands back the list that was written, so the caller
// answers with the count it just stored instead of reading the value again.
const addFire = async (env: Env, key: string, now: number): Promise<number[]> => {
  const next = [...(await readFires(env, key, now)), now].slice(-MAX_FIRES_PER_KEY);
  await env.VIEW_COUNTER.put(fireStoreKey(key), JSON.stringify(next), { expirationTtl: FIRE_TTL_SECONDS });
  return next;
};

const readVotes = async (env: Env, key: string, now: number = Date.now()): Promise<VoteTotals> => {
  const [up, down, fires] = await Promise.all([
    readCount(env, voteKey(key, "up")),
    readCount(env, voteKey(key, "down")),
    readFires(env, key, now),
  ]);
  return { up, down, fires: fires.length };
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

// Counting keys by prefix means paging the whole namespace. `/stats` runs these
// behind a five-minute cache and the namespace holds a few hundred keys, so the
// cost stays trivial.
const countPrefix = async (env: Env, prefix: string, keep?: (value: unknown) => boolean): Promise<number> => {
  let total = 0;
  let cursor: string | undefined;
  for (;;) {
    const page = await env.VIEW_COUNTER.list({ prefix, limit: 200, cursor });
    if (!keep) {
      total += page.keys.length;
    } else {
      for (const entry of page.keys) {
        const raw = await env.VIEW_COUNTER.get(entry.name);
        if (!raw) continue;
        try {
          if (keep(JSON.parse(raw) as unknown)) total += 1;
        } catch {
          // A record that no longer parses simply is not counted.
        }
      }
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return total;
};

// `votes:<key>:<side>` keys folded back into per-key totals. The key capture is
// greedy, so a key that itself contains a colon stays in one bucket.
const readAllVotes = async (env: Env): Promise<Record<string, VoteTotals>> => {
  const totals: Record<string, VoteTotals> = {};
  const now = Date.now();
  let cursor: string | undefined;
  for (;;) {
    const page = await env.VIEW_COUNTER.list({ prefix: "votes:", limit: 200, cursor });
    for (const entry of page.keys) {
      const match = /^votes:(.+):(up|down)$/.exec(entry.name);
      if (!match) continue;
      const value = await readCount(env, entry.name);
      if (value <= 0) continue;
      const side = match[2] as "up" | "down";
      const record = totals[match[1]] ?? (totals[match[1]] = { up: 0, down: 0 });
      record[side] = value;
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  // Fires are folded in the same pass, under the same key, so `/stats` ranks
  // entries the way the rest of the site does — a fire is worth ten votes there
  // too. A key with fires and no votes at all still gets a record, which is why
  // the empty object is created before the count is known to be non-zero.
  cursor = undefined;
  for (;;) {
    const page = await env.VIEW_COUNTER.list({ prefix: FIRE_PREFIX, limit: 200, cursor });
    for (const entry of page.keys) {
      const key = entry.name.slice(FIRE_PREFIX.length);
      if (!key) continue;
      const live = (await readFires(env, key, now)).length;
      if (live === 0) continue;
      const record = totals[key] ?? (totals[key] = { up: 0, down: 0 });
      record.fires = (record.fires ?? 0) + live;
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return totals;
};

// GET /stats?days=<n> → the visitor graph and the numbers behind /stats.
const handleStats = async (env: Env, url: URL): Promise<Response> => {
  const requested = parseInt(url.searchParams.get("days") || "30", 10);
  const days = Number.isFinite(requested) ? Math.min(Math.max(requested, 7), STATS_MAX_DAYS) : 30;

  try {
    const dates = Array.from({ length: days }, (_, index) => utcDate(days - 1 - index));
    const [counts, people] = await Promise.all([
      Promise.all(dates.map((date) => readCount(env, dayKey(date)))),
      Promise.all(dates.map((date) => readCount(env, uniqueDayKey(date)))),
    ]);
    const series = dates.map((date, index) => ({ date, views: counts[index] }));
    const uniqueSeries = dates.map((date, index) => ({ date, unique: people[index] }));

    const [views, unique, votes, sites, subscribers, pushDevices] = await Promise.all([
      readCount(env, DIRECTORY_KEY),
      readCount(env, UNIQUE_KEY),
      readAllVotes(env),
      countPrefix(env, SITE_PREFIX),
      countPrefix(env, SUBSCRIBER_PREFIX, (value) => !!(value as { verified?: boolean } | null)?.verified),
      countPrefix(env, PUSH_PREFIX),
    ]);

    const sum = (window: { views: number }[]) => window.reduce((running, point) => running + point.views, 0);
    const voteTotals = Object.values(votes).reduce<VoteTotals>(
      (running, totals) => ({
        up: running.up + totals.up,
        down: running.down + totals.down,
        fires: (running.fires ?? 0) + (totals.fires ?? 0),
      }),
      { up: 0, down: 0, fires: 0 },
    );
    const top = Object.entries(votes)
      .map(([key, totals]) => ({ key, ...totals }))
      .sort((a, b) => compareVotes(a, b) || a.key.localeCompare(b.key))
      .slice(0, 12);

    return new Response(
      JSON.stringify({
        generatedAt: Date.now(),
        days,
        series,
        uniqueSeries,
        totals: {
          views,
          unique,
          uniqueToday: uniqueSeries[uniqueSeries.length - 1]?.unique ?? 0,
          unique7: uniqueSeries.slice(-7).reduce((running, point) => running + point.unique, 0),
          last7: sum(series.slice(-7)),
          prev7: sum(series.slice(-14, -7)),
          sites,
          subscribers,
          pushDevices,
          votes: voteTotals,
        },
        top,
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...CORS_HEADERS,
          // The page caches for the same window, so the two agree.
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  } catch {
    return json({ error: "Counter temporarily unavailable" }, 503);
  }
};

const validEmail = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 254 || /[\s<>(),;:\\[\]]/.test(value)) return false;
  const at = value.lastIndexOf("@");
  const domain = value.slice(at + 1);
  return at > 0 && value.indexOf("@") === at && at < 65 && domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
};

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const digest = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
const vapidConfig = (env: Env): VapidKeys => ({ subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY });
const pushConfigured = (env: Env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);

const sendResend = async (env: Env, message: { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }) => {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, ...message }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const pageResponse = (title: string, message: string, action: string, href: string) => new Response(
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} — base31.org</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#ededed;font:16px/1.6 system-ui,sans-serif}.card{width:min(90%,440px);padding:32px;border:1px solid #303630;border-radius:20px;background:#0d100e}h1{font-size:26px;letter-spacing:-.04em}p{color:#b8c2ba}a{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:9px;background:#46e891;color:#07110b;text-decoration:none;font-weight:600}</style><main class="card"><p>BASE31 / DIRECTORY</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(href)}">${escapeHtml(action)}</a></main></html>`,
  { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...CORS_HEADERS } },
);

const allowedPushEndpoint = (endpoint: string) => {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (
      host === "fcm.googleapis.com" || host.endsWith(".googleapis.com") || host === "web.push.apple.com" ||
      host === "updates.push.services.mozilla.com" || host.endsWith(".push.services.mozilla.com") || host.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
};

const publicSite = (site: PublishedSite, origin: string) => ({
  slug: site.slug,
  title: site.title,
  description: site.description,
  tags: site.tags,
  url: `${origin}/s/${site.slug}/`,
  createdAt: site.createdAt,
  active: site.active !== false,
});

// A check older than this reads as "overdue" on the quality report. The
// scheduled handler runs daily, so anything past a week has been missed.
const QUALITY_STALE_DAYS = 7;

// GET /quality → the health-check report behind /quality-report on the site.
// Public and read-only: the same fields the admin panel shows for community
// sites — when each was last checked, and how many checks have failed since it
// last answered — plus a summary so the page does not have to count.
const handleQuality = async (env: Env, url: URL): Promise<Response> => {
  try {
    const sites = await listSites(env, true);
    const now = Date.now();
    const checks = sites
      .map((site) => ({
        ...publicSite(site, url.origin),
        lastCheckedAt: site.lastCheckedAt ?? null,
        healthFailures: site.healthFailures ?? 0,
      }))
      .sort((a, b) => (a.lastCheckedAt ?? 0) - (b.lastCheckedAt ?? 0) || a.title.localeCompare(b.title));
    const checked = checks.filter((site) => site.lastCheckedAt !== null);
    return new Response(
      JSON.stringify({
        generatedAt: now,
        summary: {
          sites: checks.length,
          checked: checked.length,
          neverChecked: checks.length - checked.length,
          failing: checks.filter((site) => !site.active || site.healthFailures > 0).length,
          hidden: checks.filter((site) => !site.active).length,
          stale: checked.filter((site) => now - (site.lastCheckedAt as number) > QUALITY_STALE_DAYS * 86400000).length,
          lastCheckedAt: checked.reduce((latest, site) => Math.max(latest, site.lastCheckedAt as number), 0) || null,
          staleAfterDays: QUALITY_STALE_DAYS,
        },
        checks,
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...CORS_HEADERS,
          // The page refreshes on its own window; this matches it.
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  } catch {
    return json({ error: "Quality report temporarily unavailable" }, 503);
  }
};

const listSites = async (env: Env, includeInactive = false): Promise<PublishedSite[]> => {
  const sites: PublishedSite[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await env.VIEW_COUNTER.list({ prefix: SITE_PREFIX, limit: 100, cursor });
    const raws = await Promise.all(page.keys.map((entry) => env.VIEW_COUNTER.get(entry.name)));
    for (const raw of raws) {
      if (!raw) continue;
      try {
        const site = JSON.parse(raw) as PublishedSite;
        if (includeInactive || site.active !== false) sites.push(site);
      } catch {
        // Skip anything that was not written by this worker.
      }
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
    if (sites.length >= MAX_LISTED_SITES) break;
  }
  return sites.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, MAX_LISTED_SITES);
};

const deleteSite = async (env: Env, slug: string): Promise<boolean> => {
  const raw = await env.VIEW_COUNTER.get(siteKey(slug));
  if (!raw) return false;
  const site = JSON.parse(raw) as PublishedSite;
  await Promise.all([
    env.VIEW_COUNTER.delete(siteKey(slug)),
    ...site.files.map((file) => env.VIEW_COUNTER.delete(fileKey(slug, file.path))),
  ]);
  return true;
};

const checkSiteHealth = async (env: Env, site: PublishedSite): Promise<void> => {
  const raw = await env.VIEW_COUNTER.get(fileKey(site.slug, site.indexPath));
  const healthy = !!raw && raw.length > 0;
  const failures = healthy ? 0 : (site.healthFailures ?? 0) + 1;
  const updated: PublishedSite = {
    ...site,
    active: healthy || failures < HEALTH_FAILURE_THRESHOLD,
    healthFailures: failures,
    lastCheckedAt: Date.now(),
  };
  await env.VIEW_COUNTER.put(siteKey(site.slug), JSON.stringify(updated));
};

const runHealthChecks = async (env: Env): Promise<void> => {
  const sites = await listSites(env, true);
  for (const site of sites) {
    try { await checkSiteHealth(env, site); } catch {}
  }
};

// Community uploads are mirrored into the repository, in the same
// public/sites/<slug>/ folder the hand-built sites live in, so a published site
// is backed by git instead of only by KV. This is optional and best-effort:
// with no GITHUB_TOKEN the upload still publishes.
const DEFAULT_GITHUB_REPO = "NOTAM-bobk/base31";
const DEFAULT_GITHUB_BRANCH = "main";

/** One file, created or replaced, through the GitHub Contents API. */
const putRepoFile = async (env: Env, path: string, base64: string, message: string): Promise<boolean> => {
  const branch = env.GITHUB_BRANCH || DEFAULT_GITHUB_BRANCH;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "base31-directory-worker",
    "Content-Type": "application/json",
  };
  const endpoint = `https://api.github.com/repos/${env.GITHUB_REPO || DEFAULT_GITHUB_REPO}/contents/${path}`;

  // Replacing a file needs the current blob's sha; a fresh slug has none and is
  // created instead.
  let sha: string | undefined;
  const existing = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
  if (existing.ok) sha = ((await existing.json()) as { sha?: string }).sha;

  const response = await fetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message, content: base64, branch, ...(sha ? { sha } : {}) }),
  });
  return response.ok;
};

/**
 * Commits every file of a published site to the repository. The bodies are the
 * same base64 strings KV holds, in the same order as `site.files`.
 */
const mirrorSiteToRepo = async (env: Env, site: PublishedSite, bodies: { key: string; data: string }[]) => {
  if (!env.GITHUB_TOKEN) return;
  const message = `Add community site: ${site.title} (${site.slug})`;
  for (const [index, file] of site.files.entries()) {
    const body = bodies[index];
    if (!body) continue;
    try {
      await putRepoFile(env, `public/sites/${site.slug}/${file.path}`, body.data, message);
    } catch {
      // A failed file must not fail the upload: the site is already live.
    }
  }
};

// POST /submit — validates and stores a community-published site.
const handleSubmit = async (request: Request, env: Env, origin: string, context: WorkerContext): Promise<Response> => {
  const retryAfter = await takeSubmitSlot(request, env);
  if (retryAfter !== null) {
    return new Response(JSON.stringify({ error: "Too many site submissions. Please try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json; charset=utf-8", "Retry-After": String(retryAfter), ...CORS_HEADERS },
    });
  }
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 80) : "";
  if (!title) return json({ error: "A title is required" }, 400);

  const description = typeof payload.description === "string" ? payload.description.trim().slice(0, 300) : "";
  const authorEmail = payload.email == null || payload.email === "" ? null : payload.email;
  if (authorEmail !== null && !validEmail(authorEmail)) return json({ error: "Enter a valid email address for your publication notice." }, 400);

  const tags = Array.isArray(payload.tags)
    ? payload.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => slugify(tag))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const requested = typeof payload.slug === "string" && payload.slug.trim() ? payload.slug.trim() : title;
  const slug = slugify(requested);
  if (!isValidSlug(slug)) {
    return json({ error: "Couldn't build a web address from that title — try a different one." }, 400);
  }

  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    return json({ error: "Add at least one file, including an index.html" }, 400);
  }
  if (payload.files.length > MAX_FILES) {
    return json({ error: `Too many files (max ${MAX_FILES})` }, 400);
  }

  const files: PublishedFile[] = [];
  const bodies: { key: string; data: string }[] = [];
  const seen = new Set<string>();
  let total = 0;

  for (const entry of payload.files as Record<string, unknown>[]) {
    const path = sanitizePath(entry?.path);
    if (!path) return json({ error: "One of the file paths isn't allowed." }, 400);
    if (seen.has(path)) return json({ error: `Duplicate file: ${path}` }, 400);
    seen.add(path);

    const data = typeof entry?.data === "string" ? entry.data : "";
    if (!data || !BASE64.test(data)) return json({ error: `Couldn't read ${path}` }, 400);

    const size = base64Size(data);
    if (size > MAX_FILE_BYTES) return json({ error: `${path} is larger than 2 MB` }, 413);
    total += size;
    if (total > MAX_TOTAL_BYTES) return json({ error: "This upload is larger than 8 MB" }, 413);

    files.push({ path, type: contentTypeFor(path), size });
    bodies.push({ key: fileKey(slug, path), data });
  }

  const html = files.filter((file) => /\.html?$/i.test(file.path));
  if (html.length === 0) return json({ error: "Include an HTML file (like index.html)" }, 400);
  const indexPath = files.some((file) => file.path === "index.html") ? "index.html" : html[0].path;

  try {
    if (await env.VIEW_COUNTER.get(siteKey(slug))) {
      return json({ error: `The address /s/${slug}/ is already taken — pick another.` }, 409);
    }

    const site: PublishedSite = { slug, title, description, tags, indexPath, files, createdAt: Date.now(), active: true, healthFailures: 0 };
    await env.VIEW_COUNTER.put(siteKey(slug), JSON.stringify(site));
    for (const body of bodies) await env.VIEW_COUNTER.put(body.key, body.data);
    const published = publicSite(site, origin);
    context.waitUntil(mirrorSiteToRepo(env, site, bodies));
    context.waitUntil(notifyPublished(env, site, published.url, authorEmail));
    return json({ site: published }, 201);
  } catch {
    return json({ error: "Couldn't publish that right now — try again." }, 503);
  }
};

const handleUrlRequest = async (request: Request, env: Env): Promise<Response> => {
  const retryAfter = await takeSubmitSlot(request, env);
  if (retryAfter !== null) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json; charset=utf-8", "Retry-After": String(retryAfter), ...CORS_HEADERS },
    });
  }
  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; } catch { return json({ error: "Invalid JSON body" }, 400); }
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  if (!validHttpUrl(url)) return json({ error: "Enter a valid website URL." }, 400);
  const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 100) : "";
  if (!title) return json({ error: "Tell us the site's name." }, 400);
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 500) : "";
  const email = payload.email == null || payload.email === "" ? undefined : payload.email;
  if (email !== undefined && !validEmail(email)) return json({ error: "Enter a valid email address." }, 400);
  const id = `${Date.now().toString(36)}-${randomToken().slice(0, 12)}`;
  const record: UrlRequest = { id, url, title, note, ...(email ? { email } : {}), createdAt: Date.now() };
  try {
    await env.VIEW_COUNTER.put(requestKey(id), JSON.stringify(record));
    return json({ success: true }, 201);
  } catch {
    return json({ error: "Could not save that request right now." }, 503);
  }
};

// POST /dmca — a copyright takedown request from dmca.base31.org. Rate limited
// like URL requests; saved to KV so it appears in the admin inbox.
const handleDmcaRequest = async (request: Request, env: Env): Promise<Response> => {
  const retryAfter = await takeSubmitSlot(request, env);
  if (retryAfter !== null) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json; charset=utf-8", "Retry-After": String(retryAfter), ...CORS_HEADERS },
    });
  }
  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; } catch { return json({ error: "Invalid JSON body" }, 400); }
  const text = (key: string, max: number) => typeof payload[key] === "string" ? (payload[key] as string).trim().slice(0, max) : "";
  const name = text("name", 120);
  const email = text("email", 254);
  const organization = text("organization", 160);
  const infringingUrl = text("infringingUrl", 2000);
  const originalWork = text("originalWork", 1000);
  const details = text("details", 2000);
  const signature = text("signature", 120);
  if (!name) return json({ error: "Enter your full name." }, 400);
  if (!validEmail(email)) return json({ error: "Enter a valid email address." }, 400);
  if (!validHttpUrl(infringingUrl)) return json({ error: "Enter the full URL of the material to remove." }, 400);
  if (!originalWork) return json({ error: "Describe the original copyrighted work." }, 400);
  if (payload.goodFaith !== true || payload.accurate !== true) return json({ error: "Please confirm both statements." }, 400);
  if (!signature) return json({ error: "Type your full name as a signature." }, 400);
  const id = `${Date.now().toString(36)}-${randomToken().slice(0, 12)}`;
  const record: DmcaRequest = { id, name, email, ...(organization ? { organization } : {}), infringingUrl, originalWork, details, signature, createdAt: Date.now() };
  try {
    await env.VIEW_COUNTER.put(dmcaKey(id), JSON.stringify(record));
    return json({ success: true, id }, 201);
  } catch {
    return json({ error: "Could not save that request right now." }, 503);
  }
};

// POST /report — a bug report or feature idea from the site's community panel.
// Called by the Next.js route, which has already checked its own limits; this
// keeps the same throttle as the other public write routes and saves the report
// to KV so it appears in the admin inbox. Nothing is emailed and nothing is
// published.
const handleBugReport = async (request: Request, env: Env): Promise<Response> => {
  const subject = request.headers.get("x-report-origin")?.trim();
  const retryAfter = await takeSubmitSlot(request, env, subject || undefined);
  if (retryAfter !== null) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json; charset=utf-8", "Retry-After": String(retryAfter), ...CORS_HEADERS },
    });
  }
  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; } catch { return json({ error: "Invalid JSON body" }, 400); }
  const message = typeof payload.message === "string" ? payload.message.trim().slice(0, 4000) : "";
  if (message.length < 10) return json({ error: "Please describe the issue in 10–4,000 characters." }, 400);
  const page = validHttpUrl(payload.page) ? (payload.page as string).slice(0, 2048) : "https://base31.org/";
  const email = payload.email == null || payload.email === "" ? undefined : payload.email;
  if (email !== undefined && !validEmail(email)) return json({ error: "Enter a valid email address." }, 400);
  const id = `${Date.now().toString(36)}-${randomToken().slice(0, 12)}`;
  const record: BugReport = { id, message, page, ...(email ? { email } : {}), createdAt: Date.now() };
  try {
    await env.VIEW_COUNTER.put(reportKey(id), JSON.stringify(record));
    return json({ success: true }, 201);
  } catch {
    return json({ error: "Could not save that report right now." }, 503);
  }
};

// GET /s/<slug>/<path> — serves a published site's files from KV.
const handleServe = async (url: URL, env: Env): Promise<Response> => {
  const rest = url.pathname.slice("/s/".length);
  const slash = rest.indexOf("/");
  const slug = slash === -1 ? rest : rest.slice(0, slash);

  if (!isValidSlug(slug)) return notFound();
  // Bare /s/<slug> has to carry a trailing slash or the site's relative asset
  // links would resolve a level too high.
  if (slash === -1) return new Response(null, { status: 308, headers: { Location: `/s/${slug}/` } });

  let site: PublishedSite;
  try {
    const raw = await env.VIEW_COUNTER.get(siteKey(slug));
    if (!raw) return notFound();
    site = JSON.parse(raw) as PublishedSite;
  } catch {
    return notFound();
  }
  if (site.active === false) return notFound();

  const rawPath = slash === -1 ? "" : rest.slice(slash + 1);
  let requested: string;
  try {
    requested = decodeURIComponent(rawPath);
  } catch {
    return notFound();
  }
  if (requested === "" || requested.endsWith("/")) requested = `${requested}${site.indexPath}`;

  const file = site.files.find((entry) => entry.path === requested);
  if (!file) return notFound();

  try {
    const data = await env.VIEW_COUNTER.get(fileKey(slug, file.path));
    if (data === null) return notFound();
    return new Response(decodeBase64(data), {
      status: 200,
      headers: {
        "Content-Type": file.type,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=300",
        ...CORS_HEADERS,
      },
    });
  } catch {
    return new Response("Site temporarily unavailable", { status: 503, headers: CORS_HEADERS });
  }
};

const handleEmailSubscribe = async (request: Request, env: Env): Promise<Response> => {
  let payload: { email?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: "Request too large." }, 413);
    payload = JSON.parse(raw) as typeof payload;
  } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (!payload || !validEmail(payload.email)) return json({ error: "Enter a valid email address." }, 400);
  const email = payload.email.trim().toLowerCase();
  const hash = await digest(email);
  const key = emailKey(hash);
  try {
    const existing = await env.VIEW_COUNTER.get(key);
    if (existing) {
      const saved = JSON.parse(existing) as { verified?: boolean; unsubscribeHash?: string };
      if (saved.verified) return json({ success: true, alreadySubscribed: true });
      if (saved.unsubscribeHash) await env.VIEW_COUNTER.delete(`${UNSUBSCRIBE_PREFIX}${saved.unsubscribeHash}`);
    }
    const unsubscribeToken = randomToken();
    const unsubscribeHash = await digest(unsubscribeToken);
    await env.VIEW_COUNTER.put(`${UNSUBSCRIBE_PREFIX}${unsubscribeHash}`, hash);
    // Keep the legacy field for publication delivery; it now means active,
    // not that ownership of the email address was verified by confirmation.
    await env.VIEW_COUNTER.put(key, JSON.stringify({ email, verified: true, subscribedAt: Date.now(), consent: "signup-form", unsubscribeHash, unsubscribeToken }));
    return json({ success: true }, 201);
  } catch {
    return json({ error: "Could not save your subscription right now." }, 503);
  }
};

const handleConfirmSubscription = async (url: URL, env: Env): Promise<Response> => {
  const token = url.searchParams.get("token") || "";
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return pageResponse("Link expired", "This confirmation link is invalid or has expired. Please sign up again.", "Visit base31.org", "https://base31.org/#updates");
  try {
    const hash = await env.VIEW_COUNTER.get(`${CONFIRM_PREFIX}${token}`);
    if (!hash) return pageResponse("Link expired", "This confirmation link is invalid or has expired. Please sign up again.", "Visit base31.org", "https://base31.org/#updates");
    const raw = await env.VIEW_COUNTER.get(emailKey(hash));
    if (!raw) return pageResponse("Link expired", "This email subscription is no longer available. Please sign up again.", "Visit base31.org", "https://base31.org/#updates");
    const subscriber = JSON.parse(raw) as { email: string; verified: boolean; unsubscribeHash?: string };
    subscriber.verified = true;
    await env.VIEW_COUNTER.put(emailKey(hash), JSON.stringify(subscriber));
    await env.VIEW_COUNTER.delete(`${CONFIRM_PREFIX}${token}`);
    return pageResponse("You’re on the list.", "We’ll email you when a new community site is published. Every update includes an unsubscribe link.", "Back to the directory", "https://base31.org/");
  } catch {
    return pageResponse("Couldn’t confirm yet", "Please try that confirmation link again in a moment.", "Visit base31.org", "https://base31.org/#updates");
  }
};

const handleUnsubscribe = async (url: URL, env: Env): Promise<Response> => {
  const token = url.searchParams.get("token") || "";
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return pageResponse("Unsubscribe link invalid", "This link is invalid. You can close this page.", "Visit base31.org", "https://base31.org/");
  try {
    const tokenHash = await digest(token);
    const emailHash = await env.VIEW_COUNTER.get(`${UNSUBSCRIBE_PREFIX}${tokenHash}`);
    if (emailHash) {
      const key = emailKey(emailHash);
      const raw = await env.VIEW_COUNTER.get(key);
      if (raw) {
        const subscriber = JSON.parse(raw) as { unsubscribeHash?: string };
        if (subscriber.unsubscribeHash === tokenHash) await env.VIEW_COUNTER.delete(key);
      }
      await env.VIEW_COUNTER.delete(`${UNSUBSCRIBE_PREFIX}${tokenHash}`);
    }
    return pageResponse("You’re unsubscribed.", "You won’t receive more site-update emails at this address.", "Back to base31", "https://base31.org/");
  } catch {
    return pageResponse("Couldn’t unsubscribe yet", "Please try this link again in a moment.", "Visit base31.org", "https://base31.org/");
  }
};

const handlePushSubscribe = async (request: Request, env: Env): Promise<Response> => {
  if (!pushConfigured(env)) return json({ error: "Browser notifications are not configured yet." }, 503);
  let subscription: PushSubscription;
  try { subscription = await request.json() as PushSubscription; } catch { return json({ error: "Invalid subscription." }, 400); }
  if (!subscription || !allowedPushEndpoint(subscription.endpoint) || typeof subscription.keys?.auth !== "string" || typeof subscription.keys?.p256dh !== "string" || subscription.keys.auth.length > 200 || subscription.keys.p256dh.length > 200) {
    return json({ error: "Invalid browser notification subscription." }, 400);
  }
  try {
    const hash = await digest(subscription.endpoint);
    await env.VIEW_COUNTER.put(pushKey(hash), JSON.stringify(subscription));
    return json({ success: true }, 201);
  } catch {
    return json({ error: "Could not save this browser subscription." }, 503);
  }
};

const notifyPublished = async (env: Env, site: PublishedSite, siteUrl: string, authorEmail: string | null) => {
  if (authorEmail && env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
    const safeTitle = escapeHtml(site.title);
    await sendResend(env, {
      to: authorEmail,
      subject: `Your site “${site.title}” is live on base31`,
      text: `Your site is live: ${siteUrl}\n\nThanks for sharing it with base31.`,
      html: `<p>Your site <strong>${safeTitle}</strong> is live in the base31 directory.</p><p><a href="${escapeHtml(siteUrl)}">Visit your published site</a></p><p>Thanks for sharing it with base31.</p>`,
    });
  }

  const jobs: Promise<unknown>[] = [];
  if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
    try {
      let cursor: string | undefined;
      for (;;) {
        const page = await env.VIEW_COUNTER.list({ prefix: SUBSCRIBER_PREFIX, limit: 100, cursor });
        for (const entry of page.keys) {
          const raw = await env.VIEW_COUNTER.get(entry.name);
          if (!raw) continue;
          const subscriber = JSON.parse(raw) as { email: string; verified: boolean; unsubscribeHash?: string; unsubscribeToken?: string };
          if (!subscriber.verified || !validEmail(subscriber.email) || !subscriber.unsubscribeHash || !subscriber.unsubscribeToken) continue;
          const unsubscribeUrl = `${new URL(siteUrl).origin}/subscribe/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken)}`;
          jobs.push(sendResend(env, {
            to: subscriber.email,
            subject: `New on base31: ${site.title}`,
            text: `${site.title} is live in the base31 directory.\n\n${siteUrl}\n\nUnsubscribe: ${unsubscribeUrl}`,
            html: `<p>A new community site is live on base31.</p><p><a href="${escapeHtml(siteUrl)}">${escapeHtml(site.title)}</a></p><p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from site updates</a></p>`,
          }));
          if (jobs.length >= 20) await Promise.all(jobs.splice(0));
        }
        if (page.list_complete || !page.cursor) break;
        cursor = page.cursor;
      }
      if (jobs.length) await Promise.all(jobs);
    } catch {
      // An email delivery outage must never roll back an already published site.
    }
  }

  if (pushConfigured(env)) {
    try {
      let cursor: string | undefined;
      let jobs: Promise<unknown>[] = [];
      for (;;) {
        const page = await env.VIEW_COUNTER.list({ prefix: PUSH_PREFIX, limit: 100, cursor });
        for (const entry of page.keys) {
          const raw = await env.VIEW_COUNTER.get(entry.name);
          if (!raw) continue;
          let subscription: PushSubscription;
          try { subscription = JSON.parse(raw) as PushSubscription; } catch { continue; }
          if (!allowedPushEndpoint(subscription.endpoint)) continue;
          jobs.push(sendPush(env, subscription, { title: "A new site is live on base31", body: `${site.title} just joined the directory.`, url: siteUrl, tag: `base31-site-${site.slug}` }));
          if (jobs.length >= 20) { await Promise.all(jobs); jobs = []; }
        }
        if (page.list_complete || !page.cursor) break;
        cursor = page.cursor;
      }
      if (jobs.length) await Promise.all(jobs);
    } catch {
      // Notification delivery is best effort; publishing is authoritative.
    }
  }
};

const sendPush = async (env: Env, subscription: PushSubscription, data: { title: string; body: string; url: string; tag: string }) => {
  try {
    const push = await buildPushPayload({ data, options: { ttl: 86400, urgency: "normal" } }, subscription, vapidConfig(env));
    const response = await fetch(subscription.endpoint, push);
    if (response.status === 404 || response.status === 410) {
      await env.VIEW_COUNTER.delete(pushKey(await digest(subscription.endpoint)));
    }
  } catch {
    // Retry on a later publication if this push service is temporarily down.
  }
};

export default {
  async fetch(request: Request, env: Env, context: WorkerContext): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

    const url = new URL(request.url);

    // Optional shared-secret mode: set the COUNTER_SECRET secret via
    // `wrangler secret put COUNTER_SECRET`; requests then send header
    // x-counter-secret. When unset, the endpoints stay open.
    if (env.COUNTER_SECRET) {
      const provided = request.headers.get("x-counter-secret");
      if (provided && provided !== env.COUNTER_SECRET) return json({ error: "Invalid secret" }, 401);
    }

    if (url.pathname === "/discussion" || url.pathname.startsWith("/discussion/")) return handleDiscussion(request, env);

    // GET /votes?keys=a,b,c → { votes: { a: { up, down, fires }, b: … } }
    // `fires` is how many of that key's fires are still inside their 24 hours.
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

    // POST /vote { key, from, to } → { key, up, down, fires } for the new totals.
    // The fire count comes back with the vote totals so a client never has to
    // ask again for the half it did not touch.
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

    // POST /fire { key } → { key, up, down, fires } for the new totals.
    //
    // A fire is a boost, not a third vote: it is worth FIRE_VOTE_WEIGHT votes
    // (lib/vote-ranking.ts) for as long as it lasts and then stops counting by
    // itself. There is deliberately no "unfire": the gesture has a clock on it,
    // so the way to take it back is to wait for it. The visitor's own 24-hour
    // limit lives in their browser (lib/fires.ts) — this end only refuses a key
    // it does not recognise, because a per-visitor limit needs an identity and
    // the directory does not keep one.
    if (url.pathname === "/fire") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      let payload: { key?: unknown };
      try {
        payload = (await request.json()) as typeof payload;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!isValidKey(payload.key)) return json({ error: "Invalid key" }, 400);
      const key = payload.key;
      try {
        const now = Date.now();
        const live = await addFire(env, key, now);
        const [up, down] = await Promise.all([
          readCount(env, voteKey(key, "up")),
          readCount(env, voteKey(key, "down")),
        ]);
        return json({ key, up, down, fires: live.length });
      } catch {
        return json({ error: "Counter temporarily unavailable" }, 503);
      }
    }

    // GET /sites → the community-published sites, newest first.
    // Note: Cloudflare KV list is eventually consistent, so a site published
    // seconds ago may not appear here yet. The directory inserts the returned
    // site optimistically so its author sees it immediately.
    if (url.pathname === "/sites") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      try {
        const sites = await listSites(env);
        return json({ sites: sites.map((site) => publicSite(site, url.origin)) });
      } catch {
        return json({ error: "Directory temporarily unavailable" }, 503);
      }
    }

    // GET /quality → the health-check report behind /quality-report.
    if (url.pathname === "/quality") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      return handleQuality(env, url);
    }

    if (url.pathname === "/admin/data" || url.pathname === "/admin/sites" || url.pathname.startsWith("/admin/sites/") || url.pathname.startsWith("/admin/requests/") || url.pathname.startsWith("/admin/dmca/") || url.pathname.startsWith("/admin/reports/")) {
      if (!adminAuthorized(request, env)) return json({ error: "Admin authentication required." }, 401);
      if (url.pathname === "/admin/data") {
        if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
        try {
          const [sites, requests, subscribers, dmca, reports] = await Promise.all([
            listSites(env, true),
            listPrefixRecords<UrlRequest>(env, REQUEST_PREFIX),
            listPrefixRecords<{ email: string; verified: boolean }>(env, SUBSCRIBER_PREFIX),
            listPrefixRecords<DmcaRequest>(env, DMCA_PREFIX),
            listPrefixRecords<BugReport>(env, REPORT_PREFIX),
          ]);
          return json({
            sites: sites.map((site) => ({ ...publicSite(site, url.origin), lastCheckedAt: site.lastCheckedAt ?? null, healthFailures: site.healthFailures ?? 0 })),
            requests: requests.sort((a, b) => b.createdAt - a.createdAt),
            dmca: dmca.sort((a, b) => b.createdAt - a.createdAt),
            reports: reports.sort((a, b) => b.createdAt - a.createdAt),
            subscribers: subscribers.filter((subscriber) => validEmail(subscriber.email)).map(({ email, verified }) => ({ email, verified })),
          });
        } catch {
          return json({ error: "Admin data temporarily unavailable" }, 503);
        }
      }
      if (url.pathname.startsWith("/admin/dmca/")) {
        if (request.method !== "DELETE") return json({ error: "Method not allowed" }, 405);
        const id = url.pathname.slice("/admin/dmca/".length);
        if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return json({ error: "Invalid request id" }, 400);
        await env.VIEW_COUNTER.delete(dmcaKey(id));
        return json({ success: true });
      }
      if (url.pathname.startsWith("/admin/requests/")) {
        if (request.method !== "DELETE") return json({ error: "Method not allowed" }, 405);
        const id = url.pathname.slice("/admin/requests/".length);
        if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return json({ error: "Invalid request id" }, 400);
        await env.VIEW_COUNTER.delete(requestKey(id));
        return json({ success: true });
      }
      if (url.pathname.startsWith("/admin/reports/")) {
        if (request.method !== "DELETE") return json({ error: "Method not allowed" }, 405);
        const id = url.pathname.slice("/admin/reports/".length);
        if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return json({ error: "Invalid report id" }, 400);
        await env.VIEW_COUNTER.delete(reportKey(id));
        return json({ success: true });
      }
      if (url.pathname === "/admin/sites") {
        if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
        try {
          const sites = await listSites(env, true);
          return json({ sites: sites.map((site) => ({ ...publicSite(site, url.origin), lastCheckedAt: site.lastCheckedAt ?? null, healthFailures: site.healthFailures ?? 0 })) });
        } catch {
          return json({ error: "Directory temporarily unavailable" }, 503);
        }
      }
      if (request.method !== "DELETE") return json({ error: "Method not allowed" }, 405);
      const slug = url.pathname.slice("/admin/sites/".length);
      if (!isValidSlug(slug)) return json({ error: "Invalid site slug" }, 400);
      try {
        return (await deleteSite(env, slug)) ? json({ success: true }) : json({ error: "Site not found" }, 404);
      } catch {
        return json({ error: "Could not remove that site" }, 503);
      }
    }

    if (url.pathname === "/dmca") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return handleDmcaRequest(request, env);
    }

    if (url.pathname === "/request-url") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return handleUrlRequest(request, env);
    }

    if (url.pathname === "/report") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return handleBugReport(request, env);
    }

    if (url.pathname === "/subscribe") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return handleEmailSubscribe(request, env);
    }

    if (url.pathname === "/subscribe/confirm") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      return handleConfirmSubscription(url, env);
    }

    if (url.pathname === "/subscribe/unsubscribe") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      return handleUnsubscribe(url, env);
    }

    if (url.pathname === "/push/public-key") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      return pushConfigured(env) ? json({ publicKey: env.VAPID_PUBLIC_KEY }) : json({ error: "Browser notifications are not configured yet." }, 503);
    }

    if (url.pathname === "/push/subscribe") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return handlePushSubscribe(request, env);
    }

    if (url.pathname === "/push/unsubscribe") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      let payload: { endpoint?: unknown };
      try { payload = await request.json() as typeof payload; } catch { return json({ error: "Invalid JSON body" }, 400); }
      if (typeof payload.endpoint !== "string" || !allowedPushEndpoint(payload.endpoint)) return json({ error: "Invalid browser notification endpoint." }, 400);
      try {
        await env.VIEW_COUNTER.delete(pushKey(await digest(payload.endpoint)));
        return json({ success: true });
      } catch {
        return json({ error: "Could not remove this browser subscription." }, 503);
      }
    }

    // POST /submit → publish a community site.
    if (url.pathname === "/submit") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return handleSubmit(request, env, url.origin, context);
    }

    // GET /s/<slug>/… → serve a published site (and its assets).
    if (url.pathname.startsWith("/s/")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
      }
      return handleServe(url, env);
    }

    // GET /stats → the numbers and daily history behind /stats on the site.
    if (url.pathname === "/stats") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      return handleStats(env, url);
    }

    // GET /?key=<name> → { views, unique } (increments the view counter).
    if (url.pathname !== "/") return notFound();
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

    // The visitor mark is resolved before the reply now, because the reply
    // carries the unique total; the daily bucket stays off the critical path.
    const unique = await bumpUnique(env, request);
    context.waitUntil(bumpDay(env));

    return json({ views, unique });
  },
  async scheduled(_event: unknown, env: Env, context: WorkerContext) {
    context.waitUntil(runHealthChecks(env));
  },
};

import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";

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
  COUNTER_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

// A visitor's choice: 1 = thumbs up, -1 = thumbs down, 0 = no vote.
type Vote = -1 | 0 | 1;

type VoteTotals = { up: number; down: number };

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
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-counter-secret",
  "Access-Control-Max-Age": "86400",
};

const MAX_KEY_LENGTH = 128;
const MAX_BULK_KEYS = 100;

// Publishing limits. KV values cap out at 25 MiB, so these keep a single
// uploaded site comfortably inside one namespace.
const MAX_FILES = 40;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_LISTED_SITES = 500;
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

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, "Cache-Control": "no-store" },
  });

const notFound = () => new Response("Not found", { status: 404, headers: CORS_HEADERS });

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

const validEmail = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 254) return false;
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
});

const listSites = async (env: Env): Promise<PublishedSite[]> => {
  const sites: PublishedSite[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await env.VIEW_COUNTER.list({ prefix: SITE_PREFIX, limit: 100, cursor });
    const raws = await Promise.all(page.keys.map((entry) => env.VIEW_COUNTER.get(entry.name)));
    for (const raw of raws) {
      if (!raw) continue;
      try {
        sites.push(JSON.parse(raw) as PublishedSite);
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

// POST /submit — validates and stores a community-published site.
const handleSubmit = async (request: Request, env: Env, origin: string, context: WorkerContext): Promise<Response> => {
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

    const site: PublishedSite = { slug, title, description, tags, indexPath, files, createdAt: Date.now() };
    await env.VIEW_COUNTER.put(siteKey(slug), JSON.stringify(site));
    for (const body of bodies) await env.VIEW_COUNTER.put(body.key, body.data);
    const published = publicSite(site, origin);
    context.waitUntil(notifyPublished(env, site, published.url, authorEmail));
    return json({ site: published }, 201);
  } catch {
    return json({ error: "Couldn't publish that right now — try again." }, 503);
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

const handleEmailSubscribe = async (request: Request, env: Env, origin: string): Promise<Response> => {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return json({ error: "Email updates are not configured yet." }, 503);
  let payload: { email?: unknown };
  try { payload = await request.json() as typeof payload; } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (!validEmail(payload.email)) return json({ error: "Enter a valid email address." }, 400);
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
    const token = randomToken();
    const unsubscribeToken = randomToken();
    const unsubscribeHash = await digest(unsubscribeToken);
    const confirmationUrl = `${origin}/subscribe/confirm?token=${encodeURIComponent(token)}`;
    const unsubscribeUrl = `${origin}/subscribe/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    await env.VIEW_COUNTER.put(key, JSON.stringify({ email, verified: false, unsubscribeHash, unsubscribeToken }));
    await env.VIEW_COUNTER.put(`${CONFIRM_PREFIX}${token}`, hash, { expirationTtl: 86400 });
    await env.VIEW_COUNTER.put(`${UNSUBSCRIBE_PREFIX}${unsubscribeHash}`, hash);
    const sent = await sendResend(env, {
      to: email,
      subject: "Confirm your base31 site updates",
      text: `Confirm your email to get a note when community sites are published: ${confirmationUrl}\n\nIf you didn't request this, ignore this message.`,
      html: `<p>Confirm your email to get a note when community sites are published.</p><p><a href="${escapeHtml(confirmationUrl)}">Confirm my subscription</a></p><p>If you didn’t request this, ignore this message.</p>`,
    });
    if (!sent) {
      await Promise.all([env.VIEW_COUNTER.delete(key), env.VIEW_COUNTER.delete(`${CONFIRM_PREFIX}${token}`), env.VIEW_COUNTER.delete(`${UNSUBSCRIBE_PREFIX}${unsubscribeHash}`)]);
      return json({ error: "Could not send a confirmation email right now." }, 502);
    }
    return json({ success: true }, 202);
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

    if (url.pathname === "/subscribe") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return handleEmailSubscribe(request, env, url.origin);
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

    // GET /?key=<name> → { views } (increments the view counter).
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

    return json({ views });
  },
};

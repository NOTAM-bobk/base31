// Writes one new blog post with a free AI model and adds it to
// config/blogs.json. Run weekly by .github/workflows/weekly-blog.yml, and safe
// to run by hand from the repository root.
//
// Provider: Cloudflare Workers AI through its OpenAI-compatible endpoint.
// Workers AI is free on Cloudflare's free plan (10,000 Neurons a day), and this
// repository already keeps Cloudflare credentials for the Worker deploy, so no
// new account is needed. (GitHub Models, which used to make this possible with
// no key at all, was retired on 30 July 2026.)
//
// Environment:
//   CLOUDFLARE_ACCOUNT_ID  required — already set for the Worker deploy.
//   CLOUDFLARE_AI_TOKEN    API token with "Account > Workers AI > Read".
//                          Falls back to CLOUDFLARE_API_TOKEN when absent.
//   AI_BLOG_MODEL          optional — a Workers AI text model.
//   AI_BLOG_API_URL        optional — override the endpoint (e.g. a Cloudflare
//                          AI Gateway URL, or a mock in tests).
//   AI_BLOG_DRY_RUN=1      optional — print the post but do not write it.
//
// With no credentials the script prints a note and exits 0, so the scheduled
// workflow stays quiet until it is configured. A failed request exits 1 so a
// broken token is visible instead of silently skipping weeks.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BLOG_FILE = path.join(ROOT, "config", "blogs.json");
const MODEL = process.env.AI_BLOG_MODEL?.trim() || "@cf/meta/llama-3.1-8b-instruct";
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const token = (process.env.CLOUDFLARE_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN)?.trim();
const apiUrl = process.env.AI_BLOG_API_URL?.trim() || `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
const dryRun = process.env.AI_BLOG_DRY_RUN === "1" || process.env.AI_BLOG_DRY_RUN === "true";

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// A rotating set of themes, chosen by ISO week so consecutive Mondays differ.
// They stay on the directory's own subject — the open, personal, useful web —
// so a generated post fits the journal instead of drifting into generic tech
// writing.
const THEMES = [
  "finding small, personal websites that never trend",
  "why single-purpose tools beat all-in-one platforms",
  "how web rings, link pages, and personal directories still work",
  "the case for owning your own corner of the web",
  "little browser tools that respect your time and privacy",
  "how to keep a trail of the good things you find online",
  "what makes a website feel handmade instead of assembled",
  "quiet alternatives to infinite feeds",
];

function isoWeek(date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("The model did not return a JSON object.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Accepts only what config/blogs.json needs, so an off-spec answer never
// reaches the file. Rules mirror scripts/validate-content.mjs.
function normalizePost(raw, existingSlugs, today) {
  const title = String(raw?.title ?? "").trim();
  const description = String(raw?.description ?? "").trim();
  const tags = Array.isArray(raw?.tags) ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 5) : [];
  const body = Array.isArray(raw?.body)
    ? raw.body.map((line) => String(line).replace(/\r/g, "").trim()).filter(Boolean).slice(0, 24)
    : [];
  if (title.length < 8 || title.length > 90) throw new Error(`Title out of range: ${JSON.stringify(title)}`);
  if (description.length < 40 || description.length > 200) throw new Error(`Description out of range (${description.length} chars)`);
  if (tags.length === 0) throw new Error("The model returned no tags.");
  if (body.length < 4) throw new Error(`Body needs at least four blocks, got ${body.length}.`);

  let slug = slugify(title);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Unusable slug from title: ${JSON.stringify(title)}`);
  if (existingSlugs.has(slug)) {
    let suffix = 2;
    while (existingSlugs.has(`${slug}-${suffix}`)) suffix += 1;
    slug = `${slug}-${suffix}`;
  }
  return { slug, title, description, date: today, tags, body };
}

async function generate(prompt) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "You are the editor of base31.org, a directory of small, useful, personal websites. You write plain, warm, concrete prose with no hype and no filler." },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 1400,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Workers AI request failed (${response.status}): ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Workers AI returned no message content.");
  return content;
}

const existing = JSON.parse(fs.readFileSync(BLOG_FILE, "utf8"));
if (!Array.isArray(existing)) throw new Error("config/blogs.json must be an array.");
const today = new Date().toISOString().slice(0, 10);
if (existing.some((post) => post.date === today)) {
  console.log(`A post dated ${today} already exists; nothing to do.`);
  process.exit(0);
}

if (!token || (!accountId && !process.env.AI_BLOG_API_URL?.trim())) {
  console.log("Skipping: set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN to generate the weekly post.");
  process.exit(0);
}

const theme = THEMES[isoWeek(new Date()) % THEMES.length];
const recent = existing.slice(0, 12).map((post) => `- ${post.title}`).join("\n");
const prompt = [
  `Write one blog post for base31.org about: ${theme}.`,
  "Return ONLY a JSON object, with no markdown code fences and no commentary, in exactly this shape:",
  '{"title": "...", "description": "...", "tags": ["...", "..."], "body": ["..."]}',
  "Rules:",
  "- description is one sentence, 40 to 160 characters, no trailing period needed.",
  "- 3 to 5 lowercase tags, single words or hyphenated.",
  "- body is 9 to 14 strings. Plain sentences are paragraphs; a string starting with '## ' is a section heading; a string starting with '- ' is a list item.",
  "- Use at least two '## ' headings and keep the whole post between 450 and 800 words.",
  "- No links, no images, no markdown beyond '## ' and '- ', and never mention being an AI or a model.",
  "- Do not reuse any of these recent titles:",
  recent,
].join("\n");

let post;
try {
  post = normalizePost(extractJson(await generate(prompt)), new Set(existing.map((entry) => entry.slug)), today);
} catch (firstError) {
  console.error(`First attempt rejected: ${firstError.message}`);
  post = normalizePost(extractJson(await generate(prompt)), new Set(existing.map((entry) => entry.slug)), today);
}

if (dryRun) {
  console.log("Dry run — nothing written. Generated post:\n");
  console.log(JSON.stringify(post, null, 2));
  process.exit(0);
}

// Newest first, matching the changelog's convention; the blog page sorts by
// date anyway, but the file stays readable.
const updated = [post, ...existing];
fs.writeFileSync(BLOG_FILE, `${JSON.stringify(updated, null, 2)}\n`);
console.log(`Added "${post.title}" (/${post.slug}) dated ${post.date}.`);

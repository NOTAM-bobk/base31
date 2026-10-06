import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(relative) {
  const source = fs.readFileSync(relative, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (!id.startsWith("@/")) return require(id);
    const relative = id.slice(2);
    return relative.endsWith(".json") ? require(path.resolve(relative)) : load(`${relative}.ts`);
  };
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  return module.exports;
}
const { compareVotes, totalVotes } = load("lib/vote-ranking.ts");
assert.equal(totalVotes({ up: 2, down: 10 }), 12);
assert.ok(compareVotes({ up: 2, down: 10 }, { up: 9, down: 0 }) < 0);
assert.ok(compareVotes(undefined, { up: 0, down: 1 }) > 0);
assert.ok(compareVotes({ up: 5, down: 5 }, { up: 6, down: 4 }) > 0);
const directory = load("lib/directory.ts");
const entries = directory.directoryEntries;
const sprite = entries.find(item => item.url === "https://spriteframe.com/png-to-sprite-sheet");
assert.equal(sprite.sectionId, "cool-sites");
assert.equal(entries.filter(item => item.url === sprite.url).length, 1);
const homeSource = fs.readFileSync("components/home-page.tsx", "utf8");
assert.ok(homeSource.includes('!query.trim() && <EditorsPicks'));
assert.ok(homeSource.includes('!query.trim() && <nav className="quick-jumps"'));
assert.ok(fs.readFileSync("components/link-strip.tsx", "utf8").includes('useSiteVotes(items.map('), "Ranking includes votes for cards beyond the preview");
assert.equal(new Set(entries.map((entry) => entry.slug)).size, entries.length, "Detail slugs must be unique");
for (const entry of entries) {
  assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(entry.voteKey, /^[A-Za-z0-9._:-]{1,128}$/);
  assert.equal(directory.detailPath(entry.url, entry.sectionId), `/sites/${entry.slug}`);
  for (const field of ["addedAt", "lastChecked"]) {
    if (entry[field]) assert.ok(Number.isFinite(Date.parse(entry[field])));
  }
}
assert.equal(directory.detailPath("https://unknown.example/"), null);
assert.equal(directory.externalVoteKey("https://chatgpt.com/"), directory.externalVoteKey("https://chatgpt.com/#chat"));
assert.notEqual(directory.externalVoteKey("https://example.org/a"), directory.externalVoteKey("https://example.org/b"));
assert.ok(directory.searchCoolAis("gemni").some((entry) => entry.name === "Gemini"));
assert.ok(directory.searchCoolAis("  OPENAI  ").some((entry) => entry.name === "ChatGPT"));
assert.equal(directory.searchCoolAis("").length, 15);
assert.equal(directory.searchCoolAis("no-such-ai-tool-123").length, 0);
for (const [file, fn] of [["cool-sites", "searchCoolSites"], ["cool-apis", "searchCoolApis"], ["cool-apps", "searchCoolApps"]]) {
  const library = load(`lib/${file}.ts`);
  const all = library[fn]("");
  const sample = all[0];
  assert.ok(library[fn](sample.name).some((entry) => entry.url === sample.url));
  assert.ok(library[fn](sample.category).some((entry) => entry.url === sample.url));
  assert.ok(library[fn](sample.url).some((entry) => entry.url === sample.url));
}
const { matchesQuery } = load("lib/search.ts");
const sample = { name: "Tag wording", url: "https://example.com/", description: "AI tools", tags: ["utility", "no-key"] };
assert.ok(matchesQuery(sample, "#UTILITY"));
assert.ok(matchesQuery(sample, "tag:no-key tools"));
assert.ok(!matchesQuery(sample, "#ai"), "Tag search must not match description-only words");
assert.ok(!matchesQuery(sample, "#util"), "Tags match exactly");
assert.ok(!matchesQuery(sample, "#utility missing"));
assert.ok(!matchesQuery(sample, "tag:"));
assert.ok(directory.searchCoolAis("#openai").some((entry) => entry.name === "ChatGPT"));
for (const [file, fn] of [["cool-sites", "searchCoolSites"], ["cool-apis", "searchCoolApis"], ["cool-apps", "searchCoolApps"]]) {
  const library = load(`lib/${file}.ts`);
  const sample = library[fn]("")[0];
  assert.ok(library[fn](`#${sample.tags[0]}`).some((entry) => entry.url === sample.url));
}
// Tags are an index of their own now: every tag in the directory gets a page,
// and the slug on that page has to be unique and URL-safe.
const tags = load("lib/tags.ts");
assert.ok(tags.allTags.length > 0, "The tag index must not be empty");
assert.equal(new Set(tags.allTags.map((info) => info.slug)).size, tags.allTags.length, "Tag slugs must be unique");
assert.ok(tags.allTags.every((info) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(info.slug)), "Tag slugs must be URL-safe");
assert.ok(tags.allTags.every((info) => info.count > 0), "A tag with no entries should not be listed");
for (const info of tags.allTags) {
  assert.equal(tags.tagBySlug(info.slug).tag, info.tag);
  const carrying = tags.entriesForTag(info.tag);
  assert.equal(carrying.length, info.count, `Tag ${info.tag} count must match its entries`);
  assert.ok(carrying.every((entry) => (entry.tags ?? []).includes(info.tag)));
}
assert.equal(tags.tagBySlug("no-such-tag-123"), undefined);
assert.equal(tags.tagSlug("No Key!"), "no-key");
assert.equal(tags.tagGroups.reduce((total, group) => total + group.tags.length, 0), tags.allTags.length, "Every tag belongs to exactly one letter group");

// Recently added is derived from addedAt/createdAt, never hand-listed.
const recent = load("lib/recently-added.ts");
assert.ok(recent.recentlyAdded.length > 0, "Some entries must carry an added date");
assert.ok(recent.recentlyAdded.every((entry) => recent.addedTime(entry) !== undefined));
const recentTimes = recent.recentlyAdded.map((entry) => recent.addedTime(entry));
assert.deepEqual(recentTimes, [...recentTimes].sort((a, b) => b - a), "Recently added must be newest-first");
const dated = entries.filter((entry) => entry.addedAt || entry.createdAt).length;
assert.equal(recent.recentlyAdded.length, dated, "Every dated entry belongs on the page");
assert.equal(recent.monthLabel("2026-10-03"), "October 2026");
assert.ok(recent.recentlyAddedTop(3).length <= 3);
assert.ok(recent.addedWithinDays(0).length <= recent.recentlyAdded.length);

// The detail page has to carry both the related block and the share strip, and
// the tag chips have to link into the tag pages rather than being plain text.
const detailSource = fs.readFileSync("app/sites/[slug]/page.tsx", "utf8");
assert.ok(detailSource.includes("<ShareLink url={url}"), "A detail page must offer a share link");
assert.ok(detailSource.includes("ShareLink compact"), "Each related pick gets its own share row");
assert.ok(detailSource.includes('href={`/tags/${tagSlug(tag)}`}'), "Detail tags must link to their tag pages");
assert.ok(detailSource.includes("Related picks"), "The related block must be titled");
const shareSource = fs.readFileSync("components/share-link.tsx", "utf8");
for (const host of ["twitter.com/intent/tweet", "facebook.com/sharer", "linkedin.com/sharing", "reddit.com/submit", "mailto:"]) {
  assert.ok(shareSource.includes(host), `Share link missing ${host}`);
}
assert.ok(shareSource.includes("navigator.clipboard.writeText"), "Share link must offer a copy button");
assert.ok(shareSource.includes('"use client"'), "The copy button needs the client");

// The new routes exist, are canonical, and are listed in the sitemap.
const sitemap = fs.readFileSync("app/sitemap.ts", "utf8");
for (const [route, file] of [["/tags", "app/tags/page.tsx"], ["/recently-added", "app/recently-added/page.tsx"], ["/quality-report", "app/quality-report/page.tsx"]]) {
  assert.ok(fs.readFileSync(file, "utf8").includes(`canonical: "${route}"`), `${route} must set its canonical`);
  assert.ok(sitemap.includes(route), `${route} must be in the sitemap`);
}
assert.ok(fs.readFileSync("app/tags/[tag]/page.tsx", "utf8").includes("generateStaticParams"), "Tag pages are built at build time");
assert.ok(sitemap.includes("/tags/${info.slug}"), "Every tag page must be in the sitemap");

// tags.base31.org is the tag index, not a static folder.
const middlewareSource = fs.readFileSync("middleware.ts", "utf8");
assert.ok(middlewareSource.includes('const TAG_SUBDOMAIN = "tags"'));
assert.ok(middlewareSource.includes("url.pathname = tag ? `/tags/${tag}` : \"/tags\""), "The tags subdomain rewrites to the tag routes");

// The quality report reads the Worker's health checks through a proxy.
const qualityRoute = fs.readFileSync("app/api/quality-report/route.ts", "utf8");
assert.ok(qualityRoute.includes("/quality"), "The proxy must call the Worker's /quality endpoint");
const workerSource = fs.readFileSync("worker/src/index.ts", "utf8");
assert.ok(workerSource.includes('url.pathname === "/quality"'), "The Worker must route /quality");
assert.ok(workerSource.includes("const handleQuality"), "The Worker must implement /quality");
assert.ok(workerSource.includes("lastCheckedAt"), "The quality report needs the last check time");
assert.ok(workerSource.includes("healthFailures"), "The quality report needs the failure count");
assert.ok(fs.readFileSync("components/quality-checks.tsx", "utf8").includes("/api/quality-report"), "The live block reads the proxy");

// The homepage points at the three new indexes, from the quick jumps and the
// footer. Read here rather than relying on the `home` binding declared further
// down, which is not in scope yet.
const homeWithIndexes = fs.readFileSync("components/home-page.tsx", "utf8");
for (const href of ["/recently-added", "/tags", "/quality-report"]) {
  assert.ok(homeWithIndexes.includes(`href: "${href}"`), `The homepage quick jumps must include ${href}`);
  assert.ok(homeWithIndexes.includes(`href="${href}"`), `The footer must link ${href}`);
}

const picks = JSON.parse(fs.readFileSync("config/editors-picks.json", "utf8"));
assert.equal(new Set(picks.map((pick) => pick.slug)).size, picks.length);
for (const pick of picks) {
  assert.ok(entries.some((entry) => entry.slug === pick.slug), `Unknown editor's pick: ${pick.slug}`);
  assert.ok(typeof pick.note === "string" && pick.note.length >= 20);
}
const { estimateLines } = load("lib/code-estimate.ts");
assert.equal(estimateLines({ TypeScript: 450, HTML: 600, CSS: 350 }), 30);
assert.equal(estimateLines({ Unknown: 90 }), 2);
assert.equal(estimateLines({ TypeScript: -5 }), null);
assert.equal(estimateLines({ TypeScript: "450" }), null);
assert.equal(estimateLines({}), null);
const donation = fs.readFileSync("public/sites/donation/index.html", "utf8");
const campaign = "https://fundrazr.com/62nDBa";
assert.equal((donation.match(/href="https:\/\/fundrazr.com\/62nDBa"/g) ?? []).length, 2, "Both support CTAs use the campaign");
const schemas = [...donation.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
assert.equal(schemas[0]["@graph"][0].potentialAction.target, campaign);
assert.ok(!donation.includes("cdn.tailwindcss.com") && !donation.includes("0x71C") && !donation.includes("bc1q..."));
assert.ok(donation.includes('href="https://base31.org/privacy"'));
const kori = "https://www.supportkori.com/base31";
assert.equal((donation.match(/href="https:\/\/www\.supportkori\.com\/base31"/g) ?? []).length, 2, "SupportKori is available in both donation CTA areas");
assert.ok(fs.readFileSync("components/donation-board.tsx", "utf8").includes(kori));
const referrals = JSON.parse(fs.readFileSync("config/referrals.json", "utf8"));
assert.ok(referrals.some(item => item.url === "https://supportkori.com/aff/EQvZmCrx" && item.show === true));
const home = fs.readFileSync("components/home-page.tsx", "utf8");
for (const href of ["/about", "/our-story"]) {
  assert.ok(home.includes(`href="${href}"`));
  assert.ok(fs.readFileSync("components/about-section.tsx", "utf8").includes(`href="${href}"`));
}
assert.ok(fs.readFileSync("app/our-story/page.tsx", "utf8").includes('canonical: "/our-story"'));
assert.ok(fs.readFileSync("app/sitemap.ts", "utf8").includes("/our-story"));
const statsPage = fs.readFileSync("app/stats/page.tsx", "utf8");
const styles = fs.readFileSync("app/inner-pages.css", "utf8");
for (const [, classList] of statsPage.matchAll(/className="([^"]+)"/g)) {
  for (const className of classList.split(" ").filter(name => name.startsWith("stats-"))) {
    assert.ok(styles.includes(`.${className}`), `Missing stats style: ${className}`);
  }
}
assert.match(styles, /\.stats-chart\s*\{[^}]*width: 100%;[^}]*height: auto;/);
const carousel = fs.readFileSync("components/editors-picks.tsx", "utf8");
assert.ok(!carousel.includes("<button") && !carousel.includes("THE SHORTLIST"));
assert.ok(carousel.includes("onTouchEnd") && carousel.includes("prefers-reduced-motion"));
assert.equal(directory.tagTone("UTILITY"), "mint");
assert.equal(directory.tagTone("developer"), "sky");
assert.equal(directory.tagTone("puzzle"), "amber");
assert.equal(directory.tagTone("privacy"), "coral");
assert.equal(directory.tagTone(" custom-tag "), directory.tagTone("CUSTOM-TAG"));
assert.ok(["mint", "sky", "amber", "coral"].includes(directory.tagTone("unknown")));

// Signing out of the moderation page must clear its numbers instead of leaving
// the last admin's inbox on screen, and a failed load must do the same.
const adminSource = fs.readFileSync("components/admin-community-sites.tsx", "utf8");
assert.ok(adminSource.includes('>Sign out<'), "The moderation page needs a sign-out control");
assert.ok(/clearData\s*=\s*useCallback/.test(adminSource), "Signing out must clear the inbox");
for (const reset of ["setSites([])", "setRequests([])", "setDmca([])", "setSubscribers([])", "setSignedIn(false)"]) {
  assert.ok(adminSource.includes(reset), `Signing out must reset ${reset}`);
}
assert.ok(/catch \(error\) \{[\s\S]{0,400}clearData\(\)/.test(adminSource), "A rejected or unauthorized load must not leave stale numbers");
assert.ok(adminSource.includes("{!signedIn ? ("), "The inbox is only rendered while signed in");
assert.ok(adminSource.includes("if (!value.trim()) { clearData();"), "Clearing the password field signs the page out");

// The weekly blog agent: a Monday-only workflow that writes through the free
// Cloudflare Workers AI endpoint and commits the result.
const blogWorkflow = fs.readFileSync(".github/workflows/weekly-blog.yml", "utf8");
assert.ok(blogWorkflow.includes('- cron: "0 13 * * 1"'), "The blog agent runs every Monday");
assert.ok(blogWorkflow.includes("workflow_dispatch:"), "The blog agent can be run by hand");
assert.ok(/permissions:\s*\n\s*contents: write/.test(blogWorkflow), "The blog agent needs push permission");
assert.ok(blogWorkflow.includes("node scripts/generate-weekly-blog.mjs"), "The workflow runs the generator");
assert.ok(blogWorkflow.includes("node scripts/validate-content.mjs"), "The workflow validates before committing");
assert.ok(blogWorkflow.includes("secrets.CLOUDFLARE_AI_TOKEN || secrets.CLOUDFLARE_API_TOKEN"), "The workflow falls back to the deploy token");
const generatorSource = fs.readFileSync("scripts/generate-weekly-blog.mjs", "utf8");
assert.ok(generatorSource.includes("/ai/v1/chat/completions"), "The generator uses the Workers AI OpenAI-compatible endpoint");
assert.ok(generatorSource.includes("CLOUDFLARE_ACCOUNT_ID"), "The generator reads the Cloudflare account id");
assert.ok(generatorSource.includes("Skipping:"), "The generator stays quiet before it is configured");
assert.ok(generatorSource.includes("description.length < 40"), "A generated post must meet the content rules");
// Run the generator with no credentials: it must exit cleanly and touch nothing.
const bareEnv = { ...process.env };
delete bareEnv.CLOUDFLARE_ACCOUNT_ID;
delete bareEnv.CLOUDFLARE_AI_TOKEN;
delete bareEnv.CLOUDFLARE_API_TOKEN;
const blogsBefore = fs.readFileSync("config/blogs.json", "utf8");
const generatorRun = spawnSync(process.execPath, ["scripts/generate-weekly-blog.mjs"], { env: bareEnv, encoding: "utf8" });
assert.equal(generatorRun.status, 0, `An unconfigured generator run must not fail: ${generatorRun.stderr}`);
assert.equal(fs.readFileSync("config/blogs.json", "utf8"), blogsBefore, "An unconfigured run must not rewrite blogs.json");
assert.ok(fs.readFileSync("README.md", "utf8").includes("CLOUDFLARE_AI_TOKEN"), "The blog agent's secret is documented");

// Drive the generator for real against a local mock model server, in a
// throwaway copy of the repo, to prove it writes only a valid post. This must
// use async spawn: a synchronous spawn would block this process and the mock
// server could never answer the child.
const runNode = (args, options) => new Promise((resolve) => {
  const child = spawn(process.execPath, args, options);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const timer = setTimeout(() => child.kill("SIGKILL"), 30000);
  child.on("close", (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
});
const cannedPost = {
  title: "A Field Guide to Small Personal Websites",
  description: "A short, concrete guide to finding and keeping the small personal websites that make the open web worth browsing.",
  tags: ["indie web", "discovery"],
  body: ["Opening paragraph.", "## First heading", "Paragraph two.", "Paragraph three.", "- a list item", "Paragraph four.", "## Second heading", "Closing paragraph."],
};
const mock = http.createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(cannedPost) } }] }));
});
await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "base31-blog-"));
fs.mkdirSync(path.join(sandbox, "config"), { recursive: true });
fs.mkdirSync(path.join(sandbox, "scripts"), { recursive: true });
fs.copyFileSync("scripts/generate-weekly-blog.mjs", path.join(sandbox, "scripts", "generate-weekly-blog.mjs"));
fs.writeFileSync(path.join(sandbox, "config", "blogs.json"), "[]\n");
const mockEnv = { ...bareEnv, CLOUDFLARE_ACCOUNT_ID: "test-account", CLOUDFLARE_AI_TOKEN: "test-token", AI_BLOG_API_URL: `http://127.0.0.1:${mock.address().port}/v1/chat/completions` };
const generated = await runNode(["scripts/generate-weekly-blog.mjs"], { cwd: sandbox, env: mockEnv });
assert.equal(generated.status, 0, `The generator must succeed against a valid answer: ${generated.stderr}`);
const writtenPosts = JSON.parse(fs.readFileSync(path.join(sandbox, "config", "blogs.json"), "utf8"));
assert.equal(writtenPosts.length, 1, "A successful run writes exactly one post");
assert.equal(writtenPosts[0].slug, "a-field-guide-to-small-personal-websites");
assert.equal(writtenPosts[0].date, new Date().toISOString().slice(0, 10));
assert.deepEqual(writtenPosts[0].body, cannedPost.body);
// An off-spec answer must fail the run and leave the file untouched.
const badMock = http.createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: "Too Short", description: "tiny", tags: ["x"], body: ["one", "two"] }) } }] }));
});
await new Promise((resolve) => badMock.listen(0, "127.0.0.1", resolve));
fs.writeFileSync(path.join(sandbox, "config", "blogs.json"), "[]\n");
const rejected = await runNode(["scripts/generate-weekly-blog.mjs"], { cwd: sandbox, env: { ...mockEnv, AI_BLOG_API_URL: `http://127.0.0.1:${badMock.address().port}/v1/chat/completions` } });
assert.notEqual(rejected.status, 0, "An off-spec answer must fail the run");
assert.equal(fs.readFileSync(path.join(sandbox, "config", "blogs.json"), "utf8"), "[]\n", "A rejected answer must not touch blogs.json");
mock.close(); badMock.close();
fs.rmSync(sandbox, { recursive: true, force: true });
console.log(`Directory tests passed: ${entries.length} detail pages, four external search indexes, stable shared vote keys.`);

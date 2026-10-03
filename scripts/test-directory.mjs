import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
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
const directory = load("lib/directory.ts");
const entries = directory.directoryEntries;
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
console.log(`Directory tests passed: ${entries.length} detail pages, four external search indexes, stable shared vote keys.`);

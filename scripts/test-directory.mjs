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
/** The transpiled source of one file, for the loaders above to run. */
function loadSource(relative) {
  return ts.transpileModule(fs.readFileSync(relative, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true },
  }).outputText;
}
// The Worker's fetch handler, transpiled and loaded so a route can be driven
// in-process. The only two specifiers it needs are its shared ranking rule and
// its Durable Object, which the fire and vote routes never touch.
function loadWorker(relative) {
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === "../../lib/vote-ranking") return load("lib/vote-ranking.ts");
    if (id === "./discussion") return {};
    try { return require(id); } catch { return {}; }
  };
  new Function("require", "module", "exports", loadSource(relative))(localRequire, module, module.exports);
  return module.exports;
}
const { compareVotes, rankByVotes, totalVotes, FIRE_VOTE_WEIGHT } = load("lib/vote-ranking.ts");
assert.equal(totalVotes({ up: 2, down: 10 }), 12);
assert.ok(compareVotes({ up: 2, down: 10 }, { up: 9, down: 0 }) < 0);
assert.ok(compareVotes(undefined, { up: 0, down: 1 }) > 0);
assert.ok(compareVotes({ up: 5, down: 5 }, { up: 6, down: 4 }) > 0);
// The homepage's Top 10 ranks through the same rule as /stats and the strips:
// by total votes rather than net, alphabetically where they are level, and cut
// to the asked-for length. An unvoted board keeps the directory's own order
// instead of shuffling.
const rankedBoard = [
  { name: "Bravo", voteKey: "b" },
  { name: "Alpha", voteKey: "a" },
  { name: "Delta", voteKey: "d" },
  { name: "Charlie", voteKey: "c" },
];
const boardTotals = { b: { up: 0, down: 9 }, d: { up: 4, down: 0 }, a: { up: 2, down: 1 }, c: { up: 0, down: 0 } };
assert.deepEqual(rankByVotes(rankedBoard, boardTotals, 3).map((entry) => entry.name), ["Bravo", "Delta", "Alpha"], "The board ranks by all votes and cuts to its length");
assert.deepEqual(rankByVotes(rankedBoard, {}, 4).map((entry) => entry.name), ["Alpha", "Bravo", "Charlie", "Delta"], "An unvoted board falls back to name order, so nothing flaps between renders");
assert.deepEqual(rankByVotes(rankedBoard, boardTotals, 10).length, 4, "A board shorter than its limit is returned whole");
assert.deepEqual(rankedBoard.map((entry) => entry.name), ["Bravo", "Alpha", "Delta", "Charlie"], "Ranking must not reorder the caller's own array");
const directory = load("lib/directory.ts");
const entries = directory.directoryEntries;
const sprite = entries.find(item => item.url === "https://spriteframe.com/png-to-sprite-sheet");
assert.equal(sprite.sectionId, "cool-sites");
assert.equal(entries.filter(item => item.url === sprite.url).length, 1);
const homeSource = fs.readFileSync("components/home-page.tsx", "utf8");
// The section keys hide while there is a question on screen — where the search
// is, the list of what matched is the answer and not a menu.
assert.ok(homeSource.includes('!query.trim() && <nav className="quick-jumps"'));
assert.ok(homeSource.includes('<BestMatches query={query} />'), "A search answers with the best matches first");
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
// The share row belongs to the page, not to each related-pick box: six rows of
// identical buttons under six cards buried the cards themselves, so one share
// block is left, and it is the page's own.
const detailSource = fs.readFileSync("app/sites/[slug]/page.tsx", "utf8");
assert.ok(detailSource.includes("<ShareLink url={url}"), "A detail page must offer a share link");
assert.equal((detailSource.match(/<ShareLink/g) || []).length, 1, "The related-pick boxes carry no share row of their own");
assert.ok(!detailSource.includes("ShareLink compact"), "The compact share control is not rendered inside a related-pick box");
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
for (const [route, file] of [["/explore", "app/explore/page.tsx"], ["/tags", "app/tags/page.tsx"], ["/recently-added", "app/recently-added/page.tsx"], ["/quality-report", "app/quality-report/page.tsx"]]) {
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
// The footer carries the copyright, and the about section no longer repeats the
// four topic tags or the sparkle-gif credit under it.
assert.ok(home.includes("Copyright © 2026 base31.org"), "The footer must show the 2026 copyright");
const aboutSection = fs.readFileSync("components/about-section.tsx", "utf8");
assert.ok(!aboutSection.includes("topic-links"), "The four topic tags were removed from the about section");
assert.ok(!aboutSection.includes("about-sparkle-credit"), "The sparkle-gif credit was removed from the about section");
// Support starts closed, so the page does not lead with donation appeals.
assert.ok(fs.readFileSync("components/support-section.tsx", "utf8").includes("useState(true)"), "The support section must start collapsed");
assert.ok(fs.readFileSync("app/our-story/page.tsx", "utf8").includes('canonical: "/our-story"'));
assert.ok(fs.readFileSync("app/sitemap.ts", "utf8").includes("/our-story"));

// The directory moved off the landing page and onto /explore, and a phone
// reaches it through the header's drawer. The two halves of home-page.tsx have
// to stay in step with that: the listings on one page, the prose on the other.
assert.ok(fs.readFileSync("app/explore/page.tsx", "utf8").includes('mode="explore"'), "The explore route renders the directory mode");
assert.ok(home.includes("{isExplore && <>"), "The directory block renders on /explore only");
assert.ok(home.includes("{!isExplore && <>"), "The prose block renders on the landing page only");
const drawerSource = fs.readFileSync("components/nav-drawer.tsx", "utf8");
assert.ok(drawerSource.includes('action="/explore"') && drawerSource.includes('name="q"'), "The drawer searches /explore with a real GET form");
assert.ok(drawerSource.includes("href={link.href}"), "The drawer's categories are ordinary links, so they need no routing code");
assert.ok(drawerSource.includes("useDialogFocus"), "The drawer traps focus while it is open");
assert.ok(drawerSource.includes('event.key === "Escape"'), "The drawer closes on Escape");
assert.ok(drawerSource.includes('document.body.style.overflow = "hidden"'), "The page behind the drawer does not scroll");
assert.ok(drawerSource.includes('aria-hidden={!open}'), "The closed drawer is hidden from assistive technology");
// The panel's own behaviour since it grew result rows and fold controls. The
// full-screen overlay wrapped around the panel used to take pointer events of
// its own, which put it above the scrim and swallowed every tap in the strip
// beside the panel — so the drawer could not be dismissed by tapping out at
// all. Only the panel may be interactive.
assert.ok(drawerSource.includes("onClick={onClose}"), "Tapping the scrim beside the panel closes the drawer");
assert.ok(
  !/\.nav-drawer\.is-open \{ visibility: visible; pointer-events: auto; \}/.test(fs.readFileSync("app/directory.css", "utf8")),
  "The overlay around the panel must not take pointer events, or it swallows the tap meant for the scrim",
);
assert.match(
  fs.readFileSync("app/directory.css", "utf8"),
  /\.nav-drawer\.is-open \.nav-drawer-panel \{[^}]*pointer-events: auto/,
  "Only the panel itself is interactive",
);
assert.ok(
  drawerSource.includes('{exploreOpen ? "Close" : "Open"}') && drawerSource.includes('{moreOpen ? "Close" : "Open"}'),
  "Each list in the drawer carries a text control that folds it away",
);
assert.ok(drawerSource.includes("aria-expanded={exploreOpen}"), "A fold control reports whether its group is open");
assert.ok(drawerSource.includes("searchScore"), "The panel ranks its own results with the directory's own rule");
assert.ok(drawerSource.includes("href={`/sites/${item.slug}`}"), "A result listed in the panel opens that pick's detail page");
assert.ok(drawerSource.includes("href={`/explore?q=${encodeURIComponent(trimmed)}`}"), "The panel still hands the query to the full directory");
assert.ok(home.includes("searchIndex={drawerSearchIndex}"), "The homepage hands the drawer the index its own search reads");
// Every page outside the homepage sits on the same grey the landing page's
// sections do, so a card looks the same on a detail page as it does at home.
assert.ok(
  fs.readFileSync("app/subsite.css", "utf8").includes("body:has(main:not(.home-main)) { background: var(--page-band); }"),
  "Subsites paint the same page-band grey the landing page's sections sit on",
);
// The panel's results are only real if each row opens a page that exists. The
// drawer reads the same slim index the homepage builds (`drawerSearchIndex`)
// and ranks it with `searchScore`, the rule the "Best matches" block uses, so
// this runs that same pipeline over the real entries: a query has to produce
// results, and every result has to name a published detail page.
const search = load("lib/search.ts");
const drawerIndex = entries.map(({ name, slug, url, section, description, tags }) => ({ name, slug, url, section, description, tags }));
assert.equal(drawerIndex.length, entries.length, "The drawer's index covers every pick in every collection");
const rankForDrawer = (query) => drawerIndex
  .map((item) => ({ item, score: search.searchScore(item, query) }))
  .filter((ranked) => ranked.score > 0)
  .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
  .slice(0, 6)
  .map((ranked) => ranked.item);
assert.ok(rankForDrawer("canvas").length > 0, "A drawer search answers with something");
for (const query of ["canvas", "radio", "#game", "free tools"]) {
  for (const item of rankForDrawer(query)) {
    assert.ok(entries.some((entry) => entry.slug === item.slug), `A drawer result (${item.name}) must have a detail page to open`);
  }
}
assert.equal(rankForDrawer("no-such-pick-xyz").length, 0, "A query nothing matches answers with nothing");
assert.equal(rankForDrawer("   ").length, 0, "An empty field lists no results at all");
const headerSource = fs.readFileSync("components/site-header.tsx", "utf8");
assert.ok(headerSource.includes('className="icon-button nav-toggle"'), "The header carries the drawer button");
assert.ok(headerSource.includes('href="/explore"'), "The header links the directory at every width");
assert.ok(fs.readFileSync("app/directory.css", "utf8").includes("@media (max-width: 819px) { .nav-toggle { display: inline-flex; } }"), "The drawer button is a phone-only control");
// Every category the drawer offers must land on a section that exists, or the
// hash is a quiet no-op that scrolls nowhere.
// The hashes the drawer and the landing page's keys offer, one entry each.
const drawerHashes = [...new Set([...home.matchAll(/"\/explore#([a-z0-9-]+)"/g)].map((match) => match[1]))];
assert.equal(drawerHashes.length, 7, "The drawer lists every directory section");
const sectionIds = new Set();
for (const file of ["components/home-page.tsx", "components/editors-picks.tsx", "components/top-ten.tsx", "components/cool-sites.tsx", "components/cool-apis.tsx", "components/cool-apps.tsx", "components/cool-ais.tsx", "components/url-request.tsx"]) {
  const source = fs.readFileSync(file, "utf8");
  for (const [, id] of source.matchAll(/id="([a-z0-9-]+)"/g)) sectionIds.add(id);
  for (const [, id] of source.matchAll(/id: "([a-z0-9-]+)"/g)) sectionIds.add(id);
}
for (const hash of drawerHashes) assert.ok(sectionIds.has(hash), `The drawer links /explore#${hash}, which no section owns`);

// Every collection also has a page of its own at /explore/<id>, so the same ids
// have to appear in the registry those pages are built from — otherwise a hash
// the drawer offers would 404 as a page. The registry is the single place the
// sections are described, and the route builds one page per entry, so a new
// collection is one entry rather than four edits.
const sectionsSource = fs.readFileSync("lib/sections.ts", "utf8");
for (const hash of drawerHashes) {
  if (hash === "request-url") continue; // the submission form, not a collection
  assert.ok(sectionsSource.includes(`id: "${hash}"`), `lib/sections.ts has no entry for /explore/${hash}`);
}
const sectionRoute = fs.readFileSync("app/explore/[section]/page.tsx", "utf8");
assert.ok(sectionRoute.includes("directorySections.map"), "The section pages are built from the registry, not a hand-kept list");
assert.ok(sectionRoute.includes("export const dynamicParams = false"), "An unknown section slug must 404 rather than render an empty page");
assert.ok(sectionRoute.includes("<SectionExplorer section={section} />"), "A section page hands its collection to the explorer");
assert.ok(sectionRoute.includes('className="breadcrumb mono"'), "A section page carries the same path as every other subsite");
assert.ok(sitemap.includes("/explore/${section.id}"), "Every section page must be in the sitemap");
const explorerSource = fs.readFileSync("components/section-explorer.tsx", "utf8");
assert.ok(explorerSource.includes("matchesQuery"), "The section explorer searches with the same rule as the hero");
assert.ok(explorerSource.includes("aria-pressed={filter === name}"), "The section chips are real toggles");
assert.ok(explorerSource.includes("compareVotes"), "The section explorer ranks with the shared vote rule");

// The landing page carries a browsing half of its own again: the section keys,
// the editor's picks, the top ten, the URL request form and the tag shelf, in
// that order. The keys point into /explore's own sections, because the lists
// themselves stay on that page — a bare "#sites" would scroll nowhere from the
// homepage.
const band = home.indexOf('className="page-band"');
const homeKeys = home.indexOf('className="quick-jumps"');
const homePicks = home.indexOf("<EditorsPicks />");
const homeTopTen = home.indexOf("<TopTen />");
const homeWeekly = home.indexOf("<WebsiteOfTheWeek />");
const homeSubmit = home.indexOf("<UrlRequest />");
const homeTags = home.indexOf('id="browse-tags"');
assert.ok(
  band >= 0 && band < homeKeys && homeKeys < homePicks && homePicks < homeTopTen && homeTopTen < homeWeekly && homeWeekly < homeSubmit && homeSubmit < homeTags,
  "The landing page runs section keys, then editor's picks, then the top ten, then the website of the week, then the request form, then the tags",
);

// The weekly pick is a section of the landing page, not a page of its own, and
// it reads the same newest-first list /websites-of-the-week does — so the two
// can never lead with a different week.
const weeklySource = fs.readFileSync("components/website-of-the-week.tsx", "utf8");
assert.ok(weeklySource.includes("websitesOfTheWeek"), "The website of the week reads the shared weekly list");
assert.ok(weeklySource.includes('id="website-of-the-week"'), "The website of the week owns an id the rail can name");
assert.ok(home.includes('{ id: "website-of-the-week"'), "The section rail walks the new section too");
assert.match(
  fs.readFileSync("lib/websites-of-the-week.ts", "utf8"),
  /sort\(\(a, b\)/,
  "A rotation of the weekly list must stay newest-first, whatever order the config is in",
);

// The hero prints two figures now. The lines-of-code estimate and the GitHub
// byte count behind it are gone, so nothing in the hero depends on a third
// party for a number.
const heroStats = fs.readFileSync("components/hero-stats.tsx", "utf8");
assert.ok(!heroStats.includes("estimated lines of code") && !heroStats.includes("estimateLines"), "The hero no longer prints an estimated line count");
assert.ok(heroStats.includes('label: "websites linked"'), "The hero still figures the sites it links to");
assert.ok(!fs.readFileSync("app/directory.css", "utf8").includes(".hero-stat:nth-child(3)"), "The third figure's colour rule went with it");

// The Top 10's podium: the first three rows carry a class of their own so the
// numerals can be coloured without changing a single figure on the board.
assert.ok(fs.readFileSync("components/top-ten.tsx", "utf8").includes("is-top-${index + 1}"), "The top three rows are marked for the podium colours");
assert.match(fs.readFileSync("app/directory.css", "utf8"), /\.top-ten-list \.top-ten-rank\.is-top-1/, "The podium colours outrank the plain outline");

// The two hero actions wear the same shape, so the row reads as one pair of
// controls; only the fills differ.
const introSubmitRule = fs.readFileSync("app/directory.css", "utf8").match(/\.intro-links \.submit-url-link \{[^}]*\}/)?.[0] || "";
assert.ok(
  introSubmitRule.includes("border-radius: 7px;") && introSubmitRule.includes("min-height: 40px;") && introSubmitRule.includes("padding: 6px 14px 6px 7px;"),
  "Submit a URL wears the shape of the Surprise me button",
);
// The directory button counts picks, not sites: the "N sites" prefix is gone.
assert.ok(!home.includes("{allSites.length} sites · "), "The Explore the directory button no longer counts sites");
// The form is on both faces, so the hero anchors to the copy on screen and the
// drawer keeps its link into /explore's own section.
assert.ok(home.includes('href="#request-url"'), "The hero's submit button anchors to the form on the current page");
assert.match(home, /href: "\/explore#sites"/, "The landing page's section keys point into /explore");
for (const jump of ["cool-sites", "cool-apis", "cool-apps", "cool-ais"]) {
  assert.ok(home.includes(`href: "/explore#${jump}"`), `The landing page's keys include the ${jump} section`);
}
// Editor's picks is the landing page's now, and only the landing page's, so no
// key offers a hash /explore does not have. No-code AI tools has a key, and it
// is the one that leaves for a section's own page.
assert.ok(!home.includes('href: "/explore#editors-picks"'), "No key opens a section /explore no longer has");
assert.ok(home.includes('href: "/explore/no-code-ai-tools"'), "The landing page's keys include the no-code AI tools section");
assert.equal((home.match(/<EditorsPicks \/>/g) || []).length, 1, "Only the landing page renders the editor's picks");
assert.ok(home.includes("href={`/tags/${info.slug}`}"), "The landing page links the real tag pages, not a lookup page");

// A search decides what is on screen: the closest matches first, then only the
// sections that actually hold a result.
assert.ok(home.includes("<BestMatches query={query} />"), "A search answers with the best matches first");
assert.ok(home.includes("new Set(sectionsWithMatches(query))"), "The page renders only the sections a search leaves standing");
for (const guard of ["showSites", "showCoolSites", "showCoolApis", "showCoolApps", "showCoolAis"]) {
  assert.ok(home.includes(`${guard} &&`), `An empty section is not rendered: ${guard}`);
}

// The rule itself, run rather than read: browsing keeps every section, a
// matching search keeps the ones that match, and a search that matches nothing
// keeps none of them — not even an empty heading.
const sections = load("lib/sections.ts");
const everySection = sections.directorySections.map((section) => section.id);
assert.deepEqual(sections.sectionsWithMatches(""), everySection, "Browsing shows every section, in page order");
assert.deepEqual(sections.sectionsWithMatches("   "), everySection, "A blank query is not a search");
assert.deepEqual(sections.sectionsWithMatches("gemni"), ["cool-ais"], "A search keeps only the sections that hold a match");
assert.deepEqual(sections.sectionsWithMatches("#openai"), ["cool-ais"], "An exact-tag search keeps its own section alone");
assert.deepEqual(sections.sectionsWithMatches("no-such-pick-123"), [], "A search that matches nothing renders no section at all");
assert.ok(everySection.every((id) => sections.sectionById(id)), "Every section id resolves to its description");
assert.equal(sections.sectionCount("cool-apis"), JSON.parse(fs.readFileSync("config/cool-apis.json", "utf8")).length, "A section's count is its own list");
for (const section of sections.directorySections) {
  assert.ok(section.filterField === "category" || section.filterField === "tag", `${section.id} must say what its filter chips narrow`);
  assert.ok(section.filters.length > 0, `${section.id} needs at least one filter chip`);
  assert.equal(new Set(section.items.map((item) => item.url)).size, section.items.length, `${section.id} lists a URL twice`);
  // Every chip has to be a filter that keeps something, or the subsite offers a
  // button that empties its own list.
  for (const filter of section.filters) {
    const keeps = section.filterField === "category"
      ? section.items.some((item) => item.category === filter)
      : section.items.some((item) => item.tags.includes(filter));
    assert.ok(keeps, `${section.id} offers a "\${filter}" chip that matches nothing`);
  }
}

// The prose half of the landing page, in order: About, then Support directly
// under it, then the board, the FAQ and the countdown that closes it out.
const aboutAt = home.indexOf("<AboutSection />");
const supportAt = home.indexOf("<SupportSection />");
const boardAt = home.indexOf("<DiscussionBoard />");
const faqAt = home.indexOf("<Faq />");
const clockAt = home.indexOf("<LaunchClock />");
const subscribeAt = home.indexOf("<DirectoryNotifications />");
assert.ok(
  aboutAt >= 0 && aboutAt < supportAt && supportAt < boardAt && boardAt < faqAt && faqAt < clockAt && clockAt < subscribeAt,
  "The landing page runs About, Support, the board, the FAQ and the countdown, in that order",
);

// The top ten is built from the shared vote totals every card already reads, and
// it never invents a figure: an entry nobody has voted on says so.
const topTen = fs.readFileSync("components/top-ten.tsx", "utf8");
assert.ok(topTen.includes("useSiteVotes(CANDIDATE_KEYS)"), "The top ten ranks real shared vote totals");
assert.ok(topTen.includes("rankByVotes(CANDIDATES, totals, RANKS)"), "The top ten uses the same ranking rule as /stats and the strips");
assert.ok(topTen.includes("no votes yet"), "An unvoted entry shows no count rather than a made-up one");
assert.ok(topTen.includes('id="top-ten"'), "The top ten owns a section a rail link can name");

// A fire is worth ten votes and has a clock on it. Nothing stores a score to
// decrement later: the Worker keeps the timestamps the fires were cast at and
// drops the expired ones as it reads them, so a boost runs out on its own.
assert.equal(FIRE_VOTE_WEIGHT, 10, "A fire is worth ten votes");
assert.equal(totalVotes({ up: 0, down: 0, fires: 1 }), 10, "One fire counts as ten votes");
assert.equal(totalVotes({ up: 3, down: 2, fires: 2 }), 25, "Fires add to the thumbs rather than replacing them");
assert.equal(totalVotes({ up: 1, down: 1 }), 2, "A key with no fires on it ranks exactly as it always did");
assert.ok(compareVotes({ up: 0, down: 0, fires: 1 }, { up: 9, down: 0 }) < 0, "One fire outranks nine thumbs");
assert.ok(compareVotes({ up: 0, down: 0, fires: 2 }, { up: 12, down: 0 }) < 0, "Two fires outrank twelve thumbs");
assert.ok(compareVotes({ up: 0, down: 0, fires: 1 }, { up: 10, down: 0 }) > 0, "A fire is not worth more than the ten votes it is worth");
// `workerSource` above already holds the Worker's source.
assert.ok(workerSource.includes('url.pathname === "/fire"'), "The Worker owns a fire route");
assert.ok(workerSource.includes("const FIRE_WINDOW_MS = 24 * 60 * 60 * 1000"), "A fire is worth its ten votes for exactly one day");
assert.match(workerSource, /value > cutoff/, "Expired fires are dropped as they are read, not swept up later");
assert.ok(workerSource.includes("return { up, down, fires: fires.length }"), "Every vote read carries the live fire count with it");
assert.ok(workerSource.includes("prefix: FIRE_PREFIX"), "/stats folds the fires in with the votes");

// The fire button is drawn once and spent for a day per visitor; the browser's
// own half of that rule lives beside the votes it is shown with.
const siteVotesSource = fs.readFileSync("components/site-votes.tsx", "utf8");
assert.ok(siteVotesSource.includes("${counterUrl}/fire"), "The shared vote component posts a fire");
assert.ok(siteVotesSource.includes("export function FireButton("), "The fire button is drawn in exactly one place");
assert.equal((home.match(/<FireButton/g) || []).length, 1, "An /explore card carries the fire button too");
assert.ok(home.includes("isFireActive(fireStamps, site.subdomain)"), "A card's fire is spent for the visitor who cast it");
const firesSource = fs.readFileSync("lib/fires.ts", "utf8");
assert.ok(firesSource.includes('"base31-fires"'), "The visitor's own fires are remembered beside their votes");
const { isFireActive, FIRE_WINDOW_MS } = load("lib/fires.ts");
assert.equal(isFireActive({ a: 1000 }, "a", 1000 + FIRE_WINDOW_MS - 1), true, "A fire still counts a moment before its day is up");
assert.equal(isFireActive({ a: 1000 }, "a", 1000 + FIRE_WINDOW_MS), false, "A fire stops counting when its day is up");
assert.equal(isFireActive({}, "a"), false, "Nothing is fired to begin with");

// The visitor's half of the reset, against a stub storage: an old stamp is
// dropped as it is read, so a spent button comes back by itself the next day
// rather than needing anything to clear it.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)); },
  removeItem: (key) => { memory.delete(key); },
};
const fireStore = load("lib/fires.ts");
assert.deepEqual(fireStore.readFireStamps(10_000), {}, "Nothing is remembered to begin with");
fireStore.stampFire("external:example.com:2", 10_000);
assert.equal(fireStore.readFireStamps(10_000)["external:example.com:2"], 10_000, "A fire is remembered where the button reads it");
assert.equal(fireStore.fireHoursLeft(fireStore.readFireStamps(10_000), "external:example.com:2", 10_000), 24, "A fresh fire has a whole day to run");
assert.equal(fireStore.fireHoursLeft(fireStore.readFireStamps(10_000), "external:example.com:2", 10_000 + FIRE_WINDOW_MS), 0, "A fire that has run out has nothing left");
assert.deepEqual(fireStore.readFireStamps(10_000 + FIRE_WINDOW_MS), {}, "Once its day is up the stamp is dropped and the button is live again");
delete globalThis.localStorage;

// `POST /fire` is worth ten votes for a day and then nothing at all, and the
// only way to be sure is to run it: the Worker is loaded here and called
// in-process over a Map-backed KV binding, so no deployment and no network are
// involved. The day is ended by ageing the stored timestamps, which is the only
// state the route ever reads.
const kvStore = new Map();
const workerEnv = {
  VIEW_COUNTER: {
    get: async (key) => (kvStore.has(key) ? kvStore.get(key) : null),
    put: async (key, value) => { kvStore.set(key, String(value)); },
    delete: async (key) => { kvStore.delete(key); },
    list: async ({ prefix = "", cursor } = {}) => ({
      keys: [...kvStore.keys()].filter((key) => key.startsWith(prefix)).sort().map((name) => ({ name })),
      list_complete: true,
      cursor: undefined,
    }),
  },
};
const workerHandler = loadWorker("worker/src/index.ts").default;
const workerFetch = (path, init) => workerHandler.fetch(new Request(`https://test.invalid${path}`, init), workerEnv);
const workerPost = (path, body) => workerFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const FIRED_KEY = "external:example.com:1";
const firesOn = async () => (await (await workerFetch(`/votes?keys=${encodeURIComponent(FIRED_KEY)}`)).json()).votes[FIRED_KEY];

assert.deepEqual(await (await workerPost("/fire", { key: FIRED_KEY })).json(), { key: FIRED_KEY, up: 0, down: 0, fires: 1 }, "A fire comes back with the totals it produced");
assert.equal((await (await workerPost("/fire", { key: FIRED_KEY })).json()).fires, 2, "A second fire adds a second ten votes");
assert.equal((await workerPost("/fire", { key: "not a key!" })).status, 400, "A fire needs a key the directory would actually use");
assert.equal((await workerFetch("/fire")).status, 405, "A fire is a POST and nothing else");
assert.deepEqual(await (await workerPost("/vote", { key: FIRED_KEY, from: 0, to: 1 })).json(), { key: FIRED_KEY, up: 1, down: 0, fires: 2 }, "A vote answers with the fire count beside the thumbs, so one round trip is enough");
assert.deepEqual(await firesOn(), { up: 1, down: 0, fires: 2 }, "The bulk read the cards make carries the fire count too");
assert.deepEqual((await (await workerFetch("/stats?days=7")).json()).top[0], { key: FIRED_KEY, up: 1, down: 0, fires: 2 }, "/stats ranks through the same totals, fires included");

// And then the day ends: both fires stop counting on their own, with nothing to
// decrement and no sweep to run.
kvStore.set(`fires:${FIRED_KEY}`, JSON.stringify([Date.now() - FIRE_WINDOW_MS - 1, Date.now() - FIRE_WINDOW_MS - 1]));
assert.deepEqual(await firesOn(), { up: 1, down: 0, fires: 0 }, "A fire older than its day has stopped counting");
assert.equal(totalVotes(await firesOn()), 1, "With no live fire an entry ranks on its thumbs alone");
kvStore.set(`fires:${FIRED_KEY}`, JSON.stringify([Date.now() - FIRE_WINDOW_MS - 1, Date.now() - 1_000]));
assert.deepEqual(await firesOn(), { up: 1, down: 0, fires: 1 }, "Only the fires still inside their day are counted");

// The trending board shows the fire as a marker only: the act of firing belongs
// on the card, where the visitor is already looking at one site.
assert.ok(topTen.includes('className="top-ten-fire"'), "A boosted row carries the fire emoji");
assert.ok(!topTen.includes("<FireButton"), "The trending board marks the fire rather than offering it");
assert.match(fs.readFileSync("app/directory.css", "utf8"), /\.top-ten-name-row \{/, "The name and its fire share a line");

// The website of the week lost the little tinted box with the glyph in it.
// `weeklySource` above already holds the weekly pick's source.
assert.ok(!weeklySource.includes("weekly-pick-mark"), "The weekly pick's heading is just the title and the week");
assert.ok(!fs.readFileSync("app/directory.css", "utf8").includes(".weekly-pick-mark"), "The removed mark's style rule is gone with it");

// The site web: the whole directory as one branching map at the foot of the
// landing page, built from the registry and the entry list rather than from a
// hand-kept list, so a new config entry appears on the next publish.
const siteWeb = fs.readFileSync("components/site-web.tsx", "utf8");
const siteWebCode = siteWeb.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
assert.ok(siteWeb.includes('id="site-web"'), "The site web owns a section a rail link can name");
assert.ok(siteWeb.includes("directorySections.map") && siteWeb.includes("for (const entry of directoryEntries)"), "The web is built from the registry and the entry list");
assert.ok(!siteWebCode.includes("Math.random") && !siteWebCode.includes("Date.now"), "The web's geometry is hashed, so the server and the browser draw the same picture");
assert.ok(siteWeb.includes("href={`/sites/${leaf.slug}`}") && siteWeb.includes("href={`/explore/${hub.id}`}"), "Every node in the web is a real link to its own page");
assert.ok(fs.readFileSync("app/late.css", "utf8").includes('html[data-motion="enabled"] .site-web-leaf-dot'), "The map's idle drift waits for motion to be allowed");
assert.equal((home.match(/<SiteWeb \/>/g) || []).length, 1, "The landing page renders the web once");
assert.ok(home.includes('{ id: "site-web", label: "The web" }'), "The rail walks the page and names the web");

// SEO: the question people really ask about the useless web is answered on the
// page, repeated in the FAQPage structured data, and spelled out for an
// assistant in llms.txt. Nothing is claimed that the directory cannot show.
const faqSource = fs.readFileSync("components/faq.tsx", "utf8");
assert.ok(faqSource.toLowerCase().includes("the useless web"), "The FAQ answers the useless-web question");
assert.ok(faqSource.includes('className="sr-only"'), "The FAQ carries the hidden repeat of that copy");
assert.ok(fs.readFileSync("public/llms.txt", "utf8").toLowerCase().includes("the useless web"), "llms.txt tells an assistant what the useless web is");
assert.ok(fs.readFileSync("app/layout.tsx", "utf8").includes('"the useless web"'), "The root metadata covers the phrase");

// The submission box no longer claims a private review queue, and the rule
// that styled that line went with it.
const urlRequestSource = fs.readFileSync("components/url-request.tsx", "utf8");
assert.ok(!urlRequestSource.includes("Private review queue"), "The submission box no longer claims a private review queue");
assert.ok(!fs.readFileSync("app/directory.css", "utf8").includes(".url-submission-note"), "The removed note's style rule is gone too");

// The confirm-to-close leave warning is gone; the two quiet behaviors stay.
const behaviors = fs.readFileSync("components/page-behaviors.tsx", "utf8");
assert.ok(!behaviors.includes("beforeunload"), "The confirm-to-close leave warning is removed");
assert.ok(behaviors.includes("wakeLock.request"), "Screen Wake Lock stays");
assert.ok(behaviors.includes("base31:scroll:"), "Scroll-position resume stays");

// The landing page's way into the directory is centred on the hero.
assert.match(fs.readFileSync("app/directory.css", "utf8"), /\.explore-cta \{[^}]*margin: 30px auto 0;/, "The Explore the directory button is centred");
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

// Bug reports and feature ideas are an inbox item now, not an email: the route
// files them with the Worker, and the moderation page reads and dismisses them
// beside the URL suggestions.
const bugReportRoute = fs.readFileSync("app/api/bug-report/route.ts", "utf8");
assert.ok(!bugReportRoute.includes("api.resend.com"), "The report route no longer emails the report");
assert.ok(bugReportRoute.includes("/report`"), "The report route files the report with the Worker");
assert.ok(adminSource.includes("setReports([])"), "Signing out must clear the report inbox too");
assert.ok(adminSource.includes('kind: "report"'), "A report can be dismissed from the inbox");
const workerIndexSource = fs.readFileSync("worker/src/index.ts", "utf8");
assert.ok(workerIndexSource.includes('url.pathname === "/report"'), "The Worker owns the report route");
assert.ok(workerIndexSource.includes("REPORT_PREFIX"), "Reports are stored under their own key prefix");
assert.match(workerIndexSource, /reports: reports\.sort\(/, "The admin data lists the reports newest-first");

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

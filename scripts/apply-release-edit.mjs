// One-off release edit for the "No-code AI tools" release (1.38.0).
//
// It exists because three files — components/home-page.tsx, app/late.css and
// app/overrides.css — were emptied by the previous commit (1d09889) while their
// real contents only exist in earlier history. Rather than retype 220 KB of
// source by hand, this script restores those files byte-for-byte from history
// and then applies the release's edits as exact string replacements, failing
// loudly if any anchor is missing.
//
// It runs once from .github/workflows/apply-release-edit.yml, which commits and
// pushes the result only after `npm run validate:content`, the directory tests
// and `tsc --noEmit` pass.

import fs from "node:fs";
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
let editCount = 0;

const read = (path) => fs.readFileSync(path, "utf8");
const write = (path, text) => {
  fs.writeFileSync(path, text);
  editCount += 1;
  console.log(`  ok ${path}`);
};

/** Exactly one occurrence of `from`, replaced by `to`. */
function replaceOnce(file, from, to) {
  const parts = read(file).split(from);
  if (parts.length !== 2) throw new Error(`${file}: expected 1 occurrence of ${JSON.stringify(from.slice(0, 70))}, found ${parts.length - 1}`);
  write(file, parts.join(to));
}

/** `expected` occurrences of `from`, each replaced by `to`. */
function replaceEvery(file, from, to, expected) {
  const parts = read(file).split(from);
  if (parts.length - 1 !== expected) throw new Error(`${file}: expected ${expected} occurrences of ${JSON.stringify(from.slice(0, 70))}, found ${parts.length - 1}`);
  write(file, parts.join(to));
}

/** The one line containing `needle`; `indent` copies its leading whitespace. */
function insertAfterLine(file, needle, newLines, indent = "") {
  const text = read(file);
  const lines = text.split("\n");
  const hits = lines.map((line, index) => (line.includes(needle) ? index : -1)).filter((index) => index >= 0);
  if (hits.length !== 1) throw new Error(`${file}: expected 1 line containing ${JSON.stringify(needle.slice(0, 70))}, found ${hits.length}`);
  const padding = indent === "keep" ? lines[hits[0]].match(/^\s*/)[0] : indent;
  lines.splice(hits[0] + 1, 0, ...newLines.map((line) => padding + line));
  write(file, lines.join("\n"));
}

/** Removes the one line containing `needle`. */
function removeLine(file, needle) {
  const text = read(file);
  const lines = text.split("\n");
  const hits = lines.map((line, index) => (line.includes(needle) ? index : -1)).filter((index) => index >= 0);
  if (hits.length !== 1) throw new Error(`${file}: expected 1 line containing ${JSON.stringify(needle.slice(0, 70))}, found ${hits.length}`);
  lines.splice(hits[0], 1);
  write(file, lines.join("\n"));
}

/** Replaces the span of lines from the one containing `start` through the one
    containing `end` (both inclusive) with `newLines`. */
function replaceBlock(file, start, end, newLines) {
  const text = read(file);
  const lines = text.split("\n");
  const startIndex = lines.findIndex((line) => line.includes(start));
  const endIndex = lines.findIndex((line, index) => index >= startIndex && line.includes(end));
  if (startIndex < 0 || endIndex < startIndex) throw new Error(`${file}: could not find the ${JSON.stringify(start.slice(0, 60))} ... ${JSON.stringify(end.slice(0, 60))} block`);
  lines.splice(startIndex, endIndex - startIndex + 1, ...newLines);
  write(file, lines.join("\n"));
}

// ---------------------------------------------------------------------------
// 1. Restore the files the previous commit emptied, from the newest commit that
//    still had real content for each path.
// ---------------------------------------------------------------------------
const CLOBBERED = ["app/late.css", "app/overrides.css", "components/home-page.tsx"];
for (const path of CLOBBERED) {
  const commits = git("rev-list", "HEAD", "--", path).trim().split("\n").filter(Boolean);
  let restored = false;
  for (const sha of commits) {
    let size = 0;
    try { size = Number(git("cat-file", "-s", `${sha}:${path}`).trim()); } catch { size = 0; }
    if (size > 0) {
      write(path, git("show", `${sha}:${path}`));
      console.log(`  (restored from ${sha.slice(0, 7)}, ${size} bytes)`);
      restored = true;
      break;
    }
  }
  if (!restored) throw new Error(`No non-empty version of ${path} in history`);
}

// ---------------------------------------------------------------------------
// 2. Wire the new "No-code AI tools" strip into the homepage.
// ---------------------------------------------------------------------------
const homePage = "components/home-page.tsx";
insertAfterLine(homePage, 'import CoolAis from "@/components/cool-ais";', [
  'import NoCodeAiTools from "@/components/no-code-ai-tools";',
  'import { allNoCodeAiTools, searchNoCodeAiTools } from "@/lib/no-code-ai-tools";',
]);
insertAfterLine(homePage, '{ id: "cool-ais", label: dict.coolAis },', [
  '    { id: "no-code-ai-tools", label: dict.noCodeAiTools },',
]);
replaceOnce(
  homePage,
  "? searchCoolSites(query).length + searchCoolApis(query).length + searchCoolApps(query).length + searchCoolAis(query).length",
  "? searchCoolSites(query).length + searchCoolApis(query).length + searchCoolApps(query).length + searchCoolAis(query).length + searchNoCodeAiTools(query).length",
);
insertAfterLine(homePage, '{ href: "#cool-ais", label: dict.coolAis, count: `', [
  '{ href: "#no-code-ai-tools", label: dict.noCodeAiTools, count: `' + '${allNoCodeAiTools.length} tools` },',
], "keep");
replaceOnce(
  homePage,
  "{/* Five boxes that jump straight into a section, for the visitor who",
  "{/* The boxes that jump straight into a section, for the visitor who",
);
insertAfterLine(homePage, "<CoolAis dict={dict} query={query} />", [
  "{/* A fifth strip: the AI tools that build the app or site for you, for",
  "    the visitor who has an idea but writes no code. */}",
  "<NoCodeAiTools dict={dict} query={query} />",
], "keep");

// ---------------------------------------------------------------------------
// 3. About Us / Our Story: smaller, flatter, less shouty, plus the submit box
//    loses its eyebrow line and its arrow badge.
// ---------------------------------------------------------------------------
replaceBlock(
  "app/directory.css",
  "/* About and support paths stay visible without competing with the directory. */",
  "@media (prefers-reduced-motion: reduce) { .about-page-links",
  [
    "/* About and support paths stay visible without competing with the directory.",
    "   Kept deliberately quiet: a slim row under the prose, not two calls to",
    "   action — flat surface, hairline border, no lift, no coloured glow. */",
    ".about-page-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; max-width: 440px; margin: 18px 0; }",
    ".about-page-links .about-page-card { --card-accent: var(--live); position: relative; display: flex; align-items: center; gap: 9px; min-height: 52px; padding: 8px 11px; overflow: hidden; border: 1px solid var(--line); border-radius: 11px; background: var(--surface); color: var(--text-strong); text-decoration: none; transition: border-color .2s, background .2s; }",
    ".about-page-links .about-page-card.is-story { --card-accent: var(--accent-sky, #5ab4ff); }",
    ".about-page-links .about-page-card:hover, .about-page-links .about-page-card:focus-visible { border-color: var(--line-strong); background: color-mix(in srgb, var(--card-accent) 4%, var(--surface)); outline: none; }",
    ".about-page-icon { display: grid; flex: 0 0 auto; place-items: center; width: 25px; height: 25px; border: 1px solid color-mix(in srgb, var(--card-accent) 20%, var(--line)); border-radius: 7px; background: color-mix(in srgb, var(--card-accent) 6%, var(--surface)); color: color-mix(in srgb, var(--card-accent) 70%, var(--muted)); }",
    ".about-page-icon svg { width: 13px; height: 13px; }",
    ".about-page-text { display: flex; flex: 1; flex-direction: column; gap: 1px; min-width: 0; }",
    ".about-page-label { color: var(--text); font-size: 12px; font-weight: 500; letter-spacing: -.005em; }",
    ".about-page-sub { color: var(--muted); font-size: 10.5px; line-height: 1.3; }",
    ".about-page-arrow { color: var(--muted); font-size: 13px; transition: transform .2s; }",
    ".about-page-card:hover .about-page-arrow { transform: translateX(2px); }",
    "@media (prefers-reduced-motion: reduce) { .about-page-links .about-page-card, .about-page-arrow { transition: none; } }",
  ],
);
removeLine("app/directory.css", ".url-submission-mark { display: grid;");
removeLine("app/directory.css", ".url-submission .eyebrow { font-size: 10px;");
removeLine("app/directory.css", ".url-submission-mark { margin-bottom: 18px; }");
removeLine("components/url-request.tsx", '<span className="url-submission-mark mono" aria-hidden="true">↗</span>');
removeLine("components/url-request.tsx", '<p className="eyebrow mono">good finds deserve company</p>');

// ---------------------------------------------------------------------------
// 4. Dictionary entries for the new strip, in all four locales.
// ---------------------------------------------------------------------------
const i18n = "lib/i18n.ts";
insertAfterLine(i18n, 'coolAisNoMatch: "No AI tools match that search — clear it to see them all.",', [
  '  noCodeAiTools: "No-code AI tools",',
  "  noCodeAiToolsLede:",
  '    "AI tools that build the thing for you — apps, websites, portals and automations — for people with an idea and no code to type. Plans and limits vary; check what each one costs before you commit.",',
  '  noCodeAiToolsClosed: "The no-code AI tools are folded away — open the heading to see them.",',
  '  noCodeAiToolsNoMatch: "No no-code AI tool matches that search — clear it to see them all.",',
]);
insertAfterLine(i18n, 'coolAisNoMatch: "Ninguna IA coincide: borra la búsqueda para verlas todas.",', [
  '  noCodeAiTools: "Herramientas de IA sin código",',
  "  noCodeAiToolsLede:",
  '    "Herramientas de IA que construyen la app, el sitio, el portal o la automatización por ti: para quien tiene una idea y no escribe código. Los planes y límites varían; revisa el precio antes de decidir.",',
  '  noCodeAiToolsClosed: "Las herramientas de IA sin código están plegadas: abre el título para verlas.",',
  '  noCodeAiToolsNoMatch: "Ninguna herramienta de IA sin código coincide: borra la búsqueda para verlas todas.",',
]);
insertAfterLine(i18n, 'coolAisNoMatch: "Aucune IA ne correspond — effacez la recherche pour toutes les voir.",', [
  '  noCodeAiTools: "Outils IA sans code",',
  "  noCodeAiToolsLede:",
  '    "Des outils IA qui construisent l’application, le site, le portail ou l’automatisation à votre place, pour qui a une idée sans écrire de code. Les offres et les limites varient ; vérifiez le prix avant de vous engager.",',
  '  noCodeAiToolsClosed: "Les outils IA sans code sont repliés — ouvrez le titre pour les voir.",',
  '  noCodeAiToolsNoMatch: "Aucun outil IA sans code ne correspond — effacez la recherche pour tous les voir.",',
]);
insertAfterLine(i18n, 'coolAisNoMatch: "Nenhuma IA corresponde — limpe a pesquisa para ver todas.",', [
  '  noCodeAiTools: "Ferramentas de IA sem código",',
  "  noCodeAiToolsLede:",
  '    "Ferramentas de IA que constroem o app, o site, o portal ou a automação por você — para quem tem uma ideia e não escreve código. Planos e limites variam; confira o preço antes de decidir.",',
  '  noCodeAiToolsClosed: "As ferramentas de IA sem código estão recolhidas — abra o título para vê-las.",',
  '  noCodeAiToolsNoMatch: "Nenhuma ferramenta de IA sem código corresponde — limpe a pesquisa para vê-las todas.",',
]);

// ---------------------------------------------------------------------------
// 5. Give the new list detail pages, the sitemap and the tag index.
// ---------------------------------------------------------------------------
insertAfterLine("lib/directory.ts", 'import coolAis from "@/config/cool-ais.json";', [
  'import noCodeAi from "@/config/no-code-ai.json";',
]);
insertAfterLine("lib/directory.ts", '{ items: coolAis, prefix: "ais", section: "Cool AIs", sectionId: "cool-ais" },', [
  '  { items: noCodeAi, prefix: "nocodeai", section: "No-code AI tools", sectionId: "no-code-ai-tools" },',
]);

// ---------------------------------------------------------------------------
// 6. SEO and AI SEO: schema for the new list, a sitelinks search box, extra
//    metadata, and the search indexes the tests watch.
// ---------------------------------------------------------------------------
const structured = "components/structured-data.tsx";
replaceOnce(
  structured,
  '          availableLanguage: ["en", "es", "fr", "pt"],\n        },\n      },',
  '          availableLanguage: ["en", "es", "fr", "pt"],\n        },\n' + [
    "        // What the publisher is an authority on, in the words search and",
    "        // answer engines use to match a question to a source.",
    "        knowsAbout: [",
    '          "website directories",',
    '          "cool and unusual websites",',
    '          "creative web projects",',
    '          "free browser tools",',
    '          "free public APIs",',
    '          "AI assistants",',
    '          "no-code AI app and website builders",',
    '          "the indie web",',
    "        ],",
  ].join("\n") + "\n      },",
);
insertAfterLine(structured, 'publisher: { "@id": `${siteUrl}/#organization` },', [
  "        // The homepage search is a real deep link: /?q=pomodoro opens the",
  "        // directory filtered to that query (the component reads `q` on mount),",
  "        // so declaring the sitelinks search box here is accurate rather than",
  "        // decorative.",
  "        potentialAction: {",
  '          "@type": "SearchAction",',
  '          target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/?q={search_term_string}` },',
  '          "query-input": "required name=search_term_string",',
  "        },",
]);

replaceOnce(
  "app/layout.tsx",
  '    types: { "application/rss+xml": "/blog/feed.xml", "application/feed+json": "/blog/feed.json" },',
  [
    "    types: {",
    '      "application/rss+xml": "/blog/feed.xml",',
    '      "application/feed+json": "/blog/feed.json",',
    "      // The plain-text map of the site written for AI assistants and answer",
    "      // engines. Advertised here so a crawler that would never guess at",
    "      // /llms.txt can still find it.",
    '      "text/plain": "/llms.txt",',
    "    },",
  ].join("\n"),
);
insertAfterLine("app/layout.tsx", 'manifest: "/manifest.webmanifest",', [
  '  applicationName: "base31.org",',
  '  category: "technology",',
  '  authors: [{ name: "base31.org", url: siteUrl }],',
  '  creator: "base31.org",',
  '  publisher: "base31.org",',
]);
replaceOnce(
  "app/layout.tsx",
  '  keywords: ["base31", "base31.org", "base 31", "website directory", "cool sites", "fun websites", "creative web projects", "indie web", "online tools", "interesting websites"],',
  '  keywords: ["base31", "base31.org", "base 31", "website directory", "cool sites", "fun websites", "creative web projects", "indie web", "online tools", "interesting websites", "no code ai tools", "no-code ai tools", "ai app builder", "ai website builder", "free browser tools", "free public apis"],',
);
replaceOnce(
  "app/about/page.tsx",
  "New entries are added with a short description and a few useful tags so visitors can quickly understand what they will find.</p>",
  "New entries are added with a short description and a few useful tags so visitors can quickly understand what they will find. Alongside the featured list, base31 also gathers other cool sites, free public APIs, browser apps, AI assistants, and no-code AI tools that build an app or a website from a description.</p>",
);

// ---------------------------------------------------------------------------
// 7. Keep the checks, docs and release history honest about the new strip.
// ---------------------------------------------------------------------------
replaceBlock(
  "scripts/validate-content.mjs",
  "// config/cool-sites.json, config/cool-apis.json and config/cool-apps.json back",
  "// lists carry the same shape, so they are checked by the same loop.",
  [
    "// config/cool-sites.json, config/cool-apis.json, config/cool-apps.json,",
    "// config/cool-ais.json and config/no-code-ai.json back the strips under the",
    '// directory ("Other cool sites", "Cool APIs", "Cool apps", "Cool AIs" and',
    '// "No-code AI tools"). All hold external URLs — deliberately not base31',
    "// subdomains — so the URL check rejects a hostname that looks like the",
    "// directory's own. The lists carry the same shape, so they are checked by the",
    "// same loop.",
  ],
);
insertAfterLine("scripts/validate-content.mjs", '{ file: "cool-ais.json", label: "Cool AI", count: 0 },', [
  '  { file: "no-code-ai.json", label: "No-code AI tool", count: 0 },',
]);
replaceEvery(
  "scripts/test-directory.mjs",
  '[["cool-sites", "searchCoolSites"], ["cool-apis", "searchCoolApis"], ["cool-apps", "searchCoolApps"]]) {',
  '[["cool-sites", "searchCoolSites"], ["cool-apis", "searchCoolApis"], ["cool-apps", "searchCoolApps"], ["no-code-ai-tools", "searchNoCodeAiTools"]]) {',
  2,
);
insertAfterLine("scripts/test-directory.mjs", 'assert.equal(directory.searchCoolAis("no-such-ai-tool-123").length, 0);', [
  '// The fifth strip, "No-code AI tools": same search contract as the other four.',
  'const noCodeAi = load("lib/no-code-ai-tools.ts");',
  'assert.ok(noCodeAi.searchNoCodeAiTools("lovable").some((entry) => entry.name === "Lovable"));',
  'assert.ok(noCodeAi.searchNoCodeAiTools("  NO-CODE  ").length > 0);',
  'assert.equal(noCodeAi.searchNoCodeAiTools("").length, 12);',
  'assert.equal(noCodeAi.searchNoCodeAiTools("no-such-no-code-tool-123").length, 0);',
  'assert.ok(entries.some((entry) => entry.sectionId === "no-code-ai-tools"), "The no-code AI tools must have detail pages");',
]);
replaceOnce("scripts/test-directory.mjs", "four external search indexes", "five external search indexes");
replaceOnce(
  "README.md",
  "- Search **Featured sites, Other cool sites, Cool APIs, Cool apps, and Cool AIs** by name, URL, description, category, or tags.",
  "- Search **Featured sites, Other cool sites, Cool APIs, Cool apps, Cool AIs, and No-code AI tools** by name, URL, description, category, or tags.",
);
insertAfterLine("README.md", "| `config/cool-ais.json` | Web AI assistants, research tools, creative services |", [
  "| `config/no-code-ai.json` | AI tools that build apps, websites, portals and automations without code |",
]);
replaceOnce("package.json", '"version": "1.37.0",', '"version": "1.38.0",');

// ---------------------------------------------------------------------------
// 8. Release note. The changelog is newest-first and its top version must match
//    package.json. Only the new entry is generated; every release already in the
//    file is left byte-for-byte alone.
// ---------------------------------------------------------------------------
const changelog = read("config/changelog.json");
if (!changelog.startsWith("[\n")) throw new Error("config/changelog.json no longer starts with an array");
if (changelog.includes('"version": "1.38.0"')) throw new Error("config/changelog.json already has the 1.38.0 entry");
// The note is built as an object and serialised with JSON.stringify, so the
// quotes inside the highlights are escaped exactly once and the block is
// indented to match the file's two-space style. Everything after it is left
// byte-for-byte alone.
const release = {
  version: "1.38.0",
  date: "2026-10-05",
  title: "No-code AI tools, a quieter submit box, and a map for AI crawlers",
  summary: "A fifth strip collects the AI tools that build apps, websites and automations without code. The submit-a-URL box loses its decorative eyebrow and arrow, About Us and Our Story step back to a slim row of links, and the site publishes explicit robots rules for AI crawlers plus /llms.txt.",
  highlights: [
    'A new "No-code AI tools" section lists twelve tools — Lovable, Bolt, v0, Replit, Base44, Framer, Durable, Hostinger Horizons, Glide, Softr, Zapier Agents and Gumloop — filed by category, filtered by the same chips as the other strips, reachable from the hero search and each with its own detail page.',
    'The submit-a-URL box opens straight on its heading: the "good finds deserve company" line and the ↗ badge are gone.',
    "About Us and Our Story are a slim, flat pair of links under the about prose instead of two glowing cards.",
    "SEO and AI SEO: robots.txt names the answer-engine crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended and others) welcome to read the directory, /llms.txt gives assistants a plain-text map of the site, the schema gains a sitelinks SearchAction, and the no-code AI tools ship as a SoftwareApplication ItemList in the sitemap and structured data.",
  ],
};
const releaseJson = JSON.stringify(release, null, 2).split("\n").map((line) => "  " + line).join("\n");
write("config/changelog.json", "[\n" + releaseJson + ",\n" + changelog.slice(2));

console.log(`\nApplied ${editCount} file edits.`);

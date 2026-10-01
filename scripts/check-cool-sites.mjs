// Plain Node ESM — run directly with `node`, no build step.
//
// Asks every entry in config/cool-sites.json, config/cool-apis.json and
// config/cool-apps.json for its URL and reports any that fail. All the lists
// ship external favicons on the homepage, so a dead link shows up as a broken
// tile before a visitor ever clicks it. Exit code stays 0 on failures for now (CI shows the warnings
// without blocking a deploy); flip `SOFT_FAIL` to true once the lists are
// battle-tested and a dead link should block the build.
import fs from "node:fs";
import path from "node:path";

const SOFT_FAIL = false;
const TIMEOUT_MS = 8000;

const root = process.cwd();
const lists = [
  { file: "cool-sites.json", label: "cool sites" },
  { file: "cool-apis.json", label: "cool APIs" },
  { file: "cool-apps.json", label: "cool apps" },
  { file: "cool-ais.json", label: "cool AIs" },
];

const check = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "base31.org link check (+https://base31.org)" },
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const results = [];
for (const list of lists) {
  const entries = JSON.parse(fs.readFileSync(path.join(root, "config", list.file), "utf8"));
  const checked = await Promise.all(
    entries.map(async (entry) => ({ name: entry.name, url: entry.url, ok: await check(entry.url) })),
  );
  results.push({ list: list.label, checked });
}

const failures = [];
for (const { list, checked } of results) {
  console.log(`\n${list}`);
  for (const result of checked) {
    console.log(`${result.ok ? "✓" : "✗"} ${result.name} — ${result.url}`);
    if (!result.ok) failures.push(result);
  }
}

if (failures.length > 0) {
  const names = failures.map((f) => f.name).join(", ");
  if (SOFT_FAIL) {
    console.error(`\n${failures.length} dead link(s): ${names}`);
    process.exit(1);
  }
  console.warn(`\n⚠ ${failures.length} unreachable (soft-fail, not blocking): ${names}`);
} else {
  console.log("\nAll external cool-site and cool-API links responded.");
}

// Plain Node ESM — run directly with `node`, no build step.
//
// Asks every site in config/cool-sites.json for its homepage and reports any
// that fail. Exit code stays 0 on failures for now (CI shows the warnings
// without blocking a deploy); flip `SOFT_FAIL` to true once the list is
// battle-tested and a dead link should block the build.
import fs from "node:fs";
import path from "node:path";

const SOFT_FAIL = false;
const TIMEOUT_MS = 8000;

const root = process.cwd();
const sites = JSON.parse(fs.readFileSync(path.join(root, "config", "cool-sites.json"), "utf8"));

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

const results = await Promise.all(
  sites.map(async (site) => ({ name: site.name, url: site.url, ok: await check(site.url) })),
);

const failures = results.filter((r) => !r.ok);
for (const result of results) {
  console.log(`${result.ok ? "✓" : "✗"} ${result.name} — ${result.url}`);
}

if (failures.length > 0) {
  const names = failures.map((f) => f.name).join(", ");
  if (SOFT_FAIL) {
    console.error(`\n${failures.length} dead link(s): ${names}`);
    process.exit(1);
  }
  console.warn(`\n⚠ ${failures.length} unreachable (soft-fail, not blocking): ${names}`);
} else {
  console.log("\nAll external cool-site links responded.");
}

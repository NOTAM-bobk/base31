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
  const localRequire = (id) => id.startsWith("@/") ? require(path.resolve(id.slice(2))) : require(id);
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
console.log(`Directory tests passed: ${entries.length} detail pages, four external search indexes, stable shared vote keys.`);

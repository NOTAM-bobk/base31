import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { WORDS, wordForDay, dayNumber } = require("../public/sites/wordoftheday/app.js");
assert.equal(WORDS.length, 30);
assert.equal(new Set(WORDS.map(word => word.word)).size, 30);
for (const word of WORDS) {
  for (const field of ["word", "phonetic", "partOfSpeech", "definition", "example"]) assert.ok(typeof word[field] === "string" && word[field].length > 0);
  assert.ok(Array.isArray(word.synonyms) && word.synonyms.length > 0);
}
const morning = new Date("2026-10-03T00:00:00Z"), evening = new Date("2026-10-03T23:59:59Z"), tomorrow = new Date("2026-10-04T00:00:00Z");
assert.equal(wordForDay(morning), wordForDay(evening));
assert.notEqual(wordForDay(evening), wordForDay(tomorrow));
assert.equal(wordForDay(morning), wordForDay(new Date(morning.getTime() + 30 * 86400000)));
assert.equal(dayNumber(tomorrow) - dayNumber(morning), 1);
assert.ok(wordForDay(new Date("1969-12-31T00:00:00Z")));
const script = fs.readFileSync("public/sites/wordoftheday/app.js", "utf8");
const html = fs.readFileSync("public/sites/wordoftheday/index.html", "utf8");
for (const [, id] of script.matchAll(/\$\("([^"]+)"\)/g)) assert.ok(html.includes(`id="${id}"`), `Missing word tool control: ${id}`);
assert.ok(!script.includes("fetch("), "Daily vocabulary must not wait on a remote API");
assert.ok(!script.includes("innerHTML"), "Saved words are rendered as safe text");
assert.ok(!html.includes("cdn.tailwindcss.com"), "Styles must not depend on a remote runtime");
for (const asset of ["app.js", "style.css"]) assert.ok(html.includes(`"${asset}"`) && fs.existsSync(`public/sites/wordoftheday/${asset}`));
console.log("Word of the Day tests passed: complete vocabulary, UTC rollover, 30-day cycle, independent assets and matching controls.");

// Plain Node ESM — this file must stay JavaScript (no TypeScript syntax)
// because it is run directly with `node`, not compiled.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, "config", file), "utf8"));

const sites = read("sites.json");
const posts = read("blogs.json");
const referrals = read("referrals.json");
const donations = read("donations.json");
const releases = read("changelog.json");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const date = /^\d{4}-\d{2}-\d{2}$/;
const https = /^https:\/\//;
const semver = /^\d+\.\d+\.\d+$/;
const errors = [];

const checkUnique = (values, label) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) errors.push(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
};

checkUnique(sites.map((site) => String(site.subdomain)), "site subdomain");
checkUnique(posts.map((post) => String(post.slug)), "blog slug");
checkUnique(referrals.map((referral) => String(referral.url)), "referral URL");
checkUnique(releases.map((release) => String(release.version)), "release version");

for (const [index, site] of sites.entries()) {
  if (typeof site.name !== "string" || !site.name.trim()) errors.push(`Site ${index + 1} needs a name`);
  if (typeof site.subdomain !== "string" || !slug.test(site.subdomain)) errors.push(`Site ${index + 1} has an invalid subdomain`);
  if (typeof site.url !== "string" || !https.test(site.url)) errors.push(`Site ${index + 1} needs an HTTPS URL`);
  if (typeof site.description !== "string" || site.description.trim().length < 20) errors.push(`Site ${index + 1} needs a useful description`);
  if (!Array.isArray(site.tags) || site.tags.length === 0) errors.push(`Site ${index + 1} needs at least one tag`);

  // Every entry is expected to ship its own favicon, since base31.org is the
  // one place that can serve it without a third-party request. Sites that
  // point at their own image are trusted to have made it themselves.
  const icon = typeof site.icon === "string" ? site.icon : `/site-icons/${site.subdomain}.svg`;
  if (!icon.startsWith("/")) {
    errors.push(`Site ${index + 1} has an icon outside this site (${icon}); use a path under public/`);
  } else if (!fs.existsSync(path.join(root, "public", icon))) {
    errors.push(`Site ${index + 1} is missing its favicon at public${icon} — add the file or set "icon"`);
  }
}

for (const [index, post] of posts.entries()) {
  if (typeof post.slug !== "string" || !slug.test(post.slug)) errors.push(`Blog post ${index + 1} has an invalid slug`);
  if (typeof post.title !== "string" || !post.title.trim()) errors.push(`Blog post ${index + 1} needs a title`);
  if (typeof post.description !== "string" || post.description.trim().length < 40) errors.push(`Blog post ${index + 1} needs a useful description`);
  if (typeof post.date !== "string" || !date.test(post.date) || Number.isNaN(Date.parse(post.date))) errors.push(`Blog post ${index + 1} has an invalid date`);
  if (!Array.isArray(post.body) || post.body.length < 3) errors.push(`Blog post ${index + 1} needs more content`);
}

for (const [index, referral] of referrals.entries()) {
  if (typeof referral.name !== "string" || !referral.name.trim()) errors.push(`Referral ${index + 1} needs a name`);
  if (typeof referral.url !== "string" || !https.test(referral.url)) errors.push(`Referral ${index + 1} needs an HTTPS URL`);
  if (typeof referral.description !== "string" || referral.description.trim().length < 20) errors.push(`Referral ${index + 1} needs a useful description`);
  if (referral.image !== undefined && (typeof referral.image !== "string" || !https.test(referral.image))) errors.push(`Referral ${index + 1} has an invalid image URL`);
}

for (const [index, donation] of donations.entries()) {
  if (typeof donation.name !== "string" || !donation.name.trim()) errors.push(`Donation ${index + 1} needs a name`);
  if (typeof donation.amount !== "number" || donation.amount <= 0) errors.push(`Donation ${index + 1} needs a positive amount`);
}

// config/changelog.json backs /whats-new. It is kept newest-first, and the
// newest entry is what the page's "latest" badge and the footer's version
// number both read, so a release must not be added without bumping
// package.json (or the footer would advertise a version the changelog does not
// describe).
for (const [index, release] of releases.entries()) {
  const at = `Release ${index + 1}`;
  if (typeof release.version !== "string" || !semver.test(release.version)) errors.push(`${at} has an invalid version`);
  if (typeof release.date !== "string" || !date.test(release.date) || Number.isNaN(Date.parse(release.date))) errors.push(`${at} has an invalid date`);
  if (typeof release.title !== "string" || !release.title.trim()) errors.push(`${at} needs a title`);
  if (typeof release.summary !== "string" || release.summary.trim().length < 20) errors.push(`${at} needs a useful summary`);
  if (!Array.isArray(release.highlights) || release.highlights.length === 0) {
    errors.push(`${at} needs at least one highlight`);
  } else if (release.highlights.some((line) => typeof line !== "string" || !line.trim())) {
    errors.push(`${at} has an empty highlight`);
  }
  if (index > 0 && releases[index - 1].date < release.date) {
    errors.push(`${at} (${release.version}) is newer than the entry above it; keep changelog.json newest-first`);
  }
}

if (releases.length > 0 && releases[0].version !== pkg.version) {
  errors.push(
    `package.json version (${pkg.version}) does not match the newest changelog entry (${releases[0].version}); bump both together`,
  );
}

// lib/tool-pages.ts backs the /tools/<slug> guides. It is TypeScript, so this
// reads it as text: the compiler is what enforces the shape of a field, and
// this is what enforces that every published site actually has a guide and that
// each guide carries copy instead of an empty array. The object literal's shape
// (two-space indented `slug: {` entries) is what the regexes below rely on.
const toolPagesSource = fs.readFileSync(path.join(root, "lib", "tool-pages.ts"), "utf8");
const toolPagesStart = toolPagesSource.indexOf("export const toolPages");
const toolPagesBody = toolPagesSource.slice(toolPagesStart, toolPagesSource.indexOf("\n};", toolPagesStart));

const guideBlocks = toolPagesBody
  // No `$` anchor here on purpose: without the `m` flag it would only match at
  // the end of the file and the split would return nothing.
  .split(/\n(?=  [a-z0-9-]+: \{)/)
  .map((chunk) => ({ slug: (chunk.match(/^\s*([a-z0-9-]+): \{/) || [])[1], text: chunk }))
  .filter((block) => block.slug);
const guideSlugs = guideBlocks.map((block) => block.slug);
const listedSlugs = sites.filter((site) => site.show !== false).map((site) => site.subdomain);

if (guideBlocks.length === 0) {
  errors.push("lib/tool-pages.ts has no readable entries; every /tools guide would be empty");
} else {
  for (const subdomain of listedSlugs) {
    if (!guideSlugs.includes(subdomain)) {
      errors.push(`Site "${subdomain}" is listed in sites.json but has no guide in lib/tool-pages.ts`);
    }
  }
  for (const slugName of guideSlugs) {
    if (!listedSlugs.includes(slugName)) {
      errors.push(`lib/tool-pages.ts has a guide for "${slugName}", which is not a listed site`);
    }
  }
}

for (const guide of guideBlocks) {
  const at = `Tool guide "${guide.slug}"`;
  if (!/\bheadline: "/.test(guide.text)) errors.push(`${at} needs a headline`);
  if (!/\bsummary: "/.test(guide.text)) errors.push(`${at} needs a summary line`);

  // Meta descriptions are what a search result shows, so keep them in the range
  // Google will actually display rather than truncate.
  const description = (guide.text.match(/metaDescription:\s*\n?\s*"([^"]+)"/) || [])[1] || "";
  if (description.length < 70 || description.length > 170) {
    errors.push(`${at} has a meta description of ${description.length} characters; keep it between 70 and 170`);
  }

  if ((guide.text.match(/\n      "/g) || []).length < 2) errors.push(`${at} needs at least two intro paragraphs`);
  if ((guide.text.match(/\{ title: "/g) || []).length < 3) errors.push(`${at} needs at least three features`);
  if ((guide.text.match(/\{ question: "/g) || []).length < 2) errors.push(`${at} needs at least two questions`);
}

if (errors.length > 0) {
  console.error(`Content validation failed:\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Content validation passed: ${sites.length} sites, ${posts.length} blog posts, ${referrals.length} referrals, ${donations.length} donations, ${releases.length} releases, ${guideBlocks.length} tool guides.`,
  );
}

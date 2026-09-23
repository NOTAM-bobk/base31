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

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const date = /^\d{4}-\d{2}-\d{2}$/;
const https = /^https:\/\//;
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

if (errors.length > 0) {
  console.error(`Content validation failed:\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Content validation passed: ${sites.length} sites, ${posts.length} blog posts, ${referrals.length} referrals, ${donations.length} donations.`,
  );
}

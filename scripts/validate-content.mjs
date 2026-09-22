import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sites = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8")) as Array<Record<string, unknown>>;
const posts = JSON.parse(fs.readFileSync(path.join(root, "config/blogs.json"), "utf8")) as Array<Record<string, unknown>>;

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const date = /^\d{4}-\d{2}-\d{2}$/;
const errors: string[] = [];

const checkUnique = (values: string[], label: string) => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
};

checkUnique(sites.map((site) => String(site.subdomain)), "site subdomain");
checkUnique(posts.map((post) => String(post.slug)), "blog slug");

for (const [index, site] of sites.entries()) {
  if (typeof site.name !== "string" || !site.name.trim()) errors.push(`Site ${index + 1} needs a name`);
  if (typeof site.subdomain !== "string" || !slug.test(site.subdomain)) errors.push(`Site ${index + 1} has an invalid subdomain`);
  if (typeof site.url !== "string" || !/^https:\/\//.test(site.url)) errors.push(`Site ${index + 1} needs an HTTPS URL`);
  if (typeof site.description !== "string" || site.description.trim().length < 20) errors.push(`Site ${index + 1} needs a useful description`);
  if (!Array.isArray(site.tags) || site.tags.length === 0) errors.push(`Site ${index + 1} needs at least one tag`);
}

for (const [index, post] of posts.entries()) {
  if (typeof post.slug !== "string" || !slug.test(post.slug)) errors.push(`Blog post ${index + 1} has an invalid slug`);
  if (typeof post.title !== "string" || !post.title.trim()) errors.push(`Blog post ${index + 1} needs a title`);
  if (typeof post.description !== "string" || post.description.trim().length < 40) errors.push(`Blog post ${index + 1} needs a useful description`);
  if (typeof post.date !== "string" || !date.test(post.date) || Number.isNaN(Date.parse(post.date))) errors.push(`Blog post ${index + 1} has an invalid date`);
  if (!Array.isArray(post.body) || post.body.length < 3) errors.push(`Blog post ${index + 1} needs more content`);
}

if (errors.length > 0) {
  console.error(`Content validation failed:\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Content validation passed: ${sites.length} sites, ${posts.length} JSON blog posts.`);
}

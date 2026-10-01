import sites from "@/config/sites.json";
import coolSites from "@/config/cool-sites.json";
import coolApis from "@/config/cool-apis.json";
import coolApps from "@/config/cool-apps.json";
import coolAis from "@/config/cool-ais.json";

export type DirectoryItem = {
  name: string; url: string; description: string; tags?: string[];
  category?: string; addedAt?: string; lastChecked?: string; createdAt?: number;
};
export type DirectoryEntry = DirectoryItem & { slug: string; section: string; sectionId: string; voteKey: string };
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Namespaced URL keys keep the same site's vote totals consistent across strips.
export function externalVoteKey(url: string) {
  const normalized = new URL(url);
  normalized.hash = "";
  const value = normalized.href.replace(/\/$/, "");
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `external:${normalized.hostname}:${(hash >>> 0).toString(16)}`;
}

const lists = [
  { items: coolSites, prefix: "sites", section: "Other cool sites", sectionId: "cool-sites" },
  { items: coolApis, prefix: "apis", section: "Cool APIs", sectionId: "cool-apis" },
  { items: coolApps, prefix: "apps", section: "Cool apps", sectionId: "cool-apps" },
  { items: coolAis, prefix: "ais", section: "Cool AIs", sectionId: "cool-ais" },
];
const entries: DirectoryEntry[] = [
  ...sites.filter((site) => site.show !== false).map((site) => ({
    ...site, slug: site.subdomain, section: "Featured sites", sectionId: "sites", voteKey: site.subdomain,
  })),
  ...lists.flatMap((list) => list.items.map((item) => ({
    ...item, slug: `${list.prefix}-${slugify(item.name)}${list.items.filter((other) => slugify(other.name) === slugify(item.name)).length > 1 ? `-${externalVoteKey(item.url).split(":").pop()}` : ""}`, section: list.section, sectionId: list.sectionId,
    voteKey: externalVoteKey(item.url),
  }))),
];
// Some legacy picks differ only by a trailing slash; publish one detail URL.
export const directoryEntries = entries.filter((entry, index) => entries.findIndex((other) => other.voteKey === entry.voteKey && other.sectionId === entry.sectionId) === index);
export const detailPath = (url: string, sectionId?: string) => {
  const item = directoryEntries.find((entry) => (entry.url === url || entry.voteKey === externalVoteKey(url)) && (!sectionId || entry.sectionId === sectionId));
  return item ? `/sites/${item.slug}` : null;
};
export const allCoolAis = coolAis;
export const coolAiCategories = [...new Set(coolAis.map((item) => item.category))];
export const searchCoolAis = (query: string) => {
  const needle = query.trim().toLowerCase();
  return coolAis.filter((item) => `${item.name} ${item.url} ${item.category} ${item.tags.join(" ")} ${item.description}`.toLowerCase().includes(needle));
};

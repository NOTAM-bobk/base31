import coolSites from "@/config/cool-sites.json";

// A hand-picked, off-directory link: a cool site that lives at its own
// address (not a base31.org subdomain). The list is edited purely through
// config/cool-sites.json — this module adds the types and the one search
// helper the homepage and the strip share, so the hero search matches these
// cards with the same rule in both places.
export type CoolSite = {
  name: string;
  url: string;
  tags: string[];
  description: string;
  /** The strip's filter chip. Coarser than `tags` on purpose: the free-form
      tags run to dozens of values, which would be a wall of chips, so each
      site is filed under one of the handful of categories below. */
  category: string;
};

export const allCoolSites = coolSites as CoolSite[];

/** The filter chips for the strip, busiest category first so the useful ones
    are leftmost (then alphabetical, so the order is stable between builds). */
export const coolSiteCategories: string[] = (() => {
  const counts = new Map<string, number>();
  for (const site of allCoolSites) counts.set(site.category, (counts.get(site.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category);
})();

/** Everything about a cool site that a search should look at, lowercased. */
const index = (site: CoolSite) => `${site.name} ${site.url} ${site.tags.join(" ")} ${site.description}`.toLowerCase();

/** The cool sites matching a hero-search query (all of them when it is empty). */
export const searchCoolSites = (query: string): CoolSite[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return allCoolSites;
  return allCoolSites.filter((site) => index(site).includes(needle));
};

export default allCoolSites;

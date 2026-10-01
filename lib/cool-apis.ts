import coolApis from "@/config/cool-apis.json";
import { matchesQuery } from "@/lib/search";

// A hand-picked, off-directory API: a free public service you can call from
// your own project (not a base31.org subdomain). The list is edited purely
// through config/cool-apis.json — this module adds the types and the search
// helper the homepage and the "Cool APIs" strip share, so the hero search
// matches these cards with the same rule in both places.
export type CoolApi = {
  name: string;
  url: string;
  tags: string[];
  description: string;
  /** The strip's filter chip. Coarser than `tags` on purpose: the free-form
      tags run to sixty-odd values, which would be a wall of chips, so each API
      is filed under one of the handful of categories below. */
  category: string;
  addedAt?: string;
  lastChecked?: string;
};

export const allCoolApis = coolApis as CoolApi[];

/** The filter chips for the strip, busiest category first so the useful ones
    are leftmost (then alphabetical, so the order is stable between builds). */
export const coolApiCategories: string[] = (() => {
  const counts = new Map<string, number>();
  for (const api of allCoolApis) counts.set(api.category, (counts.get(api.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category);
})();

/** The APIs matching a hero-search query (all of them when it is empty). */
export const searchCoolApis = (query: string): CoolApi[] => {
  return allCoolApis.filter((api) => matchesQuery(api, query));
};

export default allCoolApis;

import coolApps from "@/config/cool-apps.json";
import { matchesQuery } from "@/lib/search";

// A hand-picked browser app: something you open in a tab and use for a while.
// The list is edited purely through config/cool-apps.json — this module adds
// the types and the search helper the homepage and the "Cool apps" strip
// share, so the hero search matches these cards with the same rule in both
// places.
export type CoolApp = {
  name: string;
  url: string;
  tags: string[];
  description: string;
  /** The strip's filter chip. Coarser than `tags` on purpose: the free-form
      tags run to dozens of values, which would be a wall of chips, so each app
      is filed under one of the handful of categories below. */
  category: string;
  addedAt?: string;
  lastChecked?: string;
};

export const allCoolApps = coolApps as CoolApp[];

/** The filter chips for the strip, busiest category first so the useful ones
    are leftmost (then alphabetical, so the order is stable between builds). */
export const coolAppCategories: string[] = (() => {
  const counts = new Map<string, number>();
  for (const app of allCoolApps) counts.set(app.category, (counts.get(app.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category);
})();

/** The cool apps matching a hero-search query (all of them when it is empty). */
export const searchCoolApps = (query: string): CoolApp[] => {
  return allCoolApps.filter((app) => matchesQuery(app, query));
};

export default allCoolApps;

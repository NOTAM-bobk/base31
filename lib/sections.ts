import sites from "@/config/sites.json";
import { EN } from "@/lib/i18n";
import { allCoolSites, coolSiteCategories } from "@/lib/cool-sites";
import { allCoolApis, coolApiCategories } from "@/lib/cool-apis";
import { allCoolApps, coolAppCategories } from "@/lib/cool-apps";
import { allCoolAis, coolAiCategories } from "@/lib/directory";
import { allNoCodeAiTools, noCodeAiToolCategories } from "@/lib/no-code-ai-tools";
import { matchesQuery } from "@/lib/search";

// One section of the directory, described once.
//
// Every collection on /explore is listed here — its id (which is also the
// anchor on /explore and the slug of its own subsite at /explore/<id>), the
// heading and one-line description it prints, the unit its count is read in,
// and the whole set of cards it holds. The subsite route, the sitemap, the
// count on each key row and the rule that decides which sections a search
// leaves standing all read it here, so no page can describe a collection that
// does not exist.
//
// The two key rows and the phone drawer still spell out the sections they
// offer, because each also carries the count text and the href shape that suits
// its own page — `#sites` here, `/explore/sites` from the landing page. That is
// what `npm run test:directory` holds together: every hash the drawer offers has
// to be an id a section owns, and every one of those ids has to be an entry
// here. A seventh collection is therefore its config file, one entry below, and
// a key in each row.
//
// The filter chips come in two flavours and the registry says which one a
// section uses: the coarse `category` where the collection is filed under one
// (every off-directory strip), and the entry's own free-form tags where it is
// not (the featured sites). The subsite renders its chips without knowing
// which kind it was handed.
export type SectionItem = {
  name: string;
  url: string;
  description: string;
  tags: string[];
  category?: string;
  /** The base31 subdomain, on the featured sites only. Kept here so the shared
      search matches these cards exactly the way it matches them on /explore. */
  subdomain?: string;
  addedAt?: string;
  lastChecked?: string;
};

export type SectionDef = {
  /** The anchor on `/explore` and the slug of `/explore/<id>`. */
  id: string;
  label: string;
  lede: string;
  /** What the count line calls one card, e.g. "sites" or "links". */
  unit: string;
  filterField: "category" | "tag";
  filters: string[];
  items: SectionItem[];
};

/** The featured sites that are actually listed, in config order. */
const featuredSites = sites.filter((site) => site.show !== false);

/** The filter chips for the featured sites: their tags, busiest first so the
    useful ones are leftmost (then alphabetical, so the order is stable). */
const siteTags: string[] = (() => {
  const counts = new Map<string, number>();
  for (const site of featuredSites) {
    for (const tag of site.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
})();

/** The featured sites carry no coarse category, so their cards show their tags
    as the chip row instead; `filterField` says which field a chip narrows. */
const asSectionItem = (item: {
  name: string;
  url: string;
  description: string;
  tags?: string[];
  category?: string;
  subdomain?: string;
  addedAt?: string;
  lastChecked?: string;
}): SectionItem => ({
  name: item.name,
  url: item.url,
  description: item.description,
  tags: item.tags ?? [],
  ...(item.category ? { category: item.category } : {}),
  ...(item.subdomain ? { subdomain: item.subdomain } : {}),
  ...(item.addedAt ? { addedAt: item.addedAt } : {}),
  ...(item.lastChecked ? { lastChecked: item.lastChecked } : {}),
});

export const directorySections: SectionDef[] = [
  {
    id: "sites",
    label: EN.featured,
    lede: "The sites base31 hosts itself — small, single-purpose pages that live on their own base31.org subdomain, each with a guide and its own detail page.",
    unit: "sites",
    filterField: "tag",
    filters: siteTags,
    items: featuredSites.map(asSectionItem),
  },
  {
    id: "cool-sites",
    label: EN.coolSites,
    lede: EN.coolSitesLede,
    unit: EN.links,
    filterField: "category",
    filters: coolSiteCategories,
    items: allCoolSites.map(asSectionItem),
  },
  {
    id: "cool-apis",
    label: EN.coolApis,
    lede: EN.coolApisLede,
    unit: EN.links,
    filterField: "category",
    filters: coolApiCategories,
    items: allCoolApis.map(asSectionItem),
  },
  {
    id: "cool-apps",
    label: EN.coolApps,
    lede: EN.coolAppsLede,
    unit: EN.apps,
    filterField: "category",
    filters: coolAppCategories,
    items: allCoolApps.map(asSectionItem),
  },
  {
    id: "cool-ais",
    label: EN.coolAis,
    lede: EN.coolAisLede,
    unit: EN.apps,
    filterField: "category",
    filters: coolAiCategories,
    items: allCoolAis.map(asSectionItem),
  },
  {
    id: "no-code-ai-tools",
    label: EN.noCodeAiTools,
    lede: EN.noCodeAiToolsLede,
    unit: "tools",
    filterField: "category",
    filters: noCodeAiToolCategories,
    items: allNoCodeAiTools.map(asSectionItem),
  },
];

export const sectionById = (id: string): SectionDef | undefined =>
  directorySections.find((section) => section.id === id);

/** How many cards a section holds — the number its quick-jump reads. */
export const sectionCount = (id: string): number => sectionById(id)?.items.length ?? 0;

/**
 * The sections a search leaves standing, in page order.
 *
 * With no query that is every section, because browsing shows the whole
 * directory. With one, it is only the sections that hold at least one match:
 * /explore renders these and nothing else, so a question is answered by the
 * lists that answer it instead of by six headings and a row of "nothing here"
 * notes. This lives here rather than inline on the page so the rule the page
 * follows can be read — and tested — on its own.
 */
export const sectionsWithMatches = (query: string): string[] => {
  const asked = query.trim();
  if (!asked) return directorySections.map((section) => section.id);
  return directorySections
    .filter((section) => section.items.some((item) => matchesQuery(item, asked)))
    .map((section) => section.id);
};

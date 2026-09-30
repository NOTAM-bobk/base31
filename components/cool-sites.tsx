"use client";

import LinkStrip from "@/components/link-strip";
import { allCoolSites, coolSiteCategories, searchCoolSites } from "@/lib/cool-sites";
import { EN, type Dictionary } from "@/lib/i18n";

// The "Other cool sites" strip under the Featured sites directory. These are
// hand-picked sites that live at their own addresses — not base31 subdomains
// — edited purely through config/cool-sites.json. The strip itself (folding,
// counting, search, category chips, card markup) is shared with "Cool APIs";
// see components/link-strip.tsx.
export default function CoolSites({ dict = EN, query = "" }: { dict?: Dictionary; query?: string }) {
  return (
    <LinkStrip
      id="cool-sites"
      items={allCoolSites}
      search={searchCoolSites}
      query={query}
      categories={coolSiteCategories}
      copy={{
        heading: dict.coolSites,
        lede: dict.coolSitesLede,
        closed: dict.coolSitesClosed,
        noMatch: dict.coolSitesNoMatch,
        unit: dict.links,
        all: dict.allTag,
        filterLabel: dict.filterByCategory,
      }}
    />
  );
}

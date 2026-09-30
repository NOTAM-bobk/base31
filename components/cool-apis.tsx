"use client";

import LinkStrip from "@/components/link-strip";
import { allCoolApis, coolApiCategories, searchCoolApis } from "@/lib/cool-apis";
import { EN, type Dictionary } from "@/lib/i18n";

// The "Cool APIs" strip: free public APIs worth building something with,
// edited purely through config/cool-apis.json. Everything it renders — the
// folding heading, the count, the search and the card markup — is the shared
// strip in components/link-strip.tsx, the same one "Other cool sites" uses.
export default function CoolApis({ dict = EN, query = "" }: { dict?: Dictionary; query?: string }) {
  return (
    <LinkStrip
      id="cool-apis"
      items={allCoolApis}
      search={searchCoolApis}
      query={query}
      categories={coolApiCategories}
      copy={{
        heading: dict.coolApis,
        lede: dict.coolApisLede,
        closed: dict.coolApisClosed,
        noMatch: dict.coolApisNoMatch,
        unit: dict.links,
        all: dict.allTag,
        filterLabel: dict.filterByCategory,
      }}
    />
  );
}

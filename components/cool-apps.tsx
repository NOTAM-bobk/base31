"use client";

import LinkStrip from "@/components/link-strip";
import { allCoolApps, coolAppCategories, searchCoolApps } from "@/lib/cool-apps";
import { EN, type Dictionary } from "@/lib/i18n";

// The "Cool apps" strip: browser apps that are worth a tab, edited purely
// through config/cool-apps.json. Everything it renders — the folding heading,
// the count, the search and the card markup — is the shared strip in
// components/link-strip.tsx, the same one "Other cool sites" and "Cool APIs"
// use.
export default function CoolApps({ dict = EN, query = "" }: { dict?: Dictionary; query?: string }) {
  return (
    <LinkStrip
      id="cool-apps"
      items={allCoolApps}
      search={searchCoolApps}
      query={query}
      categories={coolAppCategories}
      subsiteHref="/explore/cool-apps"
      copy={{
        heading: dict.coolApps,
        lede: dict.coolAppsLede,
        closed: dict.coolAppsClosed,
        noMatch: dict.coolAppsNoMatch,
        unit: dict.apps,
        all: dict.allTag,
        filterLabel: dict.filterByCategory,
      }}
    />
  );
}

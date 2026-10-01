"use client";

import LinkStrip from "@/components/link-strip";
import { allCoolAis, coolAiCategories, searchCoolAis } from "@/lib/directory";
import { EN, type Dictionary } from "@/lib/i18n";

export default function CoolAis({ dict = EN, query = "" }: { dict?: Dictionary; query?: string }) {
  return <LinkStrip id="cool-ais" items={allCoolAis} search={searchCoolAis} query={query} categories={coolAiCategories} copy={{ heading: dict.coolAis, lede: dict.coolAisLede, closed: dict.coolAisClosed, noMatch: dict.coolAisNoMatch, unit: "AIs", all: dict.allTag, filterLabel: dict.filterByCategory }} />;
}

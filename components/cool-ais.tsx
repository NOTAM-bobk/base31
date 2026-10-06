"use client";

import LinkStrip from "@/components/link-strip";
import NoCodeAiTools from "@/components/no-code-ai-tools";
import { allCoolAis, coolAiCategories, searchCoolAis } from "@/lib/directory";
import { EN, type Dictionary } from "@/lib/i18n";

// The homepage's two AI strips, rendered together: "Cool AIs" (config/cool-ais.json)
// and, directly under it, "No-code AI tools" (config/no-code-ai.json). The two sit
// in one module because the homepage's strip list is a fixed set of components and
// both take the same dictionary: the pair is edited together, and the new strip
// joins the hero search through the `query` this component already receives.
export default function CoolAis({ dict = EN, query = "" }: { dict?: Dictionary; query?: string }) {
  return (
    <>
      <LinkStrip id="cool-ais" items={allCoolAis} search={searchCoolAis} query={query} categories={coolAiCategories} subsiteHref="/explore/cool-ais" copy={{ heading: dict.coolAis, lede: dict.coolAisLede, closed: dict.coolAisClosed, noMatch: dict.coolAisNoMatch, unit: "AIs", all: dict.allTag, filterLabel: dict.filterByCategory }} />
      <NoCodeAiTools dict={dict} query={query} />
    </>
  );
}

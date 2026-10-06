"use client";

import LinkStrip from "@/components/link-strip";
import { allNoCodeAiTools, noCodeAiToolCategories, searchNoCodeAiTools } from "@/lib/no-code-ai-tools";
import { EN, type Dictionary } from "@/lib/i18n";

const siteUrl = "https://base31.org";

// The "No-code AI tools" strip. It reuses the shared LinkStrip, so it folds,
// filters by category, joins the hero search and carries votes like every other
// strip. The extra piece is the ItemList below: a machine-readable list of the
// tools themselves, which is what an answer engine reads when someone asks
// which AI builders need no code.
export default function NoCodeAiTools({ dict = EN, query = "" }: { dict?: Dictionary; query?: string }) {
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${siteUrl}/#no-code-ai-tools`,
    name: "No-code AI tools",
    description:
      "AI tools that build apps, websites and automations without code, picked by base31.org.",
    numberOfItems: allNoCodeAiTools.length,
    itemListElement: allNoCodeAiTools.map((tool, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "SoftwareApplication",
        name: tool.name,
        url: tool.url,
        description: tool.description,
        applicationCategory: "WebApplication",
        operatingSystem: "Web browser",
        keywords: tool.tags.join(", "),
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(list) }} />
      <LinkStrip
        id="no-code-ai-tools"
        items={allNoCodeAiTools}
        search={searchNoCodeAiTools}
        query={query}
        categories={noCodeAiToolCategories}
        copy={{
          heading: dict.noCodeAiTools,
          lede: dict.noCodeAiToolsLede,
          closed: dict.noCodeAiToolsClosed,
          noMatch: dict.noCodeAiToolsNoMatch,
          unit: "tools",
          all: dict.allTag,
          filterLabel: dict.filterByCategory,
        }}
      />
    </>
  );
}

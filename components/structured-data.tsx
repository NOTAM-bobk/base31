import sites from "@/config/sites.json";

const siteUrl = "https://base31.org";

type Site = { name: string; url: string; show?: boolean };

export default function StructuredData() {
  const visibleSites = (sites as Site[]).filter((site) => site.show !== false);
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "base31.org",
        description: "An independent directory of cool sites, fun websites, creative web projects, and useful online tools.",
      },
      {
        "@type": "ItemList",
        "@id": `${siteUrl}/#directory`,
        name: "base31.org website directory",
        numberOfItems: visibleSites.length,
        itemListElement: visibleSites.map((site, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: site.name,
          url: site.url,
        })),
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

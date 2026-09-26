const siteUrl = "https://base31.org";

// Site-wide graph. It is rendered once from app/layout.tsx, so it must stay
// page-agnostic: the WebSite node plus the Organization that publishes it.
// The directory's ItemList is homepage-only and lives in app/page.tsx.
export default function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "base31.org",
        url: siteUrl,
        description:
          "An independent directory of cool sites, fun websites, creative web projects, and useful online tools.",
        logo: `${siteUrl}/icons/base31-icon-512.png`,
        sameAs: ["https://github.com/NOTAM-bobk/base31"],
        email: "sawyer11456@gmail.com",
        telephone: "+1-612-444-3853",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Minneapolis",
          addressRegion: "MN",
          addressCountry: "US",
        },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "sawyer11456@gmail.com",
          telephone: "+1-612-444-3853",
          areaServed: "US",
          availableLanguage: "en",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "base31.org",
        description:
          "An independent directory of cool sites, fun websites, creative web projects, and useful online tools.",
        inLanguage: "en-US",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

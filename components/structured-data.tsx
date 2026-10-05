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
        email: "hello@base31.org",
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
          email: "hello@base31.org",
          telephone: "+1-612-444-3853",
          areaServed: "US",
          availableLanguage: ["en", "es", "fr", "pt"],
        },
        // What the publisher is an authority on, in the words search and
        // answer engines use to match a question to a source.
        knowsAbout: [
          "website directories",
          "cool and unusual websites",
          "creative web projects",
          "free browser tools",
          "free public APIs",
          "AI assistants",
          "no-code AI app and website builders",
          "the indie web",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "base31.org",
        description:
          "An independent directory of cool sites, fun websites, creative web projects, and useful online tools.",
        inLanguage: ["en", "es", "fr", "pt"],
        publisher: { "@id": `${siteUrl}/#organization` },
        // The homepage search is a real deep link: /?q=pomodoro opens the
        // directory filtered to that query (the component reads `q` on mount),
        // so declaring the sitelinks search box here is accurate rather than
        // decorative.
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

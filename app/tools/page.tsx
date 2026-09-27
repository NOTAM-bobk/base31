import Link from "next/link";
import sitesConfig from "@/config/sites.json";
import { publishedToolSlugs, toolPages } from "@/lib/tool-pages";

const siteUrl = "https://base31.org";

export const metadata = {
  title: "Free Online Tools — Every Tool on base31.org",
  description:
    "Every free browser tool on base31.org in one place: QR codes, passwords, screenshots, file sharing, domain checks, website status, and more. No accounts, nothing to install.",
  alternates: { canonical: "/tools" },
  // Setting openGraph replaces the layout's object rather than merging it, so it
  // repeats siteName, locale and a page-accurate url.
  openGraph: {
    type: "website",
    url: `${siteUrl}/tools`,
    siteName: "base31.org",
    locale: "en_US",
    title: "Free Online Tools — Every Tool on base31.org",
    description:
      "Every free browser tool on base31.org: QR codes, passwords, screenshots, file sharing, domain checks, and more. No accounts, nothing to install.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Online Tools — base31.org",
    description: "Every free browser tool on base31.org, in one place.",
  },
};

type SiteEntry = { name: string; subdomain: string; url: string; description: string; tags?: string[]; show?: boolean };

const sites = sitesConfig as SiteEntry[];

export default function ToolsIndexPage() {
  // Driven by lib/tool-pages.ts, so a new guide appears here automatically.
  const entries = publishedToolSlugs()
    .map((slug) => ({ slug, page: toolPages[slug], site: sites.find((entry) => entry.subdomain === slug) }))
    .filter((entry) => entry.site);

  const tags = [...new Set(entries.flatMap((entry) => entry.site!.tags ?? []))].sort();

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/tools#page`,
        url: `${siteUrl}/tools`,
        name: "Free Online Tools — Every Tool on base31.org",
        description: "An index of every free browser tool published on base31.org.",
        inLanguage: "en-US",
        isPartOf: { "@id": `${siteUrl}/#website` },
      },
      {
        "@type": "ItemList",
        "@id": `${siteUrl}/tools#list`,
        name: "Tools on base31.org",
        numberOfItems: entries.length,
        itemListElement: entries.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: entry.site!.name,
          url: `${siteUrl}/tools/${entry.slug}`,
        })),
      },
    ],
  };

  return (
    <main className="tools-index">
      <Link className="privacy-back mono" href="/">← base31.org</Link>
      <p className="eyebrow mono">tools</p>
      <h1>Every tool on base31.org, in one place.</h1>
      <p className="privacy-updated">
        {entries.length} tools, all free and all in the browser. Nothing here needs an account, and each one does a single job rather than
        trying to be a platform.
      </p>

      <ul className="tools-grid">
        {entries.map((entry) => (
          <li key={entry.slug} className="tools-grid-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="tools-grid-icon" src={`/site-icons/${entry.slug}.svg`} alt="" width={30} height={30} loading="lazy" />
            <h2>
              <Link href={`/tools/${entry.slug}`}>{entry.site!.name}</Link>
            </h2>
            <p className="tools-grid-summary">{entry.page!.summary}</p>
            <span className="tools-grid-tags mono">{(entry.site!.tags ?? []).join(" · ")}</span>
            <span className="tools-grid-actions">
              <Link className="tools-grid-guide" href={`/tools/${entry.slug}`}>Read the guide</Link>
              <a className="tools-grid-open mono" href={entry.site!.url} target="_blank" rel="noreferrer">
                Open ↗
              </a>
            </span>
          </li>
        ))}
      </ul>

      <section className="tool-block" aria-labelledby="tools-about-heading">
        <h2 id="tools-about-heading">How these tools are built</h2>
        <div className="tool-copy">
          <p>
            Each tool is a small static site on its own subdomain: HTML, CSS, and JavaScript with no build step and no tracking pixel of its
            own. That keeps them fast, keeps them working when a framework moves on, and means a page you bookmarked today will still open
            in a year.
          </p>
          <p>
            Where a tool can do its work in the browser, it does — generating a password, drawing a QR code, or encrypting a vault all
            happen on your device. Where a lookup needs the network, like a domain check or a reachability test, the request goes straight
            from your browser to a public data source rather than through an account of ours.
          </p>
        </div>
      </section>

      <p className="stats-foot">
        Popular tags: {tags.slice(0, 12).map((tag, index) => (
          <span key={tag}>
            {index > 0 ? ", " : ""}
            <span className="mono">{tag}</span>
          </span>
        ))}
        . Or <Link href="/#sites">browse the full directory</Link>, including sites other people have published.
      </p>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
    </main>
  );
}

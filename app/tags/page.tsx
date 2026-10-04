import Link from "next/link";
import { tagGroups, tagCount, taggedEntryCount } from "@/lib/tags";
import { tagTone } from "@/lib/directory";

const siteUrl = "https://base31.org";

export const metadata = {
  title: "Tags — Browse Every Topic in the base31.org Directory",
  description:
    "Every tag used across the base31.org directory, from free utilities and browser tools to games, art and AI. Follow a tag to see every site that carries it.",
  alternates: { canonical: "/tags" },
  openGraph: {
    type: "website",
    url: `${siteUrl}/tags`,
    siteName: "base31.org",
    locale: "en_US",
    title: "Tags — Browse Every Topic in the base31.org Directory",
    description: "Every tag in the base31.org directory, gathered onto one page.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tags — base31.org",
    description: "Every tag in the base31.org directory, in one place.",
  },
};

export default function TagsIndexPage() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/tags#page`,
        url: `${siteUrl}/tags`,
        name: "Tags — base31.org",
        description: "An index of every tag used in the base31.org directory.",
        isPartOf: { "@id": `${siteUrl}/#website` },
        breadcrumb: { "@id": `${siteUrl}/tags#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/tags#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "base31.org", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Tags", item: `${siteUrl}/tags` },
        ],
      },
    ],
  };

  return (
    <main className="tool-page tag-page">
      <nav className="breadcrumb mono" aria-label="Breadcrumb">
        <Link href="/">base31.org</Link><span aria-hidden="true">/</span>
        <span aria-current="page">Tags</span>
      </nav>
      <p className="eyebrow mono">tags</p>
      <h1>Browse the directory by topic.</h1>
      <p className="tool-summary">
        {tagCount} tags across {taggedEntryCount} listed sites, APIs, apps and AI tools. Every tag here has its
        own page; the count beside it is how many picks carry it.
      </p>
      <p className="tag-page-note">
        Looking for a specific tool instead? Try the <Link href="/tools">tool guides</Link>, the{" "}
        <Link href="/recently-added">recently added</Link> picks, or search the <Link href="/">directory</Link> with{" "}
        <code className="mono">#tag</code>.
      </p>

      {tagGroups.map((group) => (
        <section className="tag-group" key={group.letter} aria-labelledby={`tag-group-${group.letter}`}>
          <h2 id={`tag-group-${group.letter}`} className="tag-group-letter mono">{group.letter}</h2>
          <ul className="tag-index">
            {group.tags.map((info) => (
              <li key={info.slug}>
                <Link className={`tag-index-item tag tone-${tagTone(info.tag)}`} href={`/tags/${info.slug}`}>
                  <span className="tag-index-name">{info.tag}</span>
                  <span className="tag-index-count mono">{info.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="stats-foot">
        <Link href="/">← Back to the directory</Link> · <Link href="/recently-added">Recently added</Link> ·{" "}
        <Link href="/quality-report">Quality report</Link>
      </p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }} />
    </main>
  );
}
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tagTone } from "@/lib/directory";
import { allTags, entriesForTag, tagBySlug, tagCount, tagSlug } from "@/lib/tags";
import Freshness from "@/components/freshness";
import ShareLink from "@/components/share-link";

const origin = "https://base31.org";
type Props = { params: { tag: string } };

export const dynamicParams = false;

export function generateStaticParams() {
  return allTags.map((info) => ({ tag: info.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const info = tagBySlug(params.tag);
  if (!info) return {};
  const title = `${info.tag} — ${info.count} pick${info.count === 1 ? "" : "s"} tagged ${info.tag} | base31.org`;
  const description = `Everything in the base31.org directory tagged “${info.tag}”: ${info.count} listed site${info.count === 1 ? "" : "s"}, each with its own page, review date and vote count.`;
  const url = `${origin}/tags/${info.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, siteName: "base31.org", locale: "en_US" },
    twitter: { card: "summary", title: `${info.tag} — base31.org`, description },
  };
}

export default function TagPage({ params }: Props) {
  const info = tagBySlug(params.tag);
  if (!info) notFound();
  const entries = entriesForTag(info.tag);
  const url = `${origin}/tags/${info.slug}`;
  // Other tags that appear on the picks here, most shared first, so a visitor
  // can walk sideways instead of going back to the index.
  const related = Array.from(entries
    .flatMap((entry) => entry.tags ?? [])
    .filter((tag) => tag !== info.tag)
    .reduce((counts, tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1), new Map<string, number>()))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([tag]) => tag);

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: `${info.tag} — base31.org`,
        description: `Directory picks tagged ${info.tag}.`,
        inLanguage: "en-US",
        isPartOf: { "@id": `${origin}/#website` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: entries.length,
          itemListElement: entries.map((entry, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: entry.name,
            url: `${origin}/sites/${entry.slug}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "base31.org", item: origin },
          { "@type": "ListItem", position: 2, name: "Tags", item: `${origin}/tags` },
          { "@type": "ListItem", position: 3, name: info.tag, item: url },
        ],
      },
    ],
  };

  return (
    <main className="tool-page tag-page">
      <nav className="breadcrumb mono" aria-label="Breadcrumb">
        <Link href="/">base31.org</Link><span aria-hidden="true">/</span>
        <Link href="/tags">Tags</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{info.tag}</span>
      </nav>
      <p className="eyebrow mono">tag</p>
      <h1><span className={`tag tone-${tagTone(info.tag)}`}>{info.tag}</span></h1>
      <p className="tool-summary">
        {entries.length} pick{entries.length === 1 ? "" : "s"} in the directory carr{entries.length === 1 ? "ies" : "y"} this tag,
        out of {tagCount} tags in all. Each one links to its own page with the full description and vote controls.
      </p>

      <ul className="tag-entry-list">
        {entries.map((entry) => (
          <li className="tag-entry" key={entry.slug}>
            <Link className="tag-entry-main" href={`/sites/${entry.slug}`}>
              <span className="tag-entry-top">
                <span className="tag-entry-name">{entry.name}</span>
                <span className="tag-entry-section mono">{entry.section}</span>
              </span>
              <span className="tag-entry-desc">{entry.description}</span>
            </Link>
            <div className="tag-entry-side">
              <Freshness item={entry} />
              <a className="tag-entry-visit mono" href={entry.url} target="_blank" rel="noopener noreferrer">Visit ↗</a>
              <ShareLink compact url={`${origin}/sites/${entry.slug}`} title={entry.name} />
            </div>
          </li>
        ))}
      </ul>

      {related.length > 0 && (
        <section className="tool-block" aria-labelledby="tag-related-heading">
          <h2 id="tag-related-heading">Tags that come up alongside {info.tag}</h2>
          <ul className="tag-related mono">
            {related.map((tag) => (
              <li key={tag}><Link className={`tag tone-${tagTone(tag)}`} href={`/tags/${tagSlug(tag)}`}>{tag}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <p className="stats-foot">
        <Link href="/tags">← All tags</Link> · <Link href="/recently-added">Recently added</Link> ·{" "}
        <Link href="/quality-report">Quality report</Link> · <Link href="/">The directory</Link>
      </p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }} />
    </main>
  );
}
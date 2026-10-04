import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { directoryEntries, tagTone } from "@/lib/directory";
import { tagSlug } from "@/lib/tags";
import Freshness from "@/components/freshness";
import ShareLink from "@/components/share-link";
import { DetailVotes } from "@/components/site-votes";
import { getToolPage } from "@/lib/tool-pages";

const origin = "https://base31.org";
type Props = { params: { slug: string } };
export const revalidate = 86400;
export const dynamicParams = false;
export function generateStaticParams() {
  return directoryEntries.map((entry) => ({ slug: entry.slug }));
}
export function generateMetadata({ params }: Props): Metadata {
  const entry = directoryEntries.find((item) => item.slug === params.slug);
  if (!entry) notFound();
  const title = `${entry.name} — ${entry.section} | base31.org`;
  const url = `${origin}/sites/${entry.slug}`;
  return {
    title, description: entry.description, alternates: { canonical: url },
    openGraph: { type: "website", url, title, description: entry.description, siteName: "base31.org", locale: "en_US" },
    twitter: { card: "summary", title, description: entry.description },
  };
}
export default function SiteDetailPage({ params }: Props) {
  const entry = directoryEntries.find((item) => item.slug === params.slug);
  if (!entry) notFound();
  const url = `${origin}/sites/${entry.slug}`;
  // Related picks: entries that share tags come first, then anything else in
  // the same collection, then anything else at all. Counting only the shared
  // tags would leave the block empty for a site whose tags are unique, so the
  // tie-breakers below always fill it.
  const sharedTags = (item: typeof entry) => (item.tags ?? []).filter((tag) => entry.tags?.includes(tag)).length;
  const related = directoryEntries
    .filter((item) => item.slug !== entry.slug)
    .map((item) => ({ item, shared: sharedTags(item), sameSection: item.sectionId === entry.sectionId }))
    .sort((a, b) => b.shared - a.shared || Number(b.sameSection) - Number(a.sameSection) || a.item.name.localeCompare(b.item.name))
    .slice(0, 6)
    .map((ranked) => ranked.item);
  const guide = entry.sectionId === "sites" ? getToolPage(entry.slug) : null;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage", "@id": `${url}#page`, url, name: entry.name,
        description: entry.description, inLanguage: "en-US",
        isPartOf: { "@id": `${origin}/#website` },
        ...(entry.addedAt ? { datePublished: entry.addedAt } : {}),
        ...(entry.lastChecked ? { dateModified: entry.lastChecked } : {}),
        about: { "@type": "WebSite", name: entry.name, url: entry.url, description: entry.description },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`, itemListElement: [
          { "@type": "ListItem", position: 1, name: "base31.org", item: origin },
          { "@type": "ListItem", position: 2, name: entry.section, item: `${origin}/#${entry.sectionId}` },
          { "@type": "ListItem", position: 3, name: entry.name, item: url },
        ],
      },
    ],
  };
  return (
    <main className="tool-page site-detail-page">
      <nav className="breadcrumb mono" aria-label="Breadcrumb">
        <Link href="/">base31.org</Link><span aria-hidden="true">/</span>
        <Link href={`/#${entry.sectionId}`}>{entry.section}</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{entry.name}</span>
      </nav>
      <p className="eyebrow mono">{entry.category ?? entry.section}</p>
      <h1>{entry.name}</h1>
      <p className="tool-summary">{entry.description}</p>
      <Freshness item={entry} />
      <div className="site-detail-preview">
        <Image src={`https://image.thum.io/get/width/960/crop/480/noanimate/${entry.url}`} alt={`Preview of ${entry.name}`} width={960} height={480} sizes="(max-width: 780px) 100vw, 780px" />
      </div>
      <a className="tool-cta" href={entry.url} target="_blank" rel="noopener noreferrer">
        <span className="tool-cta-label">Visit {entry.name}</span>
        <span className="tool-cta-host mono">{new URL(entry.url).hostname}</span>
        <span aria-hidden="true">↗</span>
      </a>
      <section className="tool-block" aria-labelledby="site-overview">
        <h2 id="site-overview">About this pick</h2>
        <p>{entry.name} is listed in our {entry.section.toLowerCase()} collection{entry.category ? ` under ${entry.category.toLowerCase()}` : ""}. {entry.description}</p>
        {!!entry.tags?.length && (
          <ul className="detail-tags mono" aria-label="Topics">
            {entry.tags.map((tag) => (
              <li key={tag}>
                <Link className={`tag tone-${tagTone(tag)}`} href={`/tags/${tagSlug(tag)}`}>{tag}</Link>
              </li>
            ))}
          </ul>
        )}
        {!!entry.tags?.length && <p className="detail-tags-note">Browse every pick tagged <Link href={`/tags/${tagSlug(entry.tags[0])}`}>{entry.tags[0]}</Link>, or see <Link href="/tags">all tags</Link>.</p>}
        <p className="stats-foot">Review dates describe our recorded editorial checks, not a live uptime guarantee. Features, pricing and account requirements can change; confirm them on the linked website.</p>
        {entry.sectionId === "cool-ais" && <p className="ai-notice">AI answers can be inaccurate. Verify sources and do not upload confidential or sensitive personal information without reviewing the provider&apos;s privacy terms.</p>}
        {guide && <Link className="site-detail-link" href={`/tools/${entry.slug}`}>Read the full guide: {guide.headline} →</Link>}
      </section>
      <section className="tool-block" aria-labelledby="site-votes-heading">
        <h2 id="site-votes-heading">Worth a visit?</h2>
        <p>Share your vote with the directory. Click your selected arrow again to clear your vote.</p>
        <DetailVotes voteKey={entry.voteKey} name={entry.name} />
      </section>
      <section className="tool-block" aria-labelledby="site-related-heading">
        <h2 id="site-related-heading">Related picks</h2>
        <p className="detail-related-lede">Chosen by shared tags first, then the rest of the {entry.section.toLowerCase()} collection.</p>
        <ul className="tool-related">
          {related.map((item) => (
            <li key={item.slug}>
              <Link href={`/sites/${item.slug}`}>
                <span className="tool-related-name">{item.name}</span>
                <span className="tool-related-summary">{item.description}</span>
                {!!item.tags?.length && <span className="tool-related-tags mono">{item.tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}</span>}
              </Link>
              <ShareLink compact url={`${origin}/sites/${item.slug}`} title={item.name} />
            </li>
          ))}
        </ul>
      </section>
      <section className="tool-block" aria-labelledby="site-share-heading">
        <h2 id="site-share-heading">Share this pick</h2>
        <p>Send {entry.name} to someone who would use it, or keep the link for later.</p>
        <ShareLink url={url} title={`${entry.name} — ${entry.section}`} text={entry.description} />
        <p className="detail-share-url mono">{url}</p>
      </section>
      <p className="stats-foot"><Link href={`/#${entry.sectionId}`}>← Back to {entry.section}</Link> · <Link href="/recently-added">Recently added</Link> · <Link href="/tags">Browse by tag</Link></p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }} />
    </main>
  );
}

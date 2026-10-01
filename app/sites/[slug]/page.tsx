import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { directoryEntries } from "@/lib/directory";
import Freshness from "@/components/freshness";
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
  const related = directoryEntries.filter((item) => item.slug !== entry.slug && item.sectionId === entry.sectionId)
    .sort((a, b) => (b.tags ?? []).filter((tag) => entry.tags?.includes(tag)).length - (a.tags ?? []).filter((tag) => entry.tags?.includes(tag)).length)
    .slice(0, 6);
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
        {/* eslint-disable-next-line @next/next/no-img-element -- third-party preview, fixed dimensions and graceful fallback */}
        <img src={`https://image.thum.io/get/width/960/crop/480/noanimate/${entry.url}`} alt={`Preview of ${entry.name}`} width={960} height={480} loading="lazy" />
      </div>
      <a className="tool-cta" href={entry.url} target="_blank" rel="noopener noreferrer">
        <span className="tool-cta-label">Visit {entry.name}</span>
        <span className="tool-cta-host mono">{new URL(entry.url).hostname}</span>
        <span aria-hidden="true">↗</span>
      </a>
      <section className="tool-block" aria-labelledby="site-overview">
        <h2 id="site-overview">About this pick</h2>
        <p>{entry.name} is listed in our {entry.section.toLowerCase()} collection{entry.category ? ` under ${entry.category.toLowerCase()}` : ""}. {entry.description}</p>
        {!!entry.tags?.length && <ul className="detail-tags mono" aria-label="Topics">{entry.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
        <p className="stats-foot">Review dates describe our recorded editorial checks, not a live uptime guarantee. Features, pricing and account requirements can change; confirm them on the linked website.</p>
        {entry.sectionId === "cool-ais" && <p className="ai-notice">AI answers can be inaccurate. Verify sources and do not upload confidential or sensitive personal information without reviewing the provider's privacy terms.</p>}
        {guide && <Link className="site-detail-link" href={`/tools/${entry.slug}`}>Read the full guide: {guide.headline} →</Link>}
      </section>
      <section className="tool-block" aria-labelledby="site-votes-heading">
        <h2 id="site-votes-heading">Worth a visit?</h2>
        <p>Share your vote with the directory. Click your selected arrow again to clear your vote.</p>
        <DetailVotes voteKey={entry.voteKey} name={entry.name} />
      </section>
      <section className="tool-block" aria-labelledby="site-related-heading">
        <h2 id="site-related-heading">More picks to explore</h2>
        <ul className="tool-related">{related.map((item) => <li key={item.slug}><Link href={`/sites/${item.slug}`}><span className="tool-related-name">{item.name}</span><span className="tool-related-summary">{item.description}</span></Link></li>)}</ul>
      </section>
      <p className="stats-foot"><Link href={`/#${entry.sectionId}`}>← Back to {entry.section}</Link></p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }} />
    </main>
  );
}

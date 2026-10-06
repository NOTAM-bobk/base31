import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionExplorer from "@/components/section-explorer";
import { directorySections, sectionById } from "@/lib/sections";

// One section of the directory, at its own address.
//
// /explore is the whole directory in one long page; this route is a single
// collection of it — every card, its own search field, its own filter chips and
// the same vote ranking — so a section can be linked, shared and crawled on its
// own, and someone who came for the cool APIs does not have to scroll past five
// other lists to reach the end of them.
//
// The slug is a section id from lib/sections.ts, so the ids the quick jumps and
// the drawer already use are the ids these pages live at. English only, like
// /explore itself: the translated homepages stay at /es, /fr and /pt and link
// here.
const origin = "https://base31.org";
type Props = { params: { section: string } };

export const dynamicParams = false;

export function generateStaticParams() {
  return directorySections.map((section) => ({ section: section.id }));
}

export function generateMetadata({ params }: Props): Metadata {
  const section = sectionById(params.section);
  if (!section) return {};
  const url = `${origin}/explore/${section.id}`;
  const title = `${section.label} — ${section.items.length} picks | base31.org`;
  const description = `Every ${section.label.toLowerCase()} pick in the base31.org directory: ${section.items.length} entries, each with its own description, tags and vote count. Search the section or filter it by ${section.filterField}.`;
  return {
    title,
    description,
    alternates: { canonical: `/explore/${section.id}` },
    openGraph: { type: "website", url, title, description, siteName: "base31.org", locale: "en_US" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function SectionPage({ params }: Props) {
  const section = sectionById(params.section);
  if (!section) notFound();
  const url = `${origin}/explore/${section.id}`;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: `${section.label} — base31.org`,
        description: section.lede,
        inLanguage: "en-US",
        isPartOf: { "@id": `${origin}/#website` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: section.items.length,
          itemListElement: section.items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            url: item.url,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "base31.org", item: origin },
          { "@type": "ListItem", position: 2, name: "Explore", item: `${origin}/explore` },
          { "@type": "ListItem", position: 3, name: section.label, item: url },
        ],
      },
    ],
  };

  const siblings = directorySections.filter((other) => other.id !== section.id);

  return (
    <main className="tool-page section-page">
      <nav className="breadcrumb mono" aria-label="Breadcrumb">
        <Link href="/">base31.org</Link><span aria-hidden="true">/</span>
        <Link href="/explore">Explore</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{section.label}</span>
      </nav>
      <p className="eyebrow mono">section</p>
      <h1>{section.label}</h1>
      <p className="tool-summary">{section.lede}</p>

      <SectionExplorer section={section} />

      <section className="tool-block" aria-labelledby="section-others-heading">
        <h2 id="section-others-heading">Other sections</h2>
        <ul className="tag-related mono">
          {siblings.map((other) => (
            <li key={other.id}>
              <Link href={`/explore/${other.id}`}>{other.label}</Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="stats-foot">
        <Link href="/explore">← The whole directory</Link> · <Link href={`/explore#${section.id}`}>This section on /explore</Link> ·{" "}
        <Link href="/tags">Browse by tag</Link> · <Link href="/recently-added">Recently added</Link>
      </p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }} />
    </main>
  );
}

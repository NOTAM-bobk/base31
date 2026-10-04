import Link from "next/link";
import type { DirectoryEntry } from "@/lib/directory";
import { tagTone } from "@/lib/directory";
import { tagSlug } from "@/lib/tags";
import { addedDay, addedWithinDays, monthLabel, recentlyAdded, recentlyAddedTop } from "@/lib/recently-added";
import CommunitySites from "@/components/community-sites";
import Freshness from "@/components/freshness";
import ShareLink from "@/components/share-link";

const siteUrl = "https://base31.org";

export const metadata = {
  title: "Recently Added — The Newest Picks in the base31.org Directory",
  description:
    "The newest sites, tools, APIs, apps and AI picks added to base31.org, newest first and grouped by month, plus everything visitors have published themselves.",
  alternates: { canonical: "/recently-added" },
  openGraph: {
    type: "website",
    url: `${siteUrl}/recently-added`,
    siteName: "base31.org",
    locale: "en_US",
    title: "Recently Added — base31.org",
    description: "The newest picks in the base31.org directory, newest first.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Recently Added — base31.org",
    description: "The newest picks in the base31.org directory, newest first.",
  },
};

// Entries are grouped by the month they were added, because the exact day is
// rarely what a visitor is after — "what is new this month" is the question.
const groups = recentlyAdded.reduce<{ month: string; entries: DirectoryEntry[] }[]>((months, entry) => {
  const month = monthLabel(addedDay(entry)!);
  const last = months[months.length - 1];
  if (last?.month === month) last.entries.push(entry);
  else months.push({ month, entries: [entry] });
  return months;
}, []);

const last30 = addedWithinDays(30).length;
const newest = recentlyAddedTop(3);

export default function RecentlyAddedPage() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/recently-added#page`,
        url: `${siteUrl}/recently-added`,
        name: "Recently Added — base31.org",
        description: "The newest entries in the base31.org directory.",
        isPartOf: { "@id": `${siteUrl}/#website` },
        breadcrumb: { "@id": `${siteUrl}/recently-added#breadcrumb` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: recentlyAdded.length,
          itemListElement: recentlyAddedTop(12).map((entry, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: entry.name,
            url: `${siteUrl}/sites/${entry.slug}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/recently-added#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "base31.org", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Recently added", item: `${siteUrl}/recently-added` },
        ],
      },
    ],
  };

  return (
    <main className="tool-page recent-page">
      <nav className="breadcrumb mono" aria-label="Breadcrumb">
        <Link href="/">base31.org</Link><span aria-hidden="true">/</span>
        <span aria-current="page">Recently added</span>
      </nav>
      <p className="eyebrow mono">recently added</p>
      <h1>What&rsquo;s new in the directory.</h1>
      <p className="tool-summary">
        {recentlyAdded.length} dated picks, newest first, straight from each entry&rsquo;s own added date — nothing
        on this page is hand-maintained. {last30 > 0 ? `${last30} arrived in the last 30 days.` : "None arrived in the last 30 days."}
      </p>

      {newest.length > 0 && (
        <section className="recent-spotlight" aria-labelledby="recent-spotlight-heading">
          <h2 id="recent-spotlight-heading" className="recent-heading mono">Newest three</h2>
          <ul className="recent-spotlight-list">
            {newest.map((entry) => (
              <li key={entry.slug}>
                <Link className="recent-spotlight-card" href={`/sites/${entry.slug}`}>
                  <span className="recent-spotlight-day mono">{addedDay(entry)}</span>
                  <span className="recent-spotlight-name">{entry.name}</span>
                  <span className="recent-spotlight-section mono">{entry.section}</span>
                  <span className="recent-spotlight-desc">{entry.description}</span>
                </Link>
                <ShareLink compact url={`${siteUrl}/sites/${entry.slug}`} title={entry.name} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.map((group) => (
        <section className="recent-month" key={group.month} aria-labelledby={`recent-${group.month.replace(/\s+/g, "-").toLowerCase()}`}>
          <h2 id={`recent-${group.month.replace(/\s+/g, "-").toLowerCase()}`} className="recent-heading mono">
            {group.month} <span className="recent-heading-count">{group.entries.length}</span>
          </h2>
          <ul className="recent-list">
            {group.entries.map((entry) => (
              <li className="recent-item" key={entry.slug}>
                <Link className="recent-item-main" href={`/sites/${entry.slug}`}>
                  <span className="recent-item-top">
                    <span className="recent-item-name">{entry.name}</span>
                    <span className="recent-item-section mono">{entry.section}</span>
                  </span>
                  <span className="recent-item-desc">{entry.description}</span>
                  {!!entry.tags?.length && (
                    <span className="recent-item-tags mono">
                      {entry.tags.slice(0, 5).map((tag) => (
                        <Link className={`tag tone-${tagTone(tag)}`} href={`/tags/${tagSlug(tag)}`} key={tag}>{tag}</Link>
                      ))}
                    </span>
                  )}
                </Link>
                <div className="recent-item-side">
                  <time className="recent-item-day mono" dateTime={addedDay(entry)}>{addedDay(entry)}</time>
                  <Freshness item={entry} />
                  <ShareLink compact url={`${siteUrl}/sites/${entry.slug}`} title={entry.name} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="recent-community" aria-labelledby="recent-community-heading">
        <h2 id="recent-community-heading" className="recent-heading mono">Community uploads</h2>
        <p className="recent-community-lede">
          Sites visitors have published through <Link href="/#request-url">the submission form</Link>. They arrive on
          the Worker rather than in the repository, so this list is read live.
        </p>
        <CommunitySites limit={12} />
      </section>

      <section className="recent-note" aria-labelledby="recent-note-heading">
        <h2 id="recent-note-heading" className="recent-heading mono">How this list is built</h2>
        <p>
          A curated entry appears here as soon as it has an <code className="mono">addedAt</code> date in its config
          file; a community upload appears with the timestamp it was published. Entries from before the field existed
          have no honest date to show and are left off rather than guessed at. For the editorial half of that story,
          see the <Link href="/websites-of-the-week">websites of the week</Link> and the{" "}
          <Link href="/whats-new">release notes</Link>.
        </p>
      </section>

      <p className="stats-foot">
        <Link href="/">← Back to the directory</Link> · <Link href="/tags">Browse by tag</Link> ·{" "}
        <Link href="/quality-report">Quality report</Link> · <Link href="/stats">Stats</Link>
      </p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }} />
    </main>
  );
}
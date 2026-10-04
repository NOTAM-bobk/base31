import Link from "next/link";
import { directoryEntries } from "@/lib/directory";
import { addedDay, addedTime } from "@/lib/recently-added";
import QualityChecks from "@/components/quality-checks";

const siteUrl = "https://base31.org";
// The curated half is built from config, the live half refreshes itself in the
// browser; an hour is long enough to keep the page cheap and short enough that
// a newly reviewed entry shows up the same day.
export const revalidate = 3600;

export const metadata = {
  title: "Quality Report — Review Dates and Site Health for base31.org",
  description:
    "Every site in the base31.org directory with the date it was last reviewed, what the automated health checks found, and which links need another look.",
  alternates: { canonical: "/quality-report" },
  openGraph: {
    type: "website",
    url: `${siteUrl}/quality-report`,
    siteName: "base31.org",
    locale: "en_US",
    title: "Quality Report — base31.org",
    description: "Review dates, stale listings and automated health checks for the base31.org directory.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quality Report — base31.org",
    description: "Review dates and automated health checks for the directory.",
  },
};

const STALE_DAYS = 90;
const FRESH_DAYS = 30;

/** Whole days between two day-strings, or null when either is missing. */
const daysBetween = (from: string, to: number) => {
  const start = Date.parse(from);
  return Number.isFinite(start) ? Math.floor((to - start) / 86400000) : null;
};

export default function QualityReportPage() {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);

  // Every entry gets a row; the ones that need attention sort to the top.
  const rows = directoryEntries
    .map((entry) => {
      const reviewedDays = entry.lastChecked ? daysBetween(entry.lastChecked, now) : null;
      const addedDays = entry.addedAt ? daysBetween(entry.addedAt, now) : null;
      const status: "overdue" | "unreviewed" | "due" | "fresh" =
        reviewedDays === null
          ? "unreviewed"
          : reviewedDays > STALE_DAYS
            ? "overdue"
            : reviewedDays > FRESH_DAYS
              ? "due"
              : "fresh";
      return { entry, reviewedDays, addedDays, status };
    })
    .sort((a, b) => {
      const rank = { overdue: 0, unreviewed: 1, due: 2, fresh: 3 };
      return rank[a.status] - rank[b.status] || (b.reviewedDays ?? Infinity) - (a.reviewedDays ?? Infinity) || a.entry.name.localeCompare(b.entry.name);
    });

  const counts = {
    total: rows.length,
    fresh: rows.filter((row) => row.status === "fresh").length,
    due: rows.filter((row) => row.status === "due").length,
    overdue: rows.filter((row) => row.status === "overdue").length,
    unreviewed: rows.filter((row) => row.status === "unreviewed").length,
  };
  const latestReview = directoryEntries
    .map((entry) => entry.lastChecked)
    .filter((value): value is string => !!value)
    .sort()
    .pop();
  const newestAdditions = directoryEntries.filter((entry) => addedTime(entry) !== undefined).length;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/quality-report` as string,
        url: `${siteUrl}/quality-report`,
        name: "Quality Report — base31.org",
        description: "Review dates and automated health checks for every entry in the base31.org directory.",
        inLanguage: "en-US",
        isPartOf: { "@id": `${siteUrl}/#website` },
        dateModified: today,
        breadcrumb: { "@id": `${siteUrl}/quality-report#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/quality-report#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "base31.org", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Quality report", item: `${siteUrl}/quality-report` },
        ],
      },
    ],
  };

  return (
    <main className="tool-page quality-page">
      <nav className="breadcrumb mono" aria-label="Breadcrumb">
        <Link href="/">base31.org</Link><span aria-hidden="true">/</span>
        <span aria-current="page">Quality report</span>
      </nav>
      <p className="eyebrow mono">quality report</p>
      <h1>What we have checked, and when.</h1>
      <p className="tool-summary">
        A directory is only useful while its links still work. This page records the editorial review date for each of
        the {counts.total} curated picks, and the automated health checks for everything visitors have published.
        {latestReview ? ` The most recent editorial review was on ${latestReview}.` : ""}
      </p>

      <section className="quality-cards" aria-label="Curated review totals">
        <div className="stats-card">
          <span className="stats-card-label mono">Reviewed in {FRESH_DAYS} days</span>
          <strong className="stats-card-value">{counts.fresh}</strong>
          <span className="stats-card-note">of {counts.total} curated picks</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label mono">Due a re-check</span>
          <strong className="stats-card-value">{counts.due}</strong>
          <span className="stats-card-note">Last reviewed {FRESH_DAYS}–{STALE_DAYS} days ago</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label mono">Overdue</span>
          <strong className="stats-card-value">{counts.overdue}</strong>
          <span className="stats-card-note">Not reviewed in over {STALE_DAYS} days</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label mono">Not yet reviewed</span>
          <strong className="stats-card-value">{counts.unreviewed}</strong>
          <span className="stats-card-note">No recorded editorial check</span>
        </div>
      </section>

      <section className="quality-panel" aria-labelledby="quality-curated-heading">
        <div className="stats-panel-head">
          <h2 id="quality-curated-heading">Curated picks</h2>
          <span className="mono stats-panel-metric">{newestAdditions} dated additions</span>
        </div>
        <p className="quality-lede">
          A review means the link resolved, the description still matched what the site does, and the tags still made
          sense. It is an editorial check, not an uptime guarantee — pricing and features change between visits.
        </p>
        <div className="quality-table" role="table" aria-label="Curated picks and their review dates">
          <div className="quality-table-head mono" role="row">
            <span role="columnheader">Pick</span>
            <span role="columnheader">Added</span>
            <span role="columnheader">Last reviewed</span>
            <span role="columnheader">Status</span>
          </div>
          {rows.map(({ entry, status }) => (
            <div className={`quality-table-row is-${status}`} role="row" key={`${entry.sectionId}-${entry.slug}`}>
              <span className="quality-table-pick" role="cell">
                <Link href={`/sites/${entry.slug}`}>{entry.name}</Link>
                <span className="quality-table-section mono">{entry.section}</span>
              </span>
              <span className="mono" role="cell">{addedDay(entry) ?? "—"}</span>
              <span className="mono" role="cell">{entry.lastChecked ?? "—"}</span>
              <span className="mono" role="cell">{status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="quality-panel" aria-labelledby="quality-automated-heading">
        <div className="stats-panel-head">
          <h2 id="quality-automated-heading">Automated checks</h2>
          <span className="mono stats-panel-metric">community uploads</span>
        </div>
        <p className="quality-lede">
          A scheduled Cloudflare trigger re-checks every published community site and records whether it still answers.
          A site is hidden after two consecutive failures and restored automatically once it responds again. The list
          below is read live from the Worker.
        </p>
        <QualityChecks />
      </section>

      <section className="quality-panel" aria-labelledby="quality-method-heading">
        <div className="stats-panel-head">
          <h2 id="quality-method-heading">What gets checked</h2>
          <span className="mono stats-panel-metric">method</span>
        </div>
        <ul className="quality-method">
          <li><strong>Reachability.</strong> The scheduled trigger fetches each community site&rsquo;s published page and records the time it last answered.</li>
          <li><strong>Repeated failures.</strong> Two misses in a row hide a site from the directory; one success puts it back.</li>
          <li><strong>Editorial review.</strong> Curated picks are opened by hand and stamped with a date in their config file, which is what the table above reads.</li>
          <li><strong>Everything else.</strong> Visitor numbers and vote totals live on <Link href="/stats">Stats</Link>; new arrivals live on <Link href="/recently-added">Recently added</Link>.</li>
        </ul>
        <p className="quality-foot">
          Spotted a link that no longer works, or a description that has gone stale?{" "}
          <Link href="/#request-url">Send it in</Link> or <Link href="/#bug-report">report it</Link> — the reports are
          what the next review round works from.
        </p>
      </section>

      <p className="stats-foot">
        <Link href="/">← Back to the directory</Link> · <Link href="/recently-added">Recently added</Link> ·{" "}
        <Link href="/tags">Tags</Link> · <Link href="/stats">Stats</Link> · <Link href="/whats-new">What&rsquo;s new</Link>
      </p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }} />
    </main>
  );
}
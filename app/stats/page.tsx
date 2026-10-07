import Link from "next/link";
import sitesConfig from "@/config/sites.json";
import { compareVotes, totalVotes } from "@/lib/vote-ranking";
import { directoryEntries } from "@/lib/directory";

export const metadata = {
  title: "Stats — Visitor Numbers for base31.org",
  description:
    "Live numbers for base31.org: total visitors, a daily visitor graph, the most voted sites in the directory, and how many people follow along.",
  alternates: { canonical: "/stats" },
  // Without this the page would inherit the layout's openGraph and og:url would
  // point at the homepage while the canonical says /stats.
  openGraph: {
    type: "website",
    url: "https://base31.org/stats",
    siteName: "base31.org",
    locale: "en_US",
    title: "Stats — Visitor Numbers for base31.org",
    description: "Total visitors, a daily visitor graph, and the most voted sites in the base31.org directory.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stats — base31.org",
    description: "Total visitors, a daily visitor graph, and the most voted sites in the directory.",
  },
};

// The public worker serves the numbers; see worker/src/index.ts (GET /stats).
const counterUrl = process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev";
const GRAPH_DAYS = 30;
// The worker caches /stats for the same window, so the page follows its lead.
export const revalidate = 300;

type DayPoint = { date: string; views: number };
// The unique half of the same window: one entry per day, holding how many
// different people were seen rather than how many loads there were.
type UniquePoint = { date: string; unique: number };
type StatsTotals = {
  views: number;
  unique: number;
  /** People seen today, and over the last seven days. Counted once each. */
  uniqueToday: number;
  unique7: number;
  last7: number;
  prev7: number;
  sites: number;
  subscribers: number;
  pushDevices: number;
  // `fires` is how many of a key's fires are still inside their 24 hours. They
  // are not votes cast; each one is worth `FIRE_VOTE_WEIGHT` votes to the
  // ranking, which is why it is carried separately here and shown separately on
  // the page rather than folded into the thumbs.
  votes: { up: number; down: number; fires?: number };
};
type StatsPayload = { generatedAt: number; days: number; series: DayPoint[]; uniqueSeries: UniquePoint[]; totals: StatsTotals; top: { key: string; up: number; down: number; fires?: number }[] };

const number = new Intl.NumberFormat("en-US");
const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const shortDay = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`));

// Names for the vote keys: curated entries come from config/sites.json, and a
// community upload is keyed by its own slug, which is readable as-is.
const siteNames = new Map((sitesConfig as { subdomain: string; name: string }[]).map((site) => [site.subdomain, site.name]));
for (const entry of directoryEntries) siteNames.set(entry.voteKey, entry.name);
const displayName = (key: string) => siteNames.get(key) ?? key;

async function loadStats(): Promise<StatsPayload | null> {
  try {
    const response = await fetch(`${counterUrl}/stats?days=${GRAPH_DAYS}`, { next: { revalidate } });
    if (!response.ok) return null;
    const data = (await response.json()) as StatsPayload;
    if (!data || !Array.isArray(data.series) || data.series.length === 0 || !data.totals) return null;
    return data;
  } catch {
    // An unreachable worker renders the "not available yet" state below rather
    // than failing the page.
    return null;
  }
}

// Hand-rolled so the page ships no charting dependency. The viewBox scales
// uniformly, which keeps the bar radius and text legible at every width.
const CHART = { width: 720, height: 240, padX: 10, padTop: 18, padBottom: 30 };

// One day on either graph: the date it covers and the figure it holds, so the
// chart does not care whether it is drawing loads or people.
type ChartPoint = { date: string; value: number };

function Chart({ points, noun, barId }: { points: ChartPoint[]; noun: string; barId: string }) {
  const plotHeight = CHART.height - CHART.padTop - CHART.padBottom;
  const slot = (CHART.width - CHART.padX * 2) / points.length;
  const barWidth = Math.max(4, slot * 0.62);
  const peak = Math.max(...points.map((point) => point.value), 1);
  const peakIndex = points.reduce((best, point, index) => (point.value > points[best].value ? index : best), 0);
  const barX = (index: number) => CHART.padX + slot * index + (slot - barWidth) / 2;
  const barY = (value: number) => CHART.padTop + plotHeight * (1 - value / peak);
  const busiest = points[peakIndex];

  return (
    <svg
      className="stats-chart"
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      role="img"
      aria-label={`Daily ${noun} over the last ${points.length} days. Busiest day: ${shortDay(busiest.date)} with ${busiest.value}.`}
    >
      {/* One gradient per chart: both graphs sit on the same page, and two
          elements cannot share an id in the same document. */}
      <defs>
        <linearGradient id={barId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--live)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--live)" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {/* Two reference lines: the busiest day, and half of it. */}
      {[0, 0.5].map((fraction) => (
        <line
          key={fraction}
          x1={CHART.padX}
          x2={CHART.width - CHART.padX}
          y1={CHART.padTop + plotHeight * fraction}
          y2={CHART.padTop + plotHeight * fraction}
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="3 7"
        />
      ))}

      {points.map((point, index) => {
        const height = Math.max(2, plotHeight * (point.value / peak));
        return (
          <g key={point.date}>
            <rect
              x={barX(index)}
              y={barY(point.value)}
              width={barWidth}
              height={height}
              rx={Math.min(5, height / 2)}
              fill={`url(#${barId})`}
              opacity={point.value === 0 ? 0.3 : 1}
            />
            <title>{`${shortDay(point.date)} · ${number.format(point.value)} ${noun}`}</title>
          </g>
        );
      })}

      {/* Mark the busiest day so the shape of the graph has an anchor. */}
      {busiest.value > 0 && (
        <text
          x={Math.min(Math.max(barX(peakIndex) + barWidth / 2, 34), CHART.width - 34)}
          y={Math.max(barY(busiest.value) - 8, 12)}
          textAnchor="middle"
          className="stats-chart-peak"
        >
          {number.format(busiest.value)} peak
        </text>
      )}

      {[0, Math.floor(points.length / 2), points.length - 1].map((index, position) => (
        <text
          key={points[index].date}
          x={index === 0 ? CHART.padX : index === points.length - 1 ? CHART.width - CHART.padX : barX(index) + barWidth / 2}
          y={CHART.height - 8}
          textAnchor={position === 0 ? "start" : position === 1 ? "middle" : "end"}
          className="stats-chart-label"
        >
          {shortDay(points[index].date)}
        </text>
      ))}
    </svg>
  );
}

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stats-card">
      <span className="stats-card-label mono">{label}</span>
      <strong className="stats-card-value">{value}</strong>
      {note ? <span className="stats-card-note">{note}</span> : null}
    </div>
  );
}

export default async function StatsPage() {
  const stats = await loadStats();
  const totals = stats?.totals;
  const series = stats?.series ?? [];
  // A worker older than the unique-counting release sends no `uniqueSeries`, so
  // the second graph falls back to its empty state rather than to a broken one.
  const uniqueSeries = stats?.uniqueSeries ?? [];
  const chartHasData = series.some((point) => point.views > 0);
  const uniqueHasData = uniqueSeries.some((point) => point.unique > 0);
  const trend = totals && totals.prev7 > 0 ? Math.round(((totals.last7 - totals.prev7) / totals.prev7) * 100) : null;
  const graphWindow = series.reduce((running, point) => running + point.views, 0);
  const uniqueWindow = uniqueSeries.reduce((running, point) => running + point.unique, 0);
  const top = (stats?.top ?? []).filter((entry) => totalVotes(entry) > 0).sort((a, b) => compareVotes(a, b) || a.key.localeCompare(b.key));

  return (
    <main className="stats-page">
      <Link className="privacy-back mono" href="/">← base31.org</Link>
      <p className="eyebrow mono">stats</p>
      <h1>What the directory is doing right now.</h1>
      <p className="privacy-updated">
        Counted by the base31 counter, with no cookies and nothing that identifies a visitor. Views count every
        load; unique visitors are reduced to a one-way hash, so a reload does not count twice and the second graph
        counts people rather than loads. Refreshed every five minutes.
      </p>

      {!totals ? (
        <p className="stats-notice" role="status">
          The counter isn&rsquo;t reporting numbers right now, so there is nothing to show yet. Everything else on the site is
          unaffected — try again in a few minutes.
        </p>
      ) : (
        <>
          <section className="stats-cards" aria-label="Directory totals">
            <Card label="total views" value={number.format(totals.views)} note="since launch, 20 Sep 2026" />
            <Card
              label="unique visitors"
              value={number.format(totals.unique ?? 0)}
              note="one per visitor — reloads do not count"
            />
            <Card
              label="unique today"
              value={number.format(totals.uniqueToday ?? 0)}
              note="people seen since midnight UTC"
            />
            <Card
              label="unique, last 7 days"
              value={number.format(totals.unique7 ?? 0)}
              note={`${number.format(uniqueWindow)} across the graph below`}
            />
            <Card
              label="last 7 days"
              value={number.format(totals.last7)}
              note={trend === null ? "no previous week to compare" : `${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend)}% vs the week before`}
            />
            <Card label="tools listed" value={number.format(sitesConfig.length)} note={`${totals.sites} published by visitors`} />
            <Card
              label="votes cast"
              value={number.format(totals.votes.up + totals.votes.down)}
              note={`${number.format(totals.votes.up)} up · ${number.format(totals.votes.down)} down${totals.votes.fires ? ` · ${number.format(totals.votes.fires)} fires live` : ""}`}
            />
            <Card label="email subscribers" value={number.format(totals.subscribers)} note={`${number.format(totals.pushDevices)} push devices`} />
            <Card label="avg. per day" value={number.format(Math.round(graphWindow / Math.max(series.length, 1)))} note={`across the last ${series.length} days`} />
          </section>

          <section className="stats-panel" aria-labelledby="visitors-heading">
            <div className="stats-panel-head">
              <h2 id="visitors-heading">Visitors, last {series.length} days</h2>
              <span className="mono stats-panel-metric">{number.format(graphWindow)} views</span>
            </div>
            {chartHasData ? (
              <Chart points={series.map((point) => ({ date: point.date, value: point.views }))} noun="views" barId="stats-bar-views" />
            ) : (
              <p className="stats-notice" role="status">
                Daily history has only just started recording, so there is nothing to draw yet. The total above is still the all-time
                count — come back tomorrow for the first full day.
              </p>
            )}
          </section>

          {/* The same window counted a second way. A bar here is one person,
              not one load, so the two graphs use the same shape and answer
              different questions: how often the directory was opened, and how
              many different people opened it. */}
          <section className="stats-panel" aria-labelledby="unique-heading">
            <div className="stats-panel-head">
              <h2 id="unique-heading">Unique visitors, last {uniqueSeries.length} days</h2>
              <span className="mono stats-panel-metric">{number.format(uniqueWindow)} people</span>
            </div>
            {uniqueHasData ? (
              <Chart points={uniqueSeries.map((point) => ({ date: point.date, value: point.unique }))} noun="unique visitors" barId="stats-bar-unique" />
            ) : (
              <p className="stats-notice" role="status">
                Every person is counted once, so this graph fills in more slowly than the one above: a day that one
                visitor read draws a single bar. Come back after a few days of traffic for a shape.
              </p>
            )}
          </section>

          <section className="stats-panel" aria-labelledby="liked-heading">
            <div className="stats-panel-head">
              <h2 id="liked-heading">Most voted sites</h2>
              <span className="mono stats-panel-metric">{top.length === 0 ? "no votes yet" : `${number.format(top.length)} ranked`}</span>
            </div>
            {top.length === 0 ? (
              <p className="stats-notice" role="status">
                Nobody has voted yet. Open any site in the <Link href="/#sites">directory</Link> and cast a vote to start the list.
              </p>
            ) : (
              <ol className="stats-ranking">
                {top.map((entry, index) => (
                  <li key={entry.key} className="stats-rank-row">
                    <span className="stats-rank mono">{String(index + 1).padStart(2, "0")}</span>
                    <span className="stats-rank-name">{displayName(entry.key)}</span>
                    <span className="stats-rank-votes mono">
                      {/* The weighted total is the ranking figure; the two
                          halves beside it add up to it only when a fire is
                          counted, so a boosted row names the fire that raised
                          it instead of leaving the gap unexplained. */}
                      <span>{number.format(totalVotes(entry))} votes</span>
                      <span className="stats-rank-up">▲ {number.format(entry.up)}</span>
                      {entry.down > 0 ? <span className="stats-rank-down">▼ {number.format(entry.down)}</span> : null}
                      {entry.fires ? <span className="stats-rank-fire">🔥 {number.format(entry.fires)}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      <p className="stats-foot">
        Want the story behind the numbers? See <Link href="/whats-new">what&rsquo;s new</Link> or{" "}
        <Link href="/blog">read the blog</Link>.
      </p>
    </main>
  );
}

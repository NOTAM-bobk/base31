import Link from "next/link";
import sitesConfig from "@/config/sites.json";

export const metadata = {
  title: "Stats — Visitor Numbers for base31.org",
  description:
    "Live numbers for base31.org: total visitors, a daily visitor graph, the most liked tools in the directory, and how many people follow along.",
  alternates: { canonical: "/stats" },
  // Without this the page would inherit the layout's openGraph and og:url would
  // point at the homepage while the canonical says /stats.
  openGraph: {
    type: "website",
    url: "https://base31.org/stats",
    siteName: "base31.org",
    locale: "en_US",
    title: "Stats — Visitor Numbers for base31.org",
    description: "Total visitors, a daily visitor graph, and the most liked tools in the base31.org directory.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stats — base31.org",
    description: "Total visitors, a daily visitor graph, and the most liked tools in the directory.",
  },
};

// The public worker serves the numbers; see worker/src/index.ts (GET /stats).
const counterUrl = process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev";
const GRAPH_DAYS = 30;
// The worker caches /stats for the same window, so the page follows its lead.
export const revalidate = 300;

type DayPoint = { date: string; views: number };
type StatsTotals = {
  views: number;
  unique: number;
  last7: number;
  prev7: number;
  sites: number;
  subscribers: number;
  pushDevices: number;
  votes: { up: number; down: number };
};
type StatsPayload = { generatedAt: number; days: number; series: DayPoint[]; totals: StatsTotals; top: { key: string; up: number; down: number }[] };

const number = new Intl.NumberFormat("en-US");
const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const shortDay = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`));

// Names for the vote keys: curated entries come from config/sites.json, and a
// community upload is keyed by its own slug, which is readable as-is.
const siteNames = new Map((sitesConfig as { subdomain: string; name: string }[]).map((site) => [site.subdomain, site.name]));
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

function Chart({ series }: { series: DayPoint[] }) {
  const plotHeight = CHART.height - CHART.padTop - CHART.padBottom;
  const slot = (CHART.width - CHART.padX * 2) / series.length;
  const barWidth = Math.max(4, slot * 0.62);
  const peak = Math.max(...series.map((point) => point.views), 1);
  const peakIndex = series.reduce((best, point, index) => (point.views > series[best].views ? index : best), 0);
  const barX = (index: number) => CHART.padX + slot * index + (slot - barWidth) / 2;
  const barY = (views: number) => CHART.padTop + plotHeight * (1 - views / peak);

  return (
    <svg
      className="stats-chart"
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      role="img"
      aria-label={`Daily visitors over the last ${series.length} days. Busiest day: ${shortDay(series[peakIndex].date)} with ${series[peakIndex].views} views.`}
    >
      <defs>
        <linearGradient id="stats-bar" x1="0" y1="0" x2="0" y2="1">
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

      {series.map((point, index) => {
        const height = Math.max(2, plotHeight * (point.views / peak));
        return (
          <g key={point.date}>
            <rect
              x={barX(index)}
              y={barY(point.views)}
              width={barWidth}
              height={height}
              rx={Math.min(5, height / 2)}
              fill="url(#stats-bar)"
              opacity={point.views === 0 ? 0.3 : 1}
            />
            <title>{`${shortDay(point.date)} · ${number.format(point.views)} ${point.views === 1 ? "view" : "views"}`}</title>
          </g>
        );
      })}

      {/* Mark the busiest day so the shape of the graph has an anchor. */}
      {series[peakIndex].views > 0 && (
        <text
          x={Math.min(Math.max(barX(peakIndex) + barWidth / 2, 34), CHART.width - 34)}
          y={Math.max(barY(series[peakIndex].views) - 8, 12)}
          textAnchor="middle"
          className="stats-chart-peak"
        >
          {number.format(series[peakIndex].views)} peak
        </text>
      )}

      {[0, Math.floor(series.length / 2), series.length - 1].map((index, position) => (
        <text
          key={series[index].date}
          x={index === 0 ? CHART.padX : index === series.length - 1 ? CHART.width - CHART.padX : barX(index) + barWidth / 2}
          y={CHART.height - 8}
          textAnchor={position === 0 ? "start" : position === 1 ? "middle" : "end"}
          className="stats-chart-label"
        >
          {shortDay(series[index].date)}
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
  const chartHasData = series.some((point) => point.views > 0);
  const trend = totals && totals.prev7 > 0 ? Math.round(((totals.last7 - totals.prev7) / totals.prev7) * 100) : null;
  const graphWindow = series.reduce((running, point) => running + point.views, 0);
  const top = (stats?.top ?? []).filter((entry) => entry.up > 0);

  return (
    <main className="stats-page">
      <Link className="privacy-back mono" href="/">← base31.org</Link>
      <p className="eyebrow mono">stats</p>
      <h1>What the directory is doing right now.</h1>
      <p className="privacy-updated">
        Counted by the base31 counter, with no cookies and nothing that identifies a visitor. Views count every
        load; unique visitors are reduced to a one-way hash, so a reload does not count twice. Refreshed every five
        minutes.
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
              label="last 7 days"
              value={number.format(totals.last7)}
              note={trend === null ? "no previous week to compare" : `${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend)}% vs the week before`}
            />
            <Card label="tools listed" value={number.format(sitesConfig.length)} note={`${totals.sites} published by visitors`} />
            <Card label="votes cast" value={number.format(totals.votes.up + totals.votes.down)} note={`${number.format(totals.votes.up)} up · ${number.format(totals.votes.down)} down`} />
            <Card label="email subscribers" value={number.format(totals.subscribers)} note={`${number.format(totals.pushDevices)} push devices`} />
            <Card label="avg. per day" value={number.format(Math.round(graphWindow / Math.max(series.length, 1)))} note={`across the last ${series.length} days`} />
          </section>

          <section className="stats-panel" aria-labelledby="visitors-heading">
            <div className="stats-panel-head">
              <h2 id="visitors-heading">Visitors, last {series.length} days</h2>
              <span className="mono stats-panel-metric">{number.format(graphWindow)} views</span>
            </div>
            {chartHasData ? (
              <Chart series={series} />
            ) : (
              <p className="stats-notice" role="status">
                Daily history has only just started recording, so there is nothing to draw yet. The total above is still the all-time
                count — come back tomorrow for the first full day.
              </p>
            )}
          </section>

          <section className="stats-panel" aria-labelledby="liked-heading">
            <div className="stats-panel-head">
              <h2 id="liked-heading">Most liked tools</h2>
              <span className="mono stats-panel-metric">{top.length === 0 ? "no votes yet" : `${number.format(top.length)} ranked`}</span>
            </div>
            {top.length === 0 ? (
              <p className="stats-notice" role="status">
                Nobody has voted yet. Open any site in the <Link href="/#sites">directory</Link> and use the thumbs up to start the list.
              </p>
            ) : (
              <ol className="stats-ranking">
                {top.map((entry, index) => (
                  <li key={entry.key} className="stats-rank-row">
                    <span className="stats-rank mono">{String(index + 1).padStart(2, "0")}</span>
                    <span className="stats-rank-name">{displayName(entry.key)}</span>
                    <span className="stats-rank-votes mono">
                      <span className="stats-rank-up">▲ {number.format(entry.up)}</span>
                      {entry.down > 0 ? <span className="stats-rank-down">▼ {number.format(entry.down)}</span> : null}
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

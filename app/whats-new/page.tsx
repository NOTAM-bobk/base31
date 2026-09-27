import Link from "next/link";
import pkg from "@/package.json";
import changelog from "@/config/changelog.json";

export const metadata = {
  title: "What's New — base31.org Release Notes",
  description:
    "Every major update to base31.org in one place: new tools, homepage changes, and the release each one shipped in.",
  alternates: { canonical: "/whats-new" },
  // Same reason as /about: give the page its own openGraph, or og:url would
  // point at the homepage while the canonical says /whats-new.
  openGraph: {
    type: "website",
    url: "https://base31.org/whats-new",
    siteName: "base31.org",
    locale: "en_US",
    title: "What's New — base31.org Release Notes",
    description: "Every major update to base31.org: new tools, homepage changes, and the release each one shipped in.",
  },
  twitter: {
    card: "summary_large_image",
    title: "What's New — base31.org",
    description: "Every major update to base31.org, newest first.",
  },
};

type Release = { version: string; date: string; title: string; summary: string; highlights: string[] };

// `releases` is typed from the JSON import; the shape matches config/changelog.json
// and `npm run validate:content` fails the build check if an entry drifts.
const releases = changelog as Release[];

const longDate = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function WhatsNewPage() {
  return (
    <main className="privacy-page whats-new-page">
      <Link className="privacy-back mono" href="/">← base31.org</Link>
      <p className="eyebrow mono">what&rsquo;s new</p>
      <h1>Every change worth telling you about.</h1>
      <p className="privacy-updated">
        base31 is currently <strong>v{pkg.version}</strong>. Smaller fixes ship quietly; this page tracks the releases that changed
        how the site works.
      </p>

      <ol className="changelog">
        {releases.map((release, index) => (
          <li key={release.version} className="changelog-entry">
            <div className="changelog-rail" aria-hidden="true">
              <span className="changelog-dot" />
            </div>
            <article className="changelog-body">
              <div className="changelog-meta">
                <span className="changelog-version mono">v{release.version}</span>
                <time className="changelog-date mono" dateTime={release.date}>{longDate.format(new Date(`${release.date}T00:00:00Z`))}</time>
                {index === 0 ? <span className="changelog-latest mono">latest</span> : null}
              </div>
              <h2>{release.title}</h2>
              <p className="changelog-summary">{release.summary}</p>
              <ul className="changelog-list">
                {release.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ol>

      <p className="stats-foot">
        The next update will show up here and in the <Link href="/blog/feed.xml">RSS feed</Link>. Curious about the numbers behind it
        all? See <Link href="/stats">stats</Link>.
      </p>
    </main>
  );
}

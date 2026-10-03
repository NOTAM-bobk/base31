import Link from "next/link";
import type { Metadata } from "next";
import { websitesOfTheWeek } from "@/lib/websites-of-the-week";

const siteUrl = "https://base31.org";

export const metadata: Metadata = {
  title: "Websites of the Week — Interesting Websites Curated by base31.org",
  description: "One interesting website every week, with the story behind why it is worth your time.",
  alternates: { canonical: "/websites-of-the-week" },
  openGraph: {
    type: "website",
    title: "Websites of the Week — base31.org",
    description: "A weekly collection of interesting, independent, and useful websites.",
    url: `${siteUrl}/websites-of-the-week`,
    siteName: "base31.org",
    locale: "en_US",
  },
  twitter: { card: "summary", title: "Websites of the Week — base31.org", description: "A weekly collection of interesting websites." },
};

export default function WebsitesOfTheWeekPage() {
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Websites of the Week",
    description: "A weekly collection of interesting, independent, and useful websites.",
    url: `${siteUrl}/websites-of-the-week`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: websitesOfTheWeek.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: { "@type": "WebSite", name: entry.name, url: entry.url, description: entry.tagline },
      })),
    },
  };

  return (
    <main className="privacy-page weekly-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
      <Link className="privacy-back mono" href="/blog">← base31 blog</Link>
      <p className="eyebrow mono">weekly curation</p>
      <h1>Websites of the Week.</h1>
      <p className="privacy-updated">One interesting website, chosen by a person, with the story that made it worth sharing.</p>
      <p className="weekly-intro">The web is full of projects that deserve more than a passing link. Each week, base31 picks one site and explains what makes it memorable, useful, or delightfully strange.</p>

      <section className="weekly-list" aria-label="Websites of the Week">
        {websitesOfTheWeek.map((entry) => (
          <article className="weekly-card" key={entry.weekOf}>
            <div className="blog-meta mono"><time dateTime={entry.weekOf}>Week of {entry.weekOf}</time><span className="blog-tags">{entry.tags.join(" · ")}</span></div>
            <h2><a href={entry.url} target="_blank" rel="noreferrer">{entry.name} ↗</a></h2>
            <p className="weekly-tagline">{entry.tagline}</p>
            <p>{entry.story}</p>
            <a className="blog-read mono" href={entry.url} target="_blank" rel="noreferrer">Visit the website →</a>
          </article>
        ))}
      </section>

      <div className="blog-footer">
        <Link className="blog-read mono" href="/blog">Back to the blog →</Link>
        <Link className="blog-read mono" href="/#sites">Browse the directory →</Link>
      </div>
    </main>
  );
}

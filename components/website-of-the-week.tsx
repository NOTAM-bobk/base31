import Link from "next/link";
import { websitesOfTheWeek } from "@/lib/websites-of-the-week";

/**
 * The landing page's weekly pick, between the Top 10 and the submission form.
 *
 * It reads `config/websites-of-the-week.json` through
 * `lib/websites-of-the-week.ts`, which hands the list back newest-first, so the
 * spotlight and `/websites-of-the-week` can never disagree about which week is
 * current — the same entry leads both. An empty list renders nothing at all
 * rather than an empty frame.
 *
 * The story is printed in full: a weekly pick is one site worth a paragraph,
 * and the page it links to keeps the rest of the archive.
 */
export default function WebsiteOfTheWeek() {
  const [entry] = websitesOfTheWeek;
  if (!entry) return null;

  return (
    <section
      id="website-of-the-week"
      className="weekly-pick directory-section"
      data-reveal
      aria-labelledby="website-of-the-week-heading"
    >
      <div className="weekly-pick-heading">
        <span className="weekly-pick-mark" aria-hidden="true">✷</span>
        <h2 id="website-of-the-week-heading">Website of the week</h2>
        <span className="weekly-pick-week mono">week of {entry.weekOf}</span>
      </div>
      <p className="weekly-pick-name">
        <a href={entry.url} target="_blank" rel="noreferrer">
          {entry.name} <span aria-hidden="true">↗</span>
        </a>
      </p>
      <p className="weekly-pick-tagline">{entry.tagline}</p>
      <p className="weekly-pick-story">{entry.story}</p>
      <p className="weekly-pick-foot">
        <Link className="weekly-pick-all mono" href="/websites-of-the-week">
          Every website of the week <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}

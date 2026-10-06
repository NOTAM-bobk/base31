"use client";

import { useMemo } from "react";
import Link from "next/link";
import { detailPath, directoryEntries, tagTone } from "@/lib/directory";
import { searchScore } from "@/lib/search";

// The answer to a search, above the sections that hold the results.
//
// The directory is split into six collections, so a query that lands in several
// of them arrives as several separate lists and the visitor has to read all of
// them to find the one or two cards they actually asked for. This block puts
// the strongest matches from every collection in one place, at the top, ranked
// by `searchScore` in lib/search.ts (a name beats a tag, a tag beats the
// description). It is only there while there is a query to answer, and it
// renders nothing at all when nothing matched — a "no matches" note would only
// repeat what the page as a whole is already saying.
const LIMIT = 6;

export default function BestMatches({ query }: { query: string }) {
  const matches = useMemo(() => {
    const asked = query.trim();
    if (!asked) return [];
    return directoryEntries
      .map((entry) => ({ entry, score: searchScore(entry, asked) }))
      .filter((row) => row.score > 0)
      // A tie falls back to the name, so the order is stable between renders
      // and between two entries the score cannot separate.
      .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
      .slice(0, LIMIT);
  }, [query]);

  if (matches.length === 0) return null;

  return (
    <section id="best-matches" className="best-matches directory-section" aria-labelledby="best-matches-heading">
      <div className="section-heading">
        <h2 id="best-matches-heading" className="section-heading-main">Best matches</h2>
        <span className="section-count mono" aria-live="polite">
          {matches.length} of {directoryEntries.length} picks
        </span>
      </div>
      <p className="cool-lede">
        The closest answers to <strong className="mono">{query.trim()}</strong> across every
        collection, best first. The full lists are below.
      </p>
      <ul className="best-matches-list" role="list">
        {matches.map(({ entry }) => {
          const detail = detailPath(entry.url, entry.sectionId);
          return (
            <li key={entry.slug} className="best-match" role="listitem">
              <Link className="best-match-main" href={detail ?? `/sites/${entry.slug}`}>
                <span className="best-match-top">
                  <span className="best-match-name">{entry.name}</span>
                  <span className="best-match-section mono">{entry.section}</span>
                </span>
                <span className="best-match-desc">{entry.description}</span>
                {!!entry.tags?.length && (
                  <span className="best-match-tags mono">
                    {entry.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className={`tag tone-${tagTone(tag)}`}>#{tag}</span>
                    ))}
                  </span>
                )}
              </Link>
              <a className="best-match-visit mono" href={entry.url} target="_blank" rel="noopener noreferrer">
                Visit <span aria-hidden="true">↗</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { directoryEntries } from "@/lib/directory";
import { useSiteVotes } from "@/components/site-votes";
import { rankByVotes, totalVotes } from "@/lib/vote-ranking";
import { tick } from "@/lib/haptics";

// The ten most-voted picks in the directory, dressed as a streaming service's
// top ten: one row per entry, a big numeral down the left, and a flame on the
// heading.
//
// The ranking is the directory's own live data — the shared up/down totals the
// cards and the strips already read from the Worker (see `components/site-votes.tsx`),
// not an editorial list and not page views. Two consequences are deliberate:
//
//   * Until the totals arrive the rows keep the directory's own order, so the
//     section is never empty while the request is in flight.
//   * An entry nobody has voted on yet shows "no votes yet" rather than a
//     made-up number, and while the whole board is at zero the caption says so.
//     Every figure printed here is a real count or nothing at all.
//
// `rankByVotes` (lib/vote-ranking.ts) is the one ranking rule the whole site
// shares — total votes, up plus down, then name — so this board cannot disagree
// with the strips or with the `top` array `/stats` prints. `npm run test:directory`
// covers that rule directly, order and cut included.
const RANKS = 10;
const CANDIDATES = directoryEntries;
const CANDIDATE_KEYS = CANDIDATES.map((entry) => entry.voteKey);

export default function TopTen() {
  const { totals } = useSiteVotes(CANDIDATE_KEYS);
  const ranked = useMemo(() => rankByVotes(CANDIDATES, totals, RANKS), [totals]);
  const boardVotes = ranked.reduce((running, entry) => running + totalVotes(totals[entry.voteKey]), 0);
  if (ranked.length === 0) return null;

  return (
    <section id="top-ten" className="top-ten directory-section" aria-labelledby="top-ten-heading">
      <div className="top-ten-heading">
        <span className="top-ten-flame" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor">
            <path d="M13.6 1.4c.2 2.9-.8 4.7-2.4 6.3-1.6 1.6-3.3 3.3-3.3 6.2a6.6 6.6 0 0 0 13.2.2c0-2.4-1.1-4.3-2.3-5.8-.3 1-.9 1.8-1.8 2.2.5-3-.6-6.4-3.4-9.1Zm-1.2 12.4c1.1 0 1.9.9 1.9 2 0 .9-.5 1.7-1.2 2.3a3 3 0 0 1-3.9-2.8c0-1.4.8-2.4 1.6-3.3.2.9.7 1.6 1.6 1.8Z" />
          </svg>
        </span>
        <h2 id="top-ten-heading">Top 10 trending today</h2>
        <span className="top-ten-badge mono" aria-hidden="true">live</span>
      </div>
      <p className="top-ten-note">
        The ten most-voted picks on base31 right now, ranked by the up and down votes on every card.
        {boardVotes === 0
          ? " Nobody has voted on these ten yet, so they are in the directory's own order rather than a made-up one."
          : ` ${boardVotes} vote${boardVotes === 1 ? "" : "s"} across the ten.`}{" "}
        Community tallies, not page views.
      </p>
      <ol className="top-ten-list">
        {ranked.map((entry, index) => {
          const count = totalVotes(totals[entry.voteKey]);
          return (
            <li key={entry.voteKey} className="top-ten-row">
              {/* The numeral is decoration: the <ol> already numbers the rows
                  for anyone reading the list without seeing the big type. The
                  first three carry their own class so the podium reads in
                  colour without changing what the list says. */}
              <span className={`top-ten-rank${index < 3 ? ` is-top-${index + 1}` : ""}`} aria-hidden="true">{index + 1}</span>
              <span className="top-ten-body">
                <Link className="top-ten-name" href={`/sites/${entry.slug}`} onClick={() => tick(12)}>{entry.name}</Link>
                <span className="top-ten-meta mono">
                  {entry.section} · {count > 0 ? `${count} ${count === 1 ? "vote" : "votes"}` : "no votes yet"}
                </span>
              </span>
              <a
                className="top-ten-open"
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${entry.name} in a new tab`}
              >
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          );
        })}
      </ol>
      <p className="top-ten-foot">
        <Link className="top-ten-more" href="/explore" onClick={() => tick(12)}>Vote on the whole list <span aria-hidden="true">→</span></Link>
      </p>
    </section>
  );
}

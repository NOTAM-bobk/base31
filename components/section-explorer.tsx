"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { detailPath, externalVoteKey } from "@/lib/directory";
import { matchesQuery } from "@/lib/search";
import { compareVotes } from "@/lib/vote-ranking";
import SiteVotes, { useSiteVotes } from "@/components/site-votes";
import Freshness from "@/components/freshness";
import { tick } from "@/lib/haptics";
import type { SectionDef } from "@/lib/sections";

// One directory section on a page of its own.
//
// On /explore a section is a strip inside a long page: nine cards, one chip row
// and a shared search field at the top. Here the same collection is the whole
// page — every card, its own search box, its own chips and the vote rank — so
// someone who came for the cool APIs can stay in them instead of scrolling past
// five other lists.
//
// The search field is local state rather than a `?q=` parameter on purpose:
// nothing here needs to be shareable or crawlable (the indexable page is the
// unfiltered section itself), and the URL stays one address per section.
const PAGE = 12;

export default function SectionExplorer({ section }: { section: SectionDef }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const searching = query.trim().length > 0;

  // The chips narrow by whatever this collection is filed under: the coarse
  // category where it has one, its own tags where it does not.
  const filtered = useMemo(() => {
    const matched = section.items.filter((item) => matchesQuery(item, query));
    if (filter === null) return matched;
    return matched.filter((item) =>
      section.filterField === "category" ? item.category === filter : item.tags.includes(filter),
    );
  }, [section, query, filter]);

  // Votes reorder the list, so the busiest pick rises to the top here exactly
  // as it does on the homepage cards.
  const voteState = useSiteVotes(section.items.map((item) => externalVoteKey(item.url)));
  const ranked = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          compareVotes(voteState.totals[externalVoteKey(a.url)], voteState.totals[externalVoteKey(b.url)]) ||
          a.name.localeCompare(b.name),
      ),
    [filtered, voteState.totals],
  );

  // A search already answers with a short list, so the cut only applies to the
  // unfiltered browse; a new question starts the list from the top again.
  const shown = showAll || searching ? ranked : ranked.slice(0, PAGE);
  const foldCount = Math.max(0, ranked.length - PAGE);
  useEffect(() => {
    setShowAll(false);
  }, [query, filter]);

  return (
    <>
      <div className="search-wrap position-search" role="search">
        <span className="search-icon mono" aria-hidden="true">⌕</span>
        <input
          id="section-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${section.label}`}
          aria-label={`Search ${section.label}`}
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => { tick(6); setQuery(""); }}
            aria-label="Clear the search"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      {section.filters.length > 1 && (
        <div className="tag-filters cool-filters" role="group" aria-label={`Filter ${section.label}`}>
          <button
            type="button"
            className={`tag-chip${filter === null ? " is-active" : ""}`}
            aria-pressed={filter === null}
            onClick={() => { tick(6); setFilter(null); }}
          >
            All
          </button>
          {section.filters.map((name) => (
            <button
              key={name}
              type="button"
              className={`tag-chip${filter === name ? " is-active" : ""}`}
              aria-pressed={filter === name}
              onClick={() => { tick(6); setFilter(filter === name ? null : name); }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <p className="section-explorer-count mono" aria-live="polite">
        {filtered.length === section.items.length
          ? `${section.items.length} ${section.unit}`
          : `${filtered.length} of ${section.items.length} ${section.unit}`}
      </p>

      {filtered.length === 0 ? (
        <p className="section-closed-note" role="status">
          Nothing in {section.label} matches{searching ? ` “${query.trim()}”` : " that filter"}.{" "}
          <button type="button" className="empty-reset" onClick={() => { setQuery(""); setFilter(null); }}>
            Clear filters
          </button>
        </p>
      ) : (
        <div className="cool-grid section-explorer-grid" role="list">
          {shown.map((item, index) => {
            const detail = detailPath(item.url, section.id);
            return (
              <article key={item.url} className="cool-card" role="listitem" style={{ "--i": index } as CSSProperties}>
                <a href={item.url} className="cool-card-link" target="_blank" rel="noopener noreferrer">
                  <span className="cool-card-top">
                    <span className="cool-favicon" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element -- tiny
                          16px favicons, sized explicitly, no optimization needed */}
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=32`}
                        alt=""
                        width={16}
                        height={16}
                        loading="lazy"
                      />
                    </span>
                    <span className="cool-name">{item.name}</span>
                    <span className="cool-arrow mono" aria-hidden="true">↗</span>
                  </span>
                  <span className="cool-host mono">{new URL(item.url).hostname.replace(/^www\./, "")}</span>
                  <span className="cool-desc">{item.description}</span>
                </a>
                <Freshness item={item} />
                <div className="cool-card-footer">
                  {detail && <Link className="site-detail-link" href={detail}>Details →</Link>}
                  <SiteVotes voteKey={externalVoteKey(item.url)} name={item.name} state={voteState} />
                </div>
              </article>
            );
          })}
          {foldCount > 0 && !searching && (
            <button
              type="button"
              className="show-all"
              aria-expanded={showAll}
              onClick={() => { tick(8); setShowAll((value) => !value); }}
            >
              <span className="show-all-label">
                {showAll ? "Show fewer" : `Show all ${ranked.length} ${section.unit}`}
              </span>
              <span className="show-all-count mono" aria-hidden="true">
                {showAll ? `-${foldCount}` : `+${foldCount}`}
              </span>
            </button>
          )}
        </div>
      )}
    </>
  );
}

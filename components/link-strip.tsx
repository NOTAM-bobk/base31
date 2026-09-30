"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tick } from "@/lib/haptics";

export type LinkStripItem = { name: string; url: string; tags: string[]; description: string; category?: string };

/** The dictionary strings one strip needs, so a translated homepage folds and
    searches its strips in its own words. */
export type LinkStripCopy = {
  /** The heading, which is also the disclosure control. */
  heading: string;
  /** One line under the heading saying what the strip is. */
  lede: string;
  /** Says the strip is folded away, so the closed state is not a silent gap. */
  closed: string;
  /** Shown when a search matched nothing here. */
  noMatch: string;
  /** Count unit, e.g. "links". */
  unit: string;
  /** The "everything" chip, shown only when the strip has category chips. */
  all?: string;
  /** Names the chip row for assistive tech. */
  filterLabel?: string;
};

export type LinkStripProps = {
  /** Section id — also the anchor the rail scrolls to. */
  id: string;
  items: LinkStripItem[];
  search: (query: string) => LinkStripItem[];
  copy: LinkStripCopy;
  query?: string;
  /** Category names, in chip order. When present the strip grows a filter row
      that narrows the cards to one category. Both strips use it: "Cool APIs"
      files 63 links by topic, "Other cool sites" files 52 by kind. */
  categories?: string[];
};

// The foldable strips under the directory ("Other cool sites", "Cool APIs").
// A strip is deliberately smaller and quieter than the directory's cards: an
// external pointer, not a full listing, and every one opens in a new tab.
//
// The hero search reaches these strips too: the same query that narrows the
// directory narrows their cards, the strip opens itself when it has something
// to show, and the count says how many of the links matched. The heading is a
// disclosure control, exactly like "Featured sites" and "Support": it folds
// the strip away, says so in words while it is shut, and gives the section the
// same short wobble (plus a haptic tick) on every open and close so the toggle
// reads as a physical response.
//
// A strip given `categories` also carries a chip row — the same control the
// directory uses for tags, and the same row "Cool APIs" had first — so a long
// list can be cut down without typing. The chips combine with the hero search
// rather than replacing it: both narrow the same set, and the count reflects
// the two together.
//
// A strip is a long list, so it is cut short the same way the directory is:
// nine cards and one line at the end that opens the rest. The cut is wide
// enough to fill the three-column grid exactly, and it closes again whenever
// the question changes — new search text or another category chip — so a fresh
// look always starts from the top of a short list.
const SECTION_PREVIEW = 9;

export default function LinkStrip({ id, items, search, copy, query = "", categories }: LinkStripProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [vibrating, setVibrating] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  // Opens the rest of the strip. Everything past the ninth card is behind this.
  const [showAll, setShowAll] = useState(false);
  const mounted = useRef(false);

  const matches = useMemo(() => search(query), [search, query]);
  const visible = useMemo(
    () => (category ? matches.filter((item) => item.category === category) : matches),
    [matches, category],
  );
  const searching = query.trim().length > 0;
  const filtering = searching || category !== null;
  const shown = showAll ? visible : visible.slice(0, SECTION_PREVIEW);
  // How many cards the cut is holding back. The line reads it as "+43" while
  // they are hidden and "-43" once they are showing.
  const foldCount = Math.max(0, visible.length - SECTION_PREVIEW);
  const headingId = `${id}-heading`;
  const panelId = `${id}-panel`;

  // A search that reaches this strip opens it, so what it found is visible
  // instead of folded away. Setting `false` when it is already open does not
  // re-render, so this never fights the visitor's own toggle.
  useEffect(() => {
    if (searching && matches.length > 0) setCollapsed(false);
  }, [searching, matches.length]);

  // A new question starts a short list again, the way the directory's own cut
  // does: typing something else or picking another chip folds the strip back
  // to its first nine cards.
  useEffect(() => {
    setShowAll(false);
  }, [query, category]);

  useEffect(() => {
    // Skip the first render: the section starts open, and that is not a toggle.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setVibrating(true);
    tick(20);
    const timer = window.setTimeout(() => setVibrating(false), 460);
    return () => window.clearTimeout(timer);
  }, [collapsed]);

  return (
    <section
      id={id}
      className={`cool-section directory-section${vibrating ? " is-vibrating" : ""}`}
      data-reveal
      aria-labelledby={headingId}
    >
      <div className="section-heading">
        <h2 id={headingId} className="section-heading-main">
          <button
            type="button"
            className={`sites-toggle${collapsed ? " is-collapsed" : ""}`}
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-controls={panelId}
          >
            <span className="sites-toggle-label">{copy.heading}</span>
            <svg className="sites-toggle-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </h2>
        <span className="section-count mono" aria-live="polite">
          {filtering ? `${visible.length} of ${items.length}` : items.length} {copy.unit}
        </span>
      </div>

      {/* With the grid hidden the strip simply vanishes, so the closed state
          says so in words instead of leaving a silent gap. A search overrides
          that: the strip opens itself, and an empty result says so here. */}
      {collapsed && (
        <p className="section-closed-note" role="status">
          {copy.closed}
        </p>
      )}
      {filtering && visible.length === 0 && (
        <p className="section-closed-note" role="status">
          {copy.noMatch}
        </p>
      )}

      <div id={panelId} className="sites-panel" hidden={collapsed}>
        <p className="cool-lede">{copy.lede}</p>
        {categories && categories.length > 0 && (
          <div className="tag-filters cool-filters" role="group" aria-label={copy.filterLabel ?? "Filter by category"}>
            <button
              type="button"
              className={`tag-chip${category === null ? " is-active" : ""}`}
              aria-pressed={category === null}
              onClick={() => { tick(6); setCategory(null); }}
            >
              {copy.all ?? "All"}
            </button>
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                className={`tag-chip${category === name ? " is-active" : ""}`}
                aria-pressed={category === name}
                onClick={() => { tick(6); setCategory(name); }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        <div className="cool-grid" role="list">
          {shown.map((site) => (
            <a
              key={site.url}
              href={site.url}
              className="cool-card"
              role="listitem"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="cool-card-top">
                <span className="cool-favicon" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny
                      16px favicons, sized explicitly, no optimization needed */}
                  <img src={`https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=32`} alt="" width={16} height={16} loading="lazy" />
                </span>
                <span className="cool-name">{site.name}</span>
                <span className="cool-arrow mono" aria-hidden="true">↗</span>
              </span>
              <span className="cool-host mono">{new URL(site.url).hostname.replace(/^www\./, "")}</span>
              <span className="cool-desc">{site.description}</span>
            </a>
          ))}
          {/* The cut: nine cards and one line that opens the rest. It shows
              only while there is something behind it, and its count is the
              whole point of the line — so both are kept quiet and small. */}
          {foldCount > 0 && (
            <button
              type="button"
              className="show-all"
              aria-expanded={showAll}
              onClick={() => { tick(8); setShowAll((value) => !value); }}
            >
              <span className="show-all-label">
                {showAll ? "Show fewer" : `Show all ${visible.length} ${copy.unit}`}
              </span>
              <span className="show-all-count mono" aria-hidden="true">
                {showAll ? `-${foldCount}` : `+${foldCount}`}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

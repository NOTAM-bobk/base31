"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { allCoolSites, searchCoolSites } from "@/lib/cool-sites";
import { EN, type Dictionary } from "@/lib/i18n";

// The "Other cool sites" strip under the Featured sites directory. These are
// hand-picked sites that live at their own addresses — not base31 subdomains
// — edited purely through config/cool-sites.json. The cards are deliberately
// smaller and quieter than the directory's cards: an external pointer, not a
// full listing, and every one opens in a new tab.
//
// The hero search reaches this strip too: the same query that narrows the
// directory narrows these cards, the section opens itself when it has
// something to show, and the count says how many of the links matched.
//
// The heading is a disclosure control, exactly like "Featured sites" and
// "Support": it folds the strip away, says so in words while it is shut, and
// gives the section the same short wobble (plus a haptic tick) on every
// open and close so the toggle reads as a physical response.
export default function CoolSites({ dict = EN, query = "" }: { dict?: Dictionary; query?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [vibrating, setVibrating] = useState(false);
  const mounted = useRef(false);

  const matches = useMemo(() => searchCoolSites(query), [query]);
  const searching = query.trim().length > 0;

  // A search that reaches this strip opens it, so what it found is visible
  // instead of folded away. Setting `false` when it is already open does not
  // re-render, so this never fights the visitor's own toggle.
  useEffect(() => {
    if (searching && matches.length > 0) setCollapsed(false);
  }, [searching, matches.length]);

  useEffect(() => {
    // Skip the first render: the section starts open, and that is not a toggle.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setVibrating(true);
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(20);
    }
    const timer = window.setTimeout(() => setVibrating(false), 460);
    return () => window.clearTimeout(timer);
  }, [collapsed]);

  return (
    <section
      id="cool-sites"
      className={`cool-section directory-section${vibrating ? " is-vibrating" : ""}`}
      data-reveal
      aria-labelledby="cool-heading"
    >
      <div className="section-heading">
        <h2 id="cool-heading" className="section-heading-main">
          <button
            type="button"
            className={`sites-toggle${collapsed ? " is-collapsed" : ""}`}
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-controls="cool-panel"
          >
            <span className="sites-toggle-label">{dict.coolSites}</span>
            <svg className="sites-toggle-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </h2>
        <span className="section-count mono" aria-live="polite">
          {searching ? `${matches.length} of ${allCoolSites.length}` : allCoolSites.length} {dict.links}
        </span>
      </div>

      {/* With the grid hidden the strip simply vanishes, so the closed state
          says so in words instead of leaving a silent gap. A search overrides
          that: the strip opens itself, and an empty result says so here. */}
      {collapsed && (
        <p className="section-closed-note" role="status">
          {dict.coolSitesClosed}
        </p>
      )}
      {searching && matches.length === 0 && (
        <p className="section-closed-note" role="status">
          {dict.coolSitesNoMatch}
        </p>
      )}

      <div id="cool-panel" className="sites-panel" hidden={collapsed}>
        <p className="cool-lede">{dict.coolSitesLede}</p>
        <div className="cool-grid" role="list">
          {matches.map((site) => (
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
        </div>
      </div>
    </section>
  );
}

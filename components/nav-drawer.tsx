"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/dialog-focus";
import { searchScore } from "@/lib/search";

/** One row in the drawer. `meta` is the quiet count on the right. */
export type DrawerLink = { href: string; label: string; meta?: string };

/**
 * One pick the drawer's own search can find. The homepage hands over a slim
 * copy of every directory entry, so the panel can answer a query without
 * leaving the page.
 */
export type DrawerSearchItem = {
  name: string;
  /** Detail-page slug, so a result can open `/sites/<slug>`. */
  slug: string;
  url: string;
  /** The collection the pick came from, shown quietly beside its name. */
  section: string;
  description?: string;
  tags?: string[];
};

/** How many results the panel lists before it points at the full page. */
const RESULT_LIMIT = 6;

/**
 * The mobile navigation drawer: the panel that slides in from the right edge
 * when the header's nav button is tapped.
 *
 * It is the phone's replacement for a menu bar — a search field, the
 * "Explore:" list of directory categories, and a shorter row of the site's
 * other pages. Every category is a plain link to `/explore#<section>`, so
 * tapping one loads the directory page and the browser scrolls to that
 * section on its own; nothing here needs JavaScript to route, and the browser's
 * own back button works.
 *
 * The search is a plain `GET` form to `/explore`, so it still works before
 * hydration and still produces a shareable `/explore?q=…` URL — submitting it
 * travels to the directory exactly as it always did. Once React is running it
 * does one thing more: the field answers in place, listing the strongest
 * matches from the index the homepage passes in (`searchIndex`) as rows inside
 * the panel, each linking to that pick's `/sites/<slug>` page, with a last row
 * that hands the query to the full directory. A tap on a result closes the
 * panel, because the visitor has what they came for.
 *
 * The panel covers most of the screen but not all of it, so the strip of scrim
 * on the left stays tappable to close. That tap only works because the
 * full-screen overlay around the panel ignores pointer events of its own
 * (`pointer-events: none`; see app/directory.css) — otherwise the overlay,
 * which is painted above the scrim, swallows the tap. Escape closes it, focus
 * is trapped inside while it is open (see `lib/dialog-focus.ts`), and the page
 * behind it is locked from scrolling.
 *
 * The two lists are held open by default and each carries its own text control
 * ("Close"/"Open"), so a visitor can fold a group away instead of scrolling
 * past it — which is what a phone's short viewport usually wants.
 *
 * It is rendered at every width but only ever opened from the header button,
 * which CSS hides above the drawer's breakpoint — a desktop visitor keeps the
 * header links and the section rail instead.
 */
export default function NavDrawer({
  open,
  onClose,
  categories,
  more,
  searchIndex = [],
}: {
  open: boolean;
  onClose: () => void;
  categories: DrawerLink[];
  more: DrawerLink[];
  /** Every pick the panel's search can answer with. Omitted = links only. */
  searchIndex?: DrawerSearchItem[];
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Declared before the focus effect below so that the trap runs first and
  // this can move focus onto the field a visitor opened the drawer to use.
  useDialogFocus(open, panel);
  const searchRef = useRef<HTMLInputElement>(null);
  // The panel's own query, typed in the field. Submitting still hands the same
  // text to /explore as a normal form, so this is an enhancement, not a
  // replacement.
  const [query, setQuery] = useState("");
  // Both lists start open; "Close" folds one away.
  const [exploreOpen, setExploreOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(true);

  // Every open starts fresh: an empty field (so the last search is not
  // reshown to the next visitor to open the menu) and focus on the field,
  // which is what a visitor opened the panel to use.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setExploreOpen(true);
    setMoreOpen(true);
    searchRef.current?.focus();
  }, [open]);

  // Escape closes the panel. Captured on the document because focus may sit on
  // any control inside it; the homepage's own Escape handler only closes its
  // modals, so the two do not fight.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Lock the page behind the drawer, the same way the modals do.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const trimmed = query.trim();

  // The strongest matches, ranked by the same `searchScore` the directory's
  // "Best matches" block uses: a name beats a tag, a tag beats the
  // description. A zero score means "not a result" rather than "a weak one",
  // so an empty list is an honest no-match.
  const results = useMemo(() => {
    if (!trimmed) return [];
    return searchIndex
      .map((item) => ({ item, score: searchScore(item, trimmed) }))
      .filter((ranked) => ranked.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .slice(0, RESULT_LIMIT)
      .map((ranked) => ranked.item);
  }, [searchIndex, trimmed]);

  const toggleExplore = useCallback(() => setExploreOpen((value) => !value), []);
  const toggleMore = useCallback(() => setMoreOpen((value) => !value), []);

  return (
    <>
      {/* Decorative: the panel's own close button and Escape are the
          accessible ways out, so this never joins the tab order. A tap on it
          is the third way, and the one a thumb reaches for. */}
      <div className={`nav-drawer-scrim${open ? " is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <div className={`nav-drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
        <div
          ref={panel}
          tabIndex={-1}
          className="nav-drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nav-drawer-title"
        >
          <div className="nav-drawer-head">
            <p className="eyebrow mono" id="nav-drawer-title">menu</p>
            <button type="button" className="nav-drawer-close" onClick={onClose} aria-label="Close the menu">×</button>
          </div>

          {/* A real GET form rather than only a JS-driven field: the query
              travels in the URL to /explore, where the directory reads it on
              load. The field is controlled so the results below can follow it
              as it is typed. */}
          <form className="nav-drawer-search" role="search" action="/explore" method="get" onSubmit={onClose}>
            <span className="search-icon mono" aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search everything…"
              aria-label="Search the directory"
              autoComplete="off"
              enterKeyHint="search"
            />
            <button type="submit" className="nav-drawer-go mono">Search</button>
          </form>

          {/* The answer to the field. The region stays mounted whether or not
              there is a query, so a screen reader has a live region that
              already exists to announce into; an empty one prints nothing. */}
          <div className="nav-drawer-results" aria-live="polite">
            {trimmed ? (
              <>
                <p className="eyebrow mono nav-drawer-label">
                  {results.length === 0
                    ? "no matches"
                    : `${results.length}${results.length === RESULT_LIMIT ? "+" : ""} match${results.length === 1 ? "" : "es"}`}
                </p>
                {results.length > 0 ? (
                  <nav className="nav-drawer-links is-results" aria-label="Search results">
                    {results.map((item) => (
                      <a key={item.slug} href={`/sites/${item.slug}`} onClick={onClose}>
                        <span className="nav-drawer-result-name">{item.name}</span>
                        <span className="nav-drawer-meta mono" aria-hidden="true">{item.section}</span>
                      </a>
                    ))}
                  </nav>
                ) : (
                  <p className="nav-drawer-empty">
                    Nothing in the directory matches “{trimmed}”.
                  </p>
                )}
                <a className="nav-drawer-all mono" href={`/explore?q=${encodeURIComponent(trimmed)}`} onClick={onClose}>
                  Search everything for “{trimmed}” <span aria-hidden="true">→</span>
                </a>
              </>
            ) : null}
          </div>

          {/* Searching gives the categories up to the answer, so the panel
              stays the short list of things a thumb can reach. */}
          {trimmed ? null : (
            <>
              <div className="nav-drawer-group">
                <button
                  type="button"
                  className="nav-drawer-group-toggle"
                  aria-expanded={exploreOpen}
                  aria-controls="nav-drawer-explore"
                  onClick={toggleExplore}
                >
                  <span className="eyebrow mono">Explore:</span>
                  <span className="nav-drawer-group-action mono">{exploreOpen ? "Close" : "Open"}</span>
                </button>
              </div>
              <nav id="nav-drawer-explore" className="nav-drawer-links" aria-label="Directory categories" hidden={!exploreOpen}>
                {categories.map((link) => (
                  <a key={link.href} href={link.href} onClick={onClose}>
                    <span>{link.label}</span>
                    {link.meta ? <span className="nav-drawer-meta mono" aria-hidden="true">{link.meta}</span> : null}
                  </a>
                ))}
              </nav>

              <div className="nav-drawer-group">
                <button
                  type="button"
                  className="nav-drawer-group-toggle"
                  aria-expanded={moreOpen}
                  aria-controls="nav-drawer-more"
                  onClick={toggleMore}
                >
                  <span className="eyebrow mono">More on base31</span>
                  <span className="nav-drawer-group-action mono">{moreOpen ? "Close" : "Open"}</span>
                </button>
              </div>
              <nav id="nav-drawer-more" className="nav-drawer-links is-secondary" aria-label="More pages" hidden={!moreOpen}>
                {more.map((link) => (
                  <a key={link.href} href={link.href} onClick={onClose}>
                    <span>{link.label}</span>
                    {link.meta ? <span className="nav-drawer-meta mono" aria-hidden="true">{link.meta}</span> : null}
                  </a>
                ))}
              </nav>
            </>
          )}
        </div>
      </div>
    </>
  );
}

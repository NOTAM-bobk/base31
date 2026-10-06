"use client";

import { useEffect, useRef } from "react";
import { useDialogFocus } from "@/lib/dialog-focus";

/** One row in the drawer. `meta` is the quiet count on the right. */
export type DrawerLink = { href: string; label: string; meta?: string };

/**
 * The mobile navigation drawer: the panel that slides in from the right edge
 * when the header's nav button is tapped.
 *
 * It is the phone's replacement for a menu bar — a search field, the
 * "Explore:" list of directory categories, and a shorter row of the site's
 * other pages. Every category is a plain link to `/explore#<section>`, so
 * tapping one loads the directory page and the browser scrolls to that
 * section on its own; nothing here needs JavaScript to route, and the browser's
 * own back button works. The search field is a plain `GET` form to `/explore`,
 * so it works before hydration and produces a shareable `/explore?q=…` URL.
 *
 * The panel covers most of the screen but not all of it, so the strip of scrim
 * on the left stays tappable to close. Escape closes it, focus is trapped
 * inside while it is open (see `lib/dialog-focus.ts`), and the page behind it
 * is locked from scrolling.
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
}: {
  open: boolean;
  onClose: () => void;
  categories: DrawerLink[];
  more: DrawerLink[];
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Declared before the focus effect below so that the trap runs first and
  // this can move focus onto the field a visitor opened the drawer to use.
  useDialogFocus(open, panel);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
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

  return (
    <>
      {/* Decorative: the panel's own close button and Escape are the
          accessible ways out, so this never joins the tab order. */}
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

          {/* A real GET form rather than a JS-driven field: the query travels
              in the URL to /explore, where the directory reads it on load. */}
          <form className="nav-drawer-search" role="search" action="/explore" method="get">
            <span className="search-icon mono" aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              type="search"
              name="q"
              placeholder="Search everything…"
              aria-label="Search the directory"
              autoComplete="off"
              enterKeyHint="search"
            />
            <button type="submit" className="nav-drawer-go mono">Search</button>
          </form>

          <p className="eyebrow mono nav-drawer-label">Explore:</p>
          <nav className="nav-drawer-links" aria-label="Directory categories">
            {categories.map((link) => (
              <a key={link.href} href={link.href} onClick={onClose}>
                <span>{link.label}</span>
                {link.meta ? <span className="nav-drawer-meta mono" aria-hidden="true">{link.meta}</span> : null}
              </a>
            ))}
          </nav>

          <p className="eyebrow mono nav-drawer-label">More on base31</p>
          <nav className="nav-drawer-links is-secondary" aria-label="More pages">
            {more.map((link) => (
              <a key={link.href} href={link.href} onClick={onClose}>
                <span>{link.label}</span>
                {link.meta ? <span className="nav-drawer-meta mono" aria-hidden="true">{link.meta}</span> : null}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}

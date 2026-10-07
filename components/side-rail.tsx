"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { tick } from "@/lib/haptics";

/** One row in the rail. `meta` is the quiet count on the right, `icon` names
    the glyph drawn beside the label. */
export type RailLink = { href: string; label: string; meta?: string; icon: string };

/** Where the field the Search row stands for actually lives. */
const SEARCH_HREF = "/explore";

/**
 * The desktop side rail: the left-hand column a wide screen gets in place of
 * the phone's drawer.
 *
 * It carries the same two lists the drawer does — the directory's own
 * collections, each with the count of what it holds, and the site's other pages
 * — so the two navigations are the same map drawn twice and cannot disagree
 * about where a section lives. The collections fold away behind their own
 * heading (open by default, since a visitor who came to browse wants them), and
 * the submission sits at the foot as the one thing the rail is asking for.
 *
 * Two details in here are doing real work rather than decorating:
 *
 * - The search row is a link to `/explore`, where the field is, and the `⌘K`
 *   label on it is bound: the component listens for `⌘K`/`Ctrl+K` and clicks
 *   that row. A hint nobody can press is worse than no hint.
 * - The row for the page the visitor is already on is marked (`aria-current`
 *   and a bar on the rail's own edge), because a navigation column is read at a
 *   glance and "you are here" is half of what a glance needs.
 *
 * It is rendered at every width and hidden with CSS below the rail's
 * breakpoint, so a phone keeps the header and its drawer and never sees this.
 * Every row is a plain link — no routing code, and the browser's own Back
 * button works, exactly as in the drawer.
 */
export default function SideRail({
  links,
  categories,
  submit,
  current = "",
}: {
  /** The site's own pages, drawn directly under the search row. */
  links: RailLink[];
  /** The directory's collections: the group that folds away. */
  categories: RailLink[];
  /** The one row at the foot of the rail. */
  submit: RailLink;
  /** The path this page already is, marked as the current row. */
  current?: string;
}) {
  const search = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(true);

  // `⌘K` / `Ctrl+K` makes the same trip the Search row does. Bound on the
  // document so it works wherever the visitor's focus is, and harmless at
  // widths where the rail is not on screen.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      search.current?.click();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const fold = useCallback(() => {
    tick(8);
    setOpen((value) => !value);
  }, []);

  return (
    <aside className="side-rail" aria-label="Directory navigation">
      <a className="side-rail-search" href={SEARCH_HREF} ref={search} onClick={() => tick(12)}>
        <RailIcon name="search" />
        <span>Search</span>
        <span className="side-rail-kbd mono" aria-hidden="true">⌘K</span>
      </a>

      <nav className="side-rail-nav" aria-label="Site pages">
        {links.map((link) => <RailRow key={link.href} link={link} current={current} />)}
      </nav>

      <div className="side-rail-group">
        <button
          type="button"
          className="side-rail-group-head"
          aria-expanded={open}
          aria-controls="side-rail-categories"
          onClick={fold}
        >
          <span>Categories</span>
          <span className={`side-rail-chevron${open ? " is-open" : ""}`} aria-hidden="true">⌄</span>
        </button>
        {/* Folded with the `hidden` attribute rather than a class, so the rows
            are out of the tab order as well as off the screen. */}
        <div id="side-rail-categories" hidden={!open}>
          <nav className="side-rail-nav" aria-label="Directory collections">
            {categories.map((link) => <RailRow key={link.href} link={link} current={current} />)}
          </nav>
        </div>
      </div>

      <a className="side-rail-submit" href={submit.href} onClick={() => tick(10)}>
        <RailIcon name={submit.icon} />
        <span className="side-rail-label">{submit.label}</span>
        <span className="side-rail-submit-arrow mono" aria-hidden="true">→</span>
      </a>
    </aside>
  );
}

/** A row of the rail: the glyph, the name, and the count when it has one. */
function RailRow({ link, current }: { link: RailLink; current: string }) {
  const here = link.href === current;
  return (
    <a
      className={`side-rail-link${here ? " is-current" : ""}`}
      href={link.href}
      aria-current={here ? "page" : undefined}
      onClick={() => tick(12)}
    >
      <RailIcon name={link.icon} />
      <span className="side-rail-label">{link.label}</span>
      {link.meta ? <span className="side-rail-meta mono">{link.meta}</span> : null}
    </a>
  );
}

/* The glyphs, one path per name, all on the same 24-unit grid and drawn in the
   label's colour so a row lights up as one piece. Kept here rather than in an
   icon library because the site has no icon dependency and eight small paths
   are cheaper than one. */
const ICONS: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.6-3.6" /></>,
  grid: <><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5z" /></>,
  article: <><path d="M6 3h8l4 4v14H6z" /><path d="M9 12h6M9 16h6" /></>,
  bookmark: <><path d="M7 3h10v18l-5-4-5 4z" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 2" /></>,
  tools: <><path d="M4 7h10M4 12h16M4 17h7" /><circle cx="17" cy="7" r="2" /><circle cx="13" cy="17" r="2" /></>,
  hash: <><path d="M9.5 4 7.5 20M16.5 4l-2 16M4 9h16M3.5 15h16" /></>,
  chart: <><path d="M4 20V10M12 20V4M20 20v-7" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8.2h.01" /></>,
  shield: <><path d="M12 3l7 3v5.5c0 4-2.9 7-7 9-4.1-2-7-5-7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  trophy: <><path d="M8 4h8v4.5a4 4 0 0 1-8 0z" /><path d="M8 5H5.5v1.5A3 3 0 0 0 8 9.4M16 5h2.5v1.5A3 3 0 0 1 16 9.4M10 20h4M12 13v7" /></>,
  sparkle: <><path d="M11 4.5l1.6 4.4 4.4 1.6-4.4 1.6L11 16.5 9.4 12.1 5 10.5l4.4-1.6z" /><path d="M18 4.5v3M19.5 6h-3" /></>,
  cube: <><path d="m12 3.5 7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z" /><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 11.9v8.6" /></>,
  braces: <><path d="M8.5 4H7.5A2.5 2.5 0 0 0 5 6.5v2.9L3 12l2 2.6v2.9A2.5 2.5 0 0 0 7.5 20h1" /><path d="M15.5 4h1A2.5 2.5 0 0 1 19 6.5v2.9L21 12l-2 2.6v2.9A2.5 2.5 0 0 1 16.5 20h-1" /></>,
  wand: <><path d="m5 19 9-9" /><path d="M15.5 4.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9zM19 14l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" /></>,
  plus: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8.5v7M8.5 12h7" /></>,
};

function RailIcon({ name }: { name: string }) {
  return (
    <svg
      className="side-rail-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] ?? ICONS.grid}
    </svg>
  );
}

"use client";

import GithubStats from "@/components/github-stats";
import { tick } from "@/lib/haptics";

/* The site header: the wordmark, the navigation links, and the account-level
   actions (the repository commit count, the theme toggle, and — on a phone —
   the button that opens the navigation drawer). It lives in its own component
   so the homepage stays a readable list of sections — the language switcher
   used to sit in here too and now belongs to the footer.

   `Explore` is the directory link: the sites themselves live on /explore now,
   so the header points at them from every page and every width, which is what
   a desktop visitor gets instead of the drawer. */
export default function SiteHeader({
  theme,
  onToggleTheme,
  onOpenNav,
  navOpen = false,
}: {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  /** Opens the navigation drawer. Omitted on pages that have no drawer. */
  onOpenNav?: () => void;
  /** Whether the drawer is open, for the button's expanded state. */
  navOpen?: boolean;
}) {
  const next = theme === "dark" ? "light" : "dark";

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="wordmark mono" href="/" aria-label="base31.org home">
          {/* Decorative: the link already carries its own label. Served from
              public/ so the page keeps one origin; see app/overrides.css for
              why, and the footer for the credit. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="wordmark-sparkle" src="/header-sparkle.gif" alt="" width={40} height={40} aria-hidden="true" />
          base31.org
        </a>
        {/* The nav links buzz on the way out through the Vibration API, so
            tapping one registers on a phone. `tick` is silent on a device
            without a motor and for anyone who prefers reduced motion. */}
        <nav className="site-nav" aria-label="Main navigation">
          <a href="/explore" onClick={() => tick(12)}>Explore</a>
          <a href="/blog" onClick={() => tick(12)}>Blog</a>
        </nav>
        <div className="header-actions">
          {/* The header used to carry a Share button; it shows the
              repository's commit count now and links to the source. The
              share sheet is still reachable with the S shortcut. */}
          <GithubStats />
          <button
            type="button"
            className="icon-button theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${next} mode`}
            title={`Switch to ${next} mode`}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          {/* Phone-only (app/directory.css): the drawer holds the search field
              and the category list, which the header has no room for. */}
          {onOpenNav && (
            <button
              type="button"
              className="icon-button nav-toggle"
              onClick={onOpenNav}
              aria-label="Open the menu"
              aria-haspopup="dialog"
              aria-expanded={navOpen}
            >
              <MenuIcon />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.4 6.4 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

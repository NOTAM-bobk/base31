"use client";

import GithubStats from "@/components/github-stats";

/* The site header: the wordmark, the one navigation link, and the
   account-level actions (the repository commit count and the theme toggle).
   It lives in its own component so the homepage stays a readable list of
   sections — the language switcher used to sit in here too and now belongs to
   the footer. */
export default function SiteHeader({
  theme,
  onToggleTheme,
}: {
  theme: "dark" | "light";
  onToggleTheme: () => void;
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
        <nav className="site-nav" aria-label="Main navigation">
          <a href="/blog">Blog</a>
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

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.4 6.4 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

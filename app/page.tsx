"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import sites from "@/config/sites.json";

type Site = { name: string; subdomain: string; url: string; tags?: string[]; description?: string; show?: boolean };
type Theme = "dark" | "light";
type Vote = 1 | -1;

const siteUrl = "https://base31.org";
const counterUrl = "https://base31-directory-counter.sawyerbobk563.workers.dev";
const donationUrl = "https://donation.base31.org";

const visibleSites = (sites as Site[]).filter((site) => site.show !== false);
const searchIndex = (site: Site) =>
  `${site.name} ${site.subdomain} ${(site.tags || []).join(" ")} ${site.description || ""}`.toLowerCase();

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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.35-9-8.5A5 5 0 0 1 12 6.5 5 5 0 0 1 21 11.5C19 15.65 12 20 12 20Z" />
    </svg>
  );
}

function ThumbIcon({ down }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={down ? { transform: "rotate(180deg)" } : undefined}>
      <path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Z" />
      <path d="M7 10l4.3-6.6a1.8 1.8 0 0 1 3.3 1.1L13.7 8H18a2 2 0 0 1 2 2.4l-1 6.2a2 2 0 0 1-2 1.4H7" />
    </svg>
  );
}

function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("has-custom-cursor");
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let raf = 0;
    const onMove = (event: PointerEvent) => {
      mx = event.clientX;
      my = event.clientY;
      if (dot.current) dot.current.style.transform = `translate(${mx}px, ${my}px)`;
      const target = event.target as HTMLElement | null;
      ring.current?.classList.toggle("is-active", !!target?.closest("a, button, input, select, textarea, .site-card"));
    };
    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (ring.current) ring.current.style.transform = `translate(${rx}px, ${ry}px)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, []);

  return (
    <div className="cursor-layer" aria-hidden="true">
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
    </div>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [theme, setTheme] = useState<Theme>("dark");
  const [views, setViews] = useState<number | null>(null);
  const [bump, setBump] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [consentNeeded, setConsentNeeded] = useState(false);
  const [booting, setBooting] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);

  // Load saved preferences after mount so SSR markup stays stable.
  useEffect(() => {
    try {
      const storedFavorites = JSON.parse(localStorage.getItem("base31-favorites") || "[]");
      if (Array.isArray(storedFavorites)) setFavorites(storedFavorites.filter((key): key is string => typeof key === "string"));
      const storedVotes = JSON.parse(localStorage.getItem("base31-votes") || "{}");
      if (storedVotes && typeof storedVotes === "object") setVotes(storedVotes as Record<string, Vote>);
      const storedTheme = localStorage.getItem("base31-theme");
      setTheme(storedTheme === "light" ? "light" : "dark");
      if (!localStorage.getItem("base31-consent")) setConsentNeeded(true);
    } catch {
      setConsentNeeded(true);
    }
    setHydrated(true);
  }, []);

  // Persist state, but only once it has been loaded.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("base31-favorites", JSON.stringify(favorites));
    } catch {}
  }, [favorites, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("base31-votes", JSON.stringify(votes));
    } catch {}
  }, [votes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("base31-theme", theme);
    } catch {}
  }, [theme, hydrated]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#fafafa" : "#000000");
  }, [theme]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 420);
    return () => window.clearTimeout(timer);
  }, []);

  // View counter + milestone detection.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    let alive = true;
    fetch(`${counterUrl}/?key=base31-directory`, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("bad response"))))
      .then((data) => {
        if (!alive || !Number.isFinite(data?.views)) return;
        const count = Number(data.views);
        setViews(count);
        setBump(true);
        window.setTimeout(() => setBump(false), 700);
        if (count > 0 && count % 10 === 0) setMilestone(count);
      })
      .catch(() => {})
      .finally(() => window.clearTimeout(timer));
    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  // Confetti when a milestone fires.
  useEffect(() => {
    if (milestone == null) return;
    const pieces: HTMLElement[] = [];
    for (let i = 0; i < 28; i++) {
      const piece = document.createElement("i");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * 0.35}s`;
      piece.style.setProperty("--hue", String(Math.floor(Math.random() * 360)));
      document.body.appendChild(piece);
      pieces.push(piece);
    }
    const timer = window.setTimeout(() => pieces.forEach((piece) => piece.remove()), 1900);
    return () => {
      window.clearTimeout(timer);
      pieces.forEach((piece) => piece.remove());
    };
  }, [milestone]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "Escape") {
        setShareOpen(false);
        setMilestone(null);
        if (searchRef.current && document.activeElement === searchRef.current) {
          setQuery("");
          searchRef.current.blur();
        }
        return;
      }
      if (typing) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key.toLowerCase() === "s" && !shareOpen && milestone == null) {
        event.preventDefault();
        setShareOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [milestone, shareOpen]);

  // Lock background scroll while a modal is open.
  useEffect(() => {
    const open = shareOpen || milestone != null;
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [shareOpen, milestone]);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const toggleFavorite = useCallback((key: string) => {
    setFavorites((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }, []);

  const castVote = useCallback((key: string, direction: Vote) => {
    setVotes((current) => {
      const next = { ...current };
      if (next[key] === direction) delete next[key];
      else next[key] = direction;
      return next;
    });
  }, []);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = visibleSites.filter((site) => !needle || searchIndex(site).includes(needle));
    return [...matched].sort((a, b) => {
      const pinnedA = favorites.includes(a.subdomain) ? 1 : 0;
      const pinnedB = favorites.includes(b.subdomain) ? 1 : 0;
      return pinnedB - pinnedA || a.name.localeCompare(b.name);
    });
  }, [query, favorites]);

  const copyLink = useCallback(async (text = siteUrl) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement("textarea");
        input.value = text;
        input.setAttribute("readonly", "true");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
        input.remove();
      }
      notify("Link copied");
    } catch {
      notify("Couldn't copy");
    }
  }, [notify]);

  const nativeShare = useCallback(async () => {
    const data = { title: "base31.org", text: "Cool sites for curious people.", url: siteUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else await copyLink();
    } catch {}
  }, [copyLink]);

  const acceptConsent = useCallback((value: "accepted" | "denied") => {
    try {
      localStorage.setItem("base31-consent", value);
    } catch {}
    setConsentNeeded(false);
  }, []);

  const shareText = encodeURIComponent("Cool sites for curious people — base31.org");
  const shareUrl = encodeURIComponent(siteUrl);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${siteUrl}/#website`, url: siteUrl, name: "base31.org", description: "An independent directory of cool sites, fun websites, creative web projects, and useful online tools.", inLanguage: "en-US" },
      {
        "@type": "ItemList",
        "@id": `${siteUrl}/#directory`,
        name: "base31.org website directory",
        description: "A list of live sites and web projects on base31.org.",
        numberOfItems: visibleSites.length,
        itemListElement: visibleSites.map((site, index) => ({ "@type": "ListItem", position: index + 1, name: site.name, url: site.url })),
      },
    ],
  };

  return (
    <>
      <Cursor />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <header className="site-header">
        <div className="site-header-inner">
          <a className="wordmark mono" href="/" aria-label="base31.org home">base31.org</a>
          <nav className="site-nav" aria-label="Main navigation">
            <a href="#sites">Sites</a>
            <a href="#about">About</a>
          </nav>
          <div className="header-actions">
            <button type="button" className="icon-button share-button mono" onClick={() => setShareOpen(true)} aria-label="Share base31.org">
              <span>Share</span>
              <kbd className="shortcut-hint">S</kbd>
              <span aria-hidden="true">↗</span>
            </button>
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow mono">the independent web directory</p>
          <h1 id="page-title">Cool sites for curious people.</h1>
          <p className="subtitle">Discover fun websites, useful online tools, and creative web projects built on base31.org and the open web.</p>
          <div className="intro-links">
            <a className="text-link" href="#sites">Browse all sites <span aria-hidden="true">↓</span></a>
            <a className="text-link muted-link" href="#about">Why base31? <span aria-hidden="true">→</span></a>
          </div>
          <label className="search-wrap" htmlFor="site-search">
            <span className="search-icon mono" aria-hidden="true">⌕</span>
            <input
              id="site-search"
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search all sites..."
              autoComplete="off"
            />
            <kbd className="shortcut-hint">/</kbd>
          </label>
        </section>

        <section id="sites" className="directory-section" aria-labelledby="sites-heading">
          <div className="section-heading">
            <h2 id="sites-heading">Featured sites</h2>
            <span className="section-count mono">
              {query.trim() ? `${list.length} match${list.length === 1 ? "" : "es"}` : `${visibleSites.length} live`} · pinned first
            </span>
          </div>
          <div className="site-list" aria-label="Deployed sites">
            {list.length === 0 && <p className="empty">No sites match “{query.trim()}”. Try another search.</p>}
            {list.map((site, index) => {
              const pinned = favorites.includes(site.subdomain);
              const vote = votes[site.subdomain];
              return (
                <article
                  key={site.subdomain}
                  className={`site-card${pinned ? " is-pinned" : ""}`}
                  style={{ "--i": index } as CSSProperties}
                >
                  <div className="site-card-top">
                    <a href={site.url} className="site-link" target="_blank" rel="noreferrer">
                      <span className="site-name-row">
                        <span className="live-dot" aria-hidden="true" />
                        <span className="site-name">{site.name}</span>
                        <span className="site-arrow mono" aria-hidden="true">↗</span>
                      </span>
                    </a>
                    <div className="site-actions">
                      <button
                        type="button"
                        className={`favorite-button${pinned ? " is-active" : ""}`}
                        onClick={() => toggleFavorite(site.subdomain)}
                        aria-pressed={pinned}
                        aria-label={pinned ? `Unpin ${site.name}` : `Pin ${site.name} to the top`}
                      >
                        <HeartIcon filled={pinned} />
                      </button>
                      <button
                        type="button"
                        className={`vote-button up${vote === 1 ? " is-active" : ""}`}
                        onClick={() => castVote(site.subdomain, 1)}
                        aria-pressed={vote === 1}
                        aria-label={`Thumbs up ${site.name}`}
                      >
                        <ThumbIcon />
                      </button>
                      <button
                        type="button"
                        className={`vote-button down${vote === -1 ? " is-active" : ""}`}
                        onClick={() => castVote(site.subdomain, -1)}
                        aria-pressed={vote === -1}
                        aria-label={`Thumbs down ${site.name}`}
                      >
                        <ThumbIcon down />
                      </button>
                    </div>
                  </div>
                  <a href={site.url} className="site-link site-details" target="_blank" rel="noreferrer">
                    <p className="site-url mono">{site.url.replace(/^https?:\/\//, "")}</p>
                    {site.description && <p className="site-description">{site.description}</p>}
                    {site.tags && site.tags.length > 0 && (
                      <div className="tags" aria-label="Tags">
                        {site.tags.map((tag) => <span key={tag} className="tag mono">{tag}</span>)}
                      </div>
                    )}
                  </a>
                </article>
              );
            })}
            {booting && (
              <div className="site-skeleton" aria-hidden="true">
                {visibleSites.map((site) => <div key={site.subdomain} className="skeleton-card" />)}
              </div>
            )}
          </div>
        </section>

        <section id="about" className="about-section" aria-labelledby="about-heading">
          <p className="eyebrow mono">about the directory</p>
          <h2 id="about-heading">A small home for the interesting internet.</h2>
          <p>base31.org is an independent collection of personal sites, experiments, tools, and other projects worth exploring. It is a hand-built alternative to noisy app lists: every link leads to a real project with something to see or use.</p>
          <p>Looking for Base44? base31 is a separate, independent project and is not affiliated with Base44. Start here for a different kind of website directory: slower, stranger, and made for curious people.</p>
          <div className="topic-links">
            <a href="#sites">Cool sites</a>
            <a href="#sites">Fun websites</a>
            <a href="#sites">Creative web projects</a>
            <a href="#sites">Useful online tools</a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner mono">
          <span>© {new Date().getFullYear()} base31.org · built by Sawyer Schulz</span>
          <nav className="footer-links" aria-label="Footer navigation">
            <a href="/about">About</a>
            <a href="/terms">Terms of service</a>
            <a href="/privacy">Privacy</a>
            <a href="#page-title">Top ↑</a>
          </nav>
        </div>
      </footer>

      <div className={`view-counter mono${bump ? " is-bumped" : ""}`} aria-live="polite" aria-label="Directory page views">
        <span>views</span>
        <strong>{views == null ? "—" : views.toLocaleString()}</strong>
      </div>

      <aside className="donation-board" aria-label="Donation board">
        <div className="donation-head">Donation board</div>
        <p className="donation-empty">No entries yet.</p>
        <a className="donation-cta" href={donationUrl} target="_blank" rel="noreferrer">
          Support base31 <span aria-hidden="true">↗</span>
        </a>
      </aside>

      {consentNeeded && (
        <aside className="cookie-consent" aria-label="Cookie consent">
          <p>We store a tiny preference to remember your choice. <a href="/privacy">Privacy policy</a>.</p>
          <div className="cookie-actions">
            <button type="button" className="cookie-button cookie-deny" onClick={() => acceptConsent("denied")}>Deny</button>
            <button type="button" className="cookie-button cookie-confirm" onClick={() => acceptConsent("accepted")}>Confirm</button>
          </div>
        </aside>
      )}

      {shareOpen && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShareOpen(false)}>
          <div className="modal share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-title">
            <button type="button" className="modal-close" onClick={() => setShareOpen(false)} aria-label="Close share screen">×</button>
            <p className="eyebrow mono">share the directory</p>
            <h2 id="share-title">Send base31 to a friend.</h2>
            <div className="share-preview">
              <span className="share-mark mono">31</span>
              <p><strong>base31.org</strong>Cool sites for curious people.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="primary" onClick={nativeShare}>Share…</button>
              <button type="button" onClick={() => copyLink()}>Copy link</button>
              <a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noreferrer">X</a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noreferrer">Facebook</a>
              <a href={`mailto:?subject=${shareText}&body=${shareUrl}`}>Email</a>
            </div>
          </div>
        </div>
      )}

      {milestone != null && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setMilestone(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="milestone-title" aria-live="polite">
            <button type="button" className="modal-close" onClick={() => setMilestone(null)} aria-label="Close milestone">×</button>
            <p className="eyebrow mono">directory milestone</p>
            <h2 id="milestone-title">You were visitor <strong>{milestone.toLocaleString()}</strong>.</h2>
            <p>You helped base31 reach another milestone. Save it or share the moment.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="primary"
                onClick={async () => {
                  const data = { title: "A base31 milestone", text: `I was the ${milestone}th visit to base31.org!`, url: siteUrl };
                  try {
                    if (navigator.share) await navigator.share(data);
                    else await copyLink(data.text);
                  } catch {
                    notify("Share cancelled");
                  }
                }}
              >
                Share milestone
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = `BASE31.ORG\n\nMILESTONE CERTIFICATE\n\nThis certifies that you were visitor number ${milestone} to the base31 directory.\n\nCool sites for curious people.\nhttps://base31.org`;
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
                  link.download = `base31-milestone-${milestone}.txt`;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
                }}
              >
                Download certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

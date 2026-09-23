"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import sites from "@/config/sites.json";
import DonationBoard from "@/components/donation-board";
import Faq from "@/components/faq";
import ReferralCarousel from "@/components/referral-carousel";
import { resetConsent, useConsent } from "@/lib/consent";

type Site = { name: string; subdomain: string; url: string; tags?: string[]; description?: string; show?: boolean; community?: boolean; createdAt?: number };
type Theme = "dark" | "light";
// This visitor's own choice, stored locally.
type Vote = 1 | -1;
// Every choice the worker understands: 1 = up, -1 = down, 0 = cleared.
type VoteValue = 1 | 0 | -1;
type VoteTotals = { up: number; down: number };
// A site a visitor uploaded. The worker hosts its files from Cloudflare KV.
type PublishedSite = { slug: string; title: string; description: string; tags: string[]; url: string; createdAt: number };

const siteUrl = "https://base31.org";
// Cloudflare Worker deployed from `worker/`. It serves the KV-backed view
// counter (`GET /?key=`) and the shared thumbs up/down totals (`GET /votes`,
// `POST /vote`). Override with NEXT_PUBLIC_COUNTER_URL to point at a different
// deployment; the fallback is the live production worker.
const counterUrl = process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev";
// base31 went live at 5:00 PM on September 20, 2026 (local time).
const LAUNCHED_AT = new Date(2026, 8, 20, 17, 0, 0).getTime();
// A community upload counts as "new" for this long after it is published.
const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const visibleSites = (sites as Site[]).filter((site) => site.show !== false);
const searchIndex = (site: Site) =>
  `${site.name} ${site.subdomain} ${(site.tags || []).join(" ")} ${site.description || ""}`.toLowerCase();

const MAX_UPLOAD_FILES = 40;
const MAX_UPLOAD_FILE_BYTES = 2 * 1024 * 1024;

const slugifyClient = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");

// A folder upload arrives as "my-site/index.html"; remembering the relative
// path keeps the site's structure, so only the bare filename needs stripping.
const uploadedFilePath = (file: File) =>
  ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/^\/+/, "");

const readFileBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma === -1 ? "" : result.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
    reader.readAsDataURL(file);
  });

// Picking a folder yields "my-site/index.html" for every file, so drop the
// shared top folder and land index.html at the site root.
const stripCommonFolder = (entries: { path: string; data: string }[]) => {
  if (entries.length < 2 && !entries[0]?.path.includes("/")) return entries;
  const first = entries[0]?.path.split("/")[0];
  if (!first || !entries.every((entry) => entry.path.startsWith(`${first}/`))) return entries;
  return entries.map((entry) => ({ ...entry, path: entry.path.slice(first.length + 1) }));
};

const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

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

// Site icons come from DuckDuckGo's icon service (no key, no cookies). A
// missing icon falls back to the site's initial, so a card never renders a
// broken image.
const faviconFor = (url: string) => {
  try {
    return `https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`;
  } catch {
    return "";
  }
};

function SiteThumb({ site }: { site: Site }) {
  const [failed, setFailed] = useState(false);
  const src = faviconFor(site.url);

  return (
    <span className="site-thumb" aria-hidden="true">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="site-thumb-letter mono">{site.name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

// Words the headline cycles through on load. The first one is server-rendered,
// so the sentence still reads (and indexes) without JavaScript.
const ROTATING_WORDS = ["curious", "cool", "amazing", "interested", "creative", "restless", "adventurous"];

function WordRotator({ words = ROTATING_WORDS }: { words?: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % words.length), 2600);
    return () => window.clearInterval(id);
  }, [words.length]);

  const word = words[index] ?? words[0];

  return (
    <span className="rotator">
      {/* keyed so the word replays its slide-in on every switch */}
      <span key={word} className="rotator-word">{word}</span>
    </span>
  );
}

// A live odometer-style clock counting up from base31's launch
// (`LAUNCHED_AT`). Rendered client-only — the elapsed value starts null so
// the server and first client render match.
function LaunchClock() {
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Date.now() - LAUNCHED_AT));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const totalSeconds = Math.floor((elapsed ?? 0) / 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  const units = [
    { label: "days", value: pad(Math.floor(totalSeconds / 86400)) },
    { label: "hours", value: pad(Math.floor((totalSeconds % 86400) / 3600)) },
    { label: "minutes", value: pad(Math.floor((totalSeconds % 3600) / 60)) },
    { label: "seconds", value: pad(totalSeconds % 60) },
  ];

  return (
    <section className="launch-block" data-reveal aria-label="Time since base31 launched">
      <div className="launch-head mono">
        <span className="live-dot" aria-hidden="true" />
        live since launch
      </div>
      <h2>base31 has been running for</h2>
      <div className="clock-row" role="timer" aria-live="off">
        {units.map((unit) => (
          <span key={unit.label} className="clock-unit">
            <span className="clock-value mono">
              {/* keyed so the digit replays its flip as it ticks over */}
              <span key={unit.value} className="clock-digit">{elapsed == null ? "--" : unit.value}</span>
            </span>
            <span className="clock-label mono">{unit.label}</span>
          </span>
        ))}
      </div>
      <p className="clock-note">Live since 5:00 PM on September 20, 2026 — counting one second at a time.</p>
    </section>
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
  const [voteTotals, setVoteTotals] = useState<Record<string, VoteTotals>>({});
  const [theme, setTheme] = useState<Theme>("dark");
  const [views, setViews] = useState<number | null>(null);
  const [bump, setBump] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [exitNudge, setExitNudge] = useState<Site | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // The banner lives in the layout; this page only needs to know the choice so
  // the floating pieces can make room for it.
  const consentNeeded = useConsent() === null;
  const [booting, setBooting] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [userSites, setUserSites] = useState<PublishedSite[]>([]);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [form, setForm] = useState({ title: "", description: "", tags: "", slug: "" });
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  // When this tab was opened, so the exit nudge can wait until the visitor has
  // actually had a chance to read something.
  const openedAt = useRef(Date.now());

  // Load saved preferences after mount so SSR markup stays stable.
  useEffect(() => {
    try {
      const storedFavorites = JSON.parse(localStorage.getItem("base31-favorites") || "[]");
      if (Array.isArray(storedFavorites)) setFavorites(storedFavorites.filter((key): key is string => typeof key === "string"));
      const storedVotes = JSON.parse(localStorage.getItem("base31-votes") || "{}");
      if (storedVotes && typeof storedVotes === "object") setVotes(storedVotes as Record<string, Vote>);
      const storedTheme = localStorage.getItem("base31-theme");
      setTheme(storedTheme === "light" ? "light" : "dark");
    } catch {}
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

  // The cookie banner sits at the very bottom, so the floating action button
  // needs to lift out of its way while it is visible.
  useEffect(() => {
    document.documentElement.classList.toggle("has-consent", consentNeeded);
  }, [consentNeeded]);

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

  // Community-published sites, hosted by the worker. If there are none yet —
  // or the worker is unreachable — the built-in directory still renders.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3500);
    fetch(`${counterUrl}/sites`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("bad response"))))
      .then((data) => {
        if (Array.isArray(data?.sites)) setUserSites(data.sites as PublishedSite[]);
      })
      .catch(() => {})
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  // Shared vote totals from the worker, so thumbs show real community counts.
  // Uploaded sites share the same vote keys, so they rank alongside the rest.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3000);
    const keys = [...visibleSites.map((site) => site.subdomain), ...userSites.map((site) => site.slug)]
      .slice(0, 100)
      .join(",");
    fetch(`${counterUrl}/votes?keys=${encodeURIComponent(keys)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("bad response"))))
      .then((data) => {
        if (data?.votes && typeof data.votes === "object") setVoteTotals(data.votes as Record<string, VoteTotals>);
      })
      .catch(() => {})
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [userSites]);

  // A quick burst of confetti. Shared by milestone popups and hearting a site.
  const launchConfetti = useCallback((count = 28, hearts = false) => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("i");
      piece.className = hearts ? "confetti-piece heart" : "confetti-piece";
      if (hearts) piece.textContent = "♥";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * 0.35}s`;
      piece.style.setProperty("--hue", String(Math.floor(Math.random() * 360)));
      document.body.appendChild(piece);
      window.setTimeout(() => piece.remove(), 2100);
    }
  }, []);

  // Light haptic feedback on meaningful actions, via the Vibration API. Does
  // nothing on browsers/devices that lack it, and respects reduced motion.
  const buzz = useCallback((pattern: number | number[]) => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      navigator.vibrate(pattern);
    } catch {}
  }, []);

  // Confetti when a milestone fires.
  useEffect(() => {
    if (milestone == null) return;
    launchConfetti(28);
    buzz([18, 60, 18, 60, 30]);
  }, [buzz, milestone, launchConfetti]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "Escape") {
        setShareOpen(false);
        setSubmitOpen(false);
        setMilestone(null);
        setExitNudge(null);
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
      } else if (event.key.toLowerCase() === "s" && !shareOpen && !submitOpen && milestone == null) {
        event.preventDefault();
        setShareOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [milestone, shareOpen, submitOpen]);

  // Hide the floating support affordance once the visitor reaches the bottom
  // of the page, where the real donation board and support button live.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      document.documentElement.classList.toggle("at-bottom", total - scrolled < 160);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      document.documentElement.classList.remove("at-bottom");
    };
  }, []);

  // A playful "wait, don't go" nudge when the pointer leaves through the top of
  // the window — usually a sign that someone is reaching for the tab strip. It
  // only fires for real pointers, only after a moment of reading, only once per
  // session, and never on top of another dialog.
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (shareOpen || submitOpen || milestone != null || exitNudge != null || consentNeeded) return;
    try {
      if (window.sessionStorage.getItem("base31-exit-nudge")) return;
    } catch {}
    const onMouseOut = (event: MouseEvent) => {
      // A null relatedTarget means the pointer left the document entirely.
      if (event.relatedTarget || event.clientY > 12) return;
      if (Date.now() - openedAt.current < 8000) return;
      const withCopy = visibleSites.filter((site) => site.description);
      const pick = withCopy[Math.floor(Math.random() * withCopy.length)];
      if (!pick) return;
      try {
        window.sessionStorage.setItem("base31-exit-nudge", "seen");
      } catch {}
      buzz([12, 40, 20]);
      setExitNudge(pick);
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [buzz, consentNeeded, exitNudge, milestone, shareOpen, submitOpen]);

  // Lock background scroll while a modal is open.
  useEffect(() => {
    const open = shareOpen || submitOpen || milestone != null || exitNudge != null;
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [shareOpen, submitOpen, milestone, exitNudge]);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const toggleFavorite = useCallback((key: string) => {
    const pinned = favorites.includes(key);
    // Celebrate pinning, not unpinning.
    if (!pinned) launchConfetti(16, true);
    buzz(pinned ? 8 : 18);
    setFavorites((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }, [buzz, favorites, launchConfetti]);

  // Push the choice change to the worker. Totals come back authoritative; if
  // the worker is unreachable the vote still works locally.
  const sendVote = useCallback(async (key: string, from: VoteValue, to: VoteValue) => {
    try {
      const response = await fetch(`${counterUrl}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, from, to }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!Number.isFinite(data?.up) || !Number.isFinite(data?.down)) return;
      setVoteTotals((current) => ({ ...current, [key]: { up: Number(data.up), down: Number(data.down) } }));
    } catch {}
  }, []);

  const castVote = useCallback((key: string, direction: Vote) => {
    const previous: VoteValue = votes[key] ?? 0;
    const next: VoteValue = previous === direction ? 0 : direction;
    buzz(next === 0 ? 6 : 12);
    setVotes((current) => {
      const updated = { ...current };
      if (next === 0) delete updated[key];
      else updated[key] = next === 1 ? 1 : -1;
      return updated;
    });
    if (previous === next) return;
    // Optimistic count so the number moves on click, corrected by the worker.
    setVoteTotals((current) => {
      const base = current[key] ?? { up: 0, down: 0 };
      const updated: VoteTotals = { up: base.up, down: base.down };
      if (previous === 1) updated.up = Math.max(0, updated.up - 1);
      if (previous === -1) updated.down = Math.max(0, updated.down - 1);
      if (next === 1) updated.up += 1;
      if (next === -1) updated.down += 1;
      return { ...current, [key]: updated };
    });
    void sendVote(key, previous, next);
  }, [buzz, sendVote, votes]);

  // The built-in directory plus everything visitors have published.
  const allSites = useMemo<Site[]>(() => [
    ...visibleSites,
    ...userSites.map((site) => ({
      name: site.title,
      subdomain: site.slug,
      url: site.url,
      tags: site.tags,
      description: site.description,
      show: true,
      community: true,
      createdAt: site.createdAt,
    })),
  ], [userSites]);

  // Ranking: hearted (pinned) sites stay on top, then everything sorts by how
  // liked it is — net thumbs (up minus down), then raw upvotes, then name.
  const netLikes = useCallback(
    (key: string) => {
      const totals = voteTotals[key];
      if (!totals) return null;
      return totals.up - totals.down;
    },
    [voteTotals],
  );

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = allSites.filter((site) => !needle || searchIndex(site).includes(needle));
    const rankValue = (key: string) => netLikes(key);
    return [...matched].sort((a, b) => {
      const pinnedA = favorites.includes(a.subdomain) ? 1 : 0;
      const pinnedB = favorites.includes(b.subdomain) ? 1 : 0;
      if (pinnedA !== pinnedB) return pinnedB - pinnedA;
      // Sites with no votes yet share a neutral score of 0 and fall back to
      // alphabetical order beneath the ranked ones.
      const scoreA = rankValue(a.subdomain) ?? 0;
      const scoreB = rankValue(b.subdomain) ?? 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      const upA = voteTotals[a.subdomain]?.up ?? 0;
      const upB = voteTotals[b.subdomain]?.up ?? 0;
      if (upA !== upB) return upB - upA;
      return a.name.localeCompare(b.name);
    });
  }, [query, favorites, allSites, netLikes, voteTotals]);

  // "Surprise me" opens a random entry from whatever is currently listed, so an
  // active search narrows the pool instead of being ignored.
  const surpriseMe = useCallback(() => {
    const pool = list.length > 0 ? list : allSites;
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    buzz(12);
    launchConfetti(10);
    notify(`Opening ${pick.name}`);
    window.open(pick.url, "_blank", "noopener,noreferrer");
  }, [allSites, buzz, launchConfetti, list, notify]);

  const newCutoff = Date.now() - NEW_WINDOW_MS;

  // Fade each section in as it scrolls into view. The `anim` flag on <html> is
  // set by the pre-paint script in the layout, so this can never leave content
  // hidden for visitors without JavaScript.
  useEffect(() => {
    if (!document.documentElement.classList.contains("anim")) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed)"));
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.06 },
    );
    for (const target of targets) {
      // Whatever is already on screen shows straight away.
      if (target.getBoundingClientRect().top < window.innerHeight * 0.92) target.classList.add("is-revealed");
      else observer.observe(target);
    }
    return () => observer.disconnect();
  }, [list.length]);

  const openSubmit = useCallback(() => {
    buzz(10);
    setForm({ title: "", description: "", tags: "", slug: "" });
    setUploadFiles([]);
    setSubmitError(null);
    setSubmitOpen(true);
  }, [buzz]);

  const addFiles = useCallback((picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setUploadFiles((current) => {
      const byPath = new Map(current.map((file) => [uploadedFilePath(file), file]));
      for (const file of Array.from(picked)) {
        const path = uploadedFilePath(file);
        // Skip editor and OS cruft like .DS_Store.
        if (path.split("/").some((part) => part.startsWith("."))) continue;
        byPath.set(path, file);
      }
      return Array.from(byPath.values());
    });
  }, []);

  const removeFile = useCallback((path: string) => {
    setUploadFiles((current) => current.filter((file) => uploadedFilePath(file) !== path));
  }, []);

  // Read every file, then hand the whole site to the worker, which stores it
  // in KV and starts serving it at a public URL.
  const publishSite = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    if (!form.title.trim()) {
      setSubmitError("Give your site a title.");
      return;
    }
    if (uploadFiles.length === 0) {
      setSubmitError("Add your site's files — an index.html at least.");
      return;
    }
    if (uploadFiles.length > MAX_UPLOAD_FILES) {
      setSubmitError(`Too many files — the limit is ${MAX_UPLOAD_FILES}.`);
      return;
    }
    const oversized = uploadFiles.find((file) => file.size > MAX_UPLOAD_FILE_BYTES);
    if (oversized) {
      setSubmitError(`${uploadedFilePath(oversized)} is larger than 2 MB.`);
      return;
    }

    setSubmitting(true);
    try {
      const read = await Promise.all(
        uploadFiles.map(async (file) => ({ path: uploadedFilePath(file), data: await readFileBase64(file) })),
      );
      const response = await fetch(`${counterUrl}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          slug: form.slug.trim(),
          files: stripCommonFolder(read),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Couldn't publish that site.");
      // KV list is eventually consistent, so show it right away for its author.
      if (data?.site) setUserSites((current) => [data.site as PublishedSite, ...current]);
      buzz([14, 50, 14, 50, 24]);
      setSubmitOpen(false);
      setUploadFiles([]);
      notify("Your site is live");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Couldn't publish that site.");
    } finally {
      setSubmitting(false);
    }
  }, [buzz, form, notify, submitting, uploadFiles]);

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
      buzz([10, 40, 10]);
      notify("Link copied");
    } catch {
      notify("Couldn't copy");
    }
  }, [buzz, notify]);

  const nativeShare = useCallback(async () => {
    const data = { title: "base31.org", text: "Cool sites for curious people.", url: siteUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else await copyLink();
    } catch {}
  }, [copyLink]);

  const slugPreview = slugifyClient(form.slug.trim() || form.title.trim());
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
            <a href="/blog">Blog</a>
            <a href="#about">About</a>
          </nav>
          <div className="header-actions">
            <button type="button" className="icon-button share-button mono" onClick={() => { buzz(8); setShareOpen(true); }} aria-label="Share base31.org">
              <span>Share</span>
              <kbd className="shortcut-hint">S</kbd>
              <span aria-hidden="true">↗</span>
            </button>
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={() => { buzz(8); setTheme((current) => (current === "dark" ? "light" : "dark")); }}
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
          <h1 id="page-title">
            <span className="h1-line">Cool sites for</span>
            <span className="h1-line h1-rotator"><WordRotator /></span>
            <span className="h1-line">people.</span>
          </h1>
          <p className="subtitle">Discover fun websites, useful online tools, and creative web projects built on base31.org and the open web.</p>
          <div className="intro-links">
            <a className="text-link" href="#sites">Browse all sites <span aria-hidden="true">↓</span></a>
            <a className="text-link muted-link" href="#about">Why base31? <span aria-hidden="true">→</span></a>
            <button type="button" className="text-link surprise-button" onClick={surpriseMe}>
              Surprise me <span aria-hidden="true">↯</span>
            </button>
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
          <div className="section-heading" data-reveal>
            <h2 id="sites-heading">Featured sites</h2>
            {query.trim() && (
              <span className="section-count mono">
                {list.length} match{list.length === 1 ? "" : "es"}
              </span>
            )}
          </div>
          <div className="site-list" aria-label="Deployed sites">
            {list.length === 0 && <p className="empty">No sites match “{query.trim()}”. Try another search.</p>}
            {list.map((site, index) => {
              const pinned = favorites.includes(site.subdomain);
              const vote = votes[site.subdomain];
              const totals = voteTotals[site.subdomain];
              const isNew = !!site.createdAt && site.createdAt > newCutoff;
              return (
                <article
                  key={site.subdomain}
                  className={`site-card${pinned ? " is-pinned" : ""}`}
                  data-reveal
                  style={{ "--i": index } as CSSProperties}
                >
                  <div className="site-card-top">
                    <a href={site.url} className="site-link site-link-with-thumb" target="_blank" rel="noreferrer">
                      <SiteThumb site={site} />
                      <span className="site-name-row">
                        <span className="live-dot" aria-hidden="true" />
                        <span className="site-name">{site.name}</span>
                        {site.community && <span className="site-badge mono">community</span>}
                        {isNew && <span className="site-badge is-new mono">new</span>}
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
                        aria-label={`Thumbs up ${site.name}${totals ? `, ${totals.up} up` : ""}`}
                      >
                        <ThumbIcon />
                        {/* keyed so the count replays its pop animation on change */}
                        <span key={totals ? totals.up : "none"} className="vote-count mono">{totals ? totals.up : "–"}</span>
                      </button>
                      <button
                        type="button"
                        className={`vote-button down${vote === -1 ? " is-active" : ""}`}
                        onClick={() => castVote(site.subdomain, -1)}
                        aria-pressed={vote === -1}
                        aria-label={`Thumbs down ${site.name}${totals ? `, ${totals.down} down` : ""}`}
                      >
                        <ThumbIcon down />
                        <span key={totals ? totals.down : "none"} className="vote-count mono">{totals ? totals.down : "–"}</span>
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
            {!query.trim() && (
              <button type="button" className="upload-card" data-reveal onClick={openSubmit}>
                <span className="upload-card-icon mono" aria-hidden="true">＋</span>
                <span className="upload-card-body">
                  <span className="upload-card-title">Add your own site</span>
                  <span className="upload-card-text">Upload your HTML files — we host them here for free, and visitors can browse and vote on your site.</span>
                </span>
                <span className="upload-card-arrow mono" aria-hidden="true">↗</span>
              </button>
            )}
            {booting && (
              <div className="site-skeleton" aria-hidden="true">
                {visibleSites.map((site) => <div key={site.subdomain} className="skeleton-card" />)}
              </div>
            )}
          </div>
        </section>

        <section id="about" className="about-section" data-reveal aria-labelledby="about-heading">
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

        {/* Supporters, dressed up like a pinboard. It sits directly above the
            launch clock; on narrow screens only its CTA detaches into a fixed
            button so the support link stays reachable. */}
        <DonationBoard />

        {/* Live count-up from the launch of base31. */}
        <LaunchClock />

        {/* Sponsored referral links, below the clock. */}
        <ReferralCarousel />

        {/* Small sponsored button at the very bottom of the page. */}
        <a
          className="support-ad"
          data-reveal
          href="https://www.profitableratecpmnetwork.com/vsnt502b?key=014ca151909e76ba10dc8d6cfae88709"
          target="_blank"
          rel="noreferrer sponsored"
        >
          <span className="support-ad-tag mono">ad</span>
          <span className="support-ad-text">Want to support base31? Click this button to help</span>
          <span className="support-ad-arrow mono" aria-hidden="true">↗</span>
        </a>

        {/* SEO FAQ — the last block in main, directly above the footer. */}
        <Faq />
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner mono">
          <span>© {new Date().getFullYear()} base31.org · built by Sawyer Schulz</span>
          <nav className="footer-links" aria-label="Footer navigation">
            <a href="/blog">Blog</a>
            <a href="/about">About</a>
            <a href="/terms">Terms of service</a>
            <a href="/privacy">Privacy</a>
            <button
              type="button"
              className="footer-link-button"
              onClick={() => {
                buzz(8);
                resetConsent();
              }}
            >
              Cookie settings
            </button>
            <a href="#page-title">Top ↑</a>
          </nav>
        </div>
      </footer>

      <div className={`view-counter mono${bump ? " is-bumped" : ""}`} aria-live="polite" aria-label="Directory page views">
        <span>views</span>
        <strong>{views == null ? "—" : views.toLocaleString()}</strong>
      </div>

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

      {submitOpen && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setSubmitOpen(false)}>
          <div className="modal submit-sheet" role="dialog" aria-modal="true" aria-labelledby="submit-title">
            <button type="button" className="modal-close" onClick={() => setSubmitOpen(false)} aria-label="Close upload form">×</button>
            <p className="eyebrow mono">publish your site</p>
            <h2 id="submit-title">Add your site to the directory.</h2>
            <p>Upload your HTML, CSS, and JavaScript files. We host them for free and visitors can browse and vote on your site.</p>

            <form className="submit-form" onSubmit={publishSite}>
              <label className="submit-field">
                <span>Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  maxLength={80}
                  placeholder="My cool site"
                  required
                />
              </label>

              <label className="submit-field">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  maxLength={300}
                  placeholder="What does your site do?"
                />
              </label>

              <label className="submit-field">
                <span>Tags</span>
                <input
                  value={form.tags}
                  onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                  placeholder="game, tool, art"
                />
              </label>

              <label className="submit-field">
                <span>Web address</span>
                <input
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  maxLength={32}
                  placeholder="auto from the title"
                />
                <span className="field-hint mono">{counterUrl.replace(/^https?:\/\//, "")}/s/{slugPreview || "your-site"}/</span>
              </label>

              <div className="submit-files">
                <span className="submit-label">Files</span>
                <div className="file-drop">
                  <label className="file-button" htmlFor="site-files">Choose files</label>
                  <input
                    id="site-files"
                    type="file"
                    multiple
                    onChange={(event) => {
                      addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <label className="file-button" htmlFor="site-folder">Upload a folder</label>
                  <input
                    id="site-folder"
                    type="file"
                    multiple
                    onChange={(event) => {
                      addFiles(event.target.files);
                      event.target.value = "";
                    }}
                    {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  />
                </div>
                {uploadFiles.length === 0 ? (
                  <p className="form-note">
                    Include an <span className="mono">index.html</span> at the root — CSS, JS, and images can sit beside it. Up to 40 files, 2 MB each.
                  </p>
                ) : (
                  <ul className="file-list">
                    {uploadFiles.map((file) => {
                      const path = uploadedFilePath(file);
                      return (
                        <li key={path} className="file-item">
                          <span className="file-item-path mono">{path}</span>
                          <span className="file-item-right">
                            <span className="file-size mono">{formatBytes(file.size)}</span>
                            <button type="button" onClick={() => removeFile(path)} aria-label={`Remove ${path}`}>×</button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {submitError && <p className="form-error" role="alert">{submitError}</p>}

              <div className="modal-actions">
                <button type="submit" className="primary" disabled={submitting}>
                  {submitting ? "Publishing…" : "Publish site"}
                </button>
                <button type="button" onClick={() => setSubmitOpen(false)} disabled={submitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {exitNudge && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setExitNudge(null)}>
          <div className="modal exit-modal" role="dialog" aria-modal="true" aria-labelledby="exit-title">
            <button type="button" className="modal-close" onClick={() => setExitNudge(null)} aria-label="Close">×</button>
            <p className="eyebrow mono">wait, one more thing</p>
            <h2 id="exit-title">Leaving already? Don&apos;t go yet.</h2>
            <p>
              You haven&apos;t looked at <strong>{exitNudge.name}</strong> yet — {exitNudge.description}{" "}
              There are more like it one scroll away, and most of them are far too strange to find on your own.
            </p>
            <div className="modal-actions">
              <a className="primary" href={exitNudge.url} target="_blank" rel="noreferrer" onClick={() => buzz(10)}>
                Show me {exitNudge.name}
              </a>
              <button type="button" onClick={() => setExitNudge(null)}>Fine, I&apos;ll stay</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

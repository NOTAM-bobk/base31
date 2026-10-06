"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import sites from "@/config/sites.json";
import pkg from "@/package.json";
import AboutSection from "@/components/about-section";
import DiscussionBoard from "@/components/discussion-board";
import SupportSection from "@/components/support-section";
import { SITE_GLYPHS } from "@/components/site-glyphs";
import Cursor from "@/components/cursor";
import Faq from "@/components/faq";
import DirectoryNotifications from "@/components/directory-notifications";
import UrlRequest from "@/components/url-request";
import FooterSponsor from "@/components/footer-sponsor";
import CoolSites from "@/components/cool-sites";
import CoolApis from "@/components/cool-apis";
import CoolApps from "@/components/cool-apps";
import SiteHeader from "@/components/site-header";
import NavDrawer, { type DrawerLink } from "@/components/nav-drawer";
import { useDialogFocus } from "@/lib/dialog-focus";
import { LOCALES, type Dictionary, type Locale, EN } from "@/lib/i18n";
import { resetConsent, useConsent } from "@/lib/consent";
import coolSites, { searchCoolSites } from "@/lib/cool-sites";
import coolApis, { searchCoolApis } from "@/lib/cool-apis";
import coolApps, { searchCoolApps } from "@/lib/cool-apps";
import { tick } from "@/lib/haptics";
import SectionRail, { type RailSection } from "@/components/section-rail";
import HeroStats from "@/components/hero-stats";
import CoolAis from "@/components/cool-ais";
import Freshness from "@/components/freshness";
import { allCoolAis, searchCoolAis, detailPath, directoryEntries, tagTone } from "@/lib/directory";
// Aliased because the component below builds its own `allTags` for the filter
// chips — that one counts the featured sites alone and carries no slug.
import { allTags as directoryTags, tagCount } from "@/lib/tags";
import { recentlyAdded } from "@/lib/recently-added";
import { matchesQuery } from "@/lib/search";
import EditorsPicks from "@/components/editors-picks";
import TopTen from "@/components/top-ten";
import BestMatches from "@/components/best-matches";
import { sectionCount, sectionsWithMatches } from "@/lib/sections";
import { compareVotes } from "@/lib/vote-ranking";

type Site = { name: string; subdomain: string; url: string; tags?: string[]; description?: string; show?: boolean; community?: boolean; createdAt?: number; icon?: string; lastChecked?: string; addedAt?: string };

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

// How the directory can be ordered. Pinned sites stay on top in every mode.
type SortMode = "liked" | "newest" | "az";
// Labels resolve through the active dictionary at render time (see dict.sortLabel).
const SORT_OPTIONS: { value: SortMode }[] = [{ value: "liked" }, { value: "newest" }, { value: "az" }];
const MAX_TAG_CHIPS = 11;
// How many cards a section shows before it offers the rest. Nine fills the
// widest grid the page has — three columns — exactly, so a cut list lands as
// whole rows instead of leaving one card stranded on a line of its own.
const SECTION_PREVIEW = 9;

// The hero headline is laid out one span per word so it can rise into place on
// load (the animation lives in app/late.css). One word in it also carries the
// accent: the negation. English gets "Not" in "Totally Not Boring Websites",
// Spanish and Portuguese "nada", French "pas" — the same slot in every locale,
// so no translation renders a headline nobody has styled. A helper plus a
// matcher keeps the JSX a plain list instead of a per-locale special case.
const HERO_ACCENT_WORD = /^(not|no|nada|pas)$/i;
const heroWordsOf = (title: string) => title.split(/\s+/).filter(Boolean);

const visibleSites = (sites as Site[]).filter((site) => site.show !== false);

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

// Every kept site has a hand-made favicon at /site-icons/<subdomain>.svg, so
// the directory shows a real icon rather than a placeholder. The fallback
// glyphs (drawn when a favicon is missing or fails to load) live in
// components/site-glyphs.tsx.

const hashKey = (value: string) => {
  let hash = 7;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000003;
  }
  return hash;
};

// The favicon shown on a site's card. Kept sites ship one with the directory
// (a same-origin file, so nothing is requested from anyone else); a community
// upload asks its own origin for `/favicon.ico`. Both fall back to the
// generated tile if the image is missing or blocked.
const siteFavicon = (site: Site) => {
  if (site.icon) return site.icon;
  if (site.community) {
    try {
      return `${new URL(site.url).origin}/favicon.ico`;
    } catch {
      return null;
    }
  }
  return `/site-icons/${site.subdomain}.svg`;
};

function SiteIcon({ site }: { site: Site }) {
  const hash = hashKey(site.subdomain || site.name);
  const hue = hash % 360;
  // A second, independent slice of the hash picks the glyph so colour and
  // shape don't repeat together.
  const glyph = SITE_GLYPHS[(hash >> 3) % SITE_GLYPHS.length];
  const src = siteFavicon(site);
  const [failed, setFailed] = useState(false);

  return (
    <span
      className="site-icon"
      aria-hidden="true"
      style={{ backgroundImage: `linear-gradient(145deg, hsl(${hue} 70% 50%), hsl(${(hue + 38) % 360} 64% 33%))` }}
    >
      {src && !failed ? (
        <img
          className="site-icon-img"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {glyph}
        </svg>
      )}
    </span>
  );
}

// A live screenshot of the destination, used as the band at the top of every
// card: WordPress mShots first (the same keyless service the referral carousel
// uses) and thum.io — which the App Screenshot page already depends on — as a
// second chance if the first refuses the request. The same trade as the
// referral carousel: this is a destination preview, not tracking, so it is not
// gated behind the cookie banner, since a card is hard to judge without its
// picture. It sets no cookies and the privacy page says so.
const previewSources = (site: Site): string[] => {
  try {
    const url = new URL(site.url).toString();
    // 640x300 — a shorter band than the old 16:9, and the exact ratio the
    // `.site-preview` box uses, so the screenshot lands in it whole rather
    // than being cropped or letterboxed.
    return [
      `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=640&h=300`,
      `https://image.thum.io/get/width/640/crop/300/${url}`,
    ];
  } catch {
    return [];
  }
};

// The preview band: the destination's screenshot, faded into the card body by
// a gradient so it never ends on a hard edge beside the text. The tile keeps
// the site's own hashed gradient underneath, so a slow or blocked screenshot
// still shows a deliberate tile in the card's colour rather than a grey box —
// and the band itself is decorative, since the name, host and description sit
// right beside it.
function SitePreview({ site }: { site: Site }) {
  const hash = hashKey(site.subdomain || site.name);
  const hue = hash % 360;
  const sources = previewSources(site);
  // Walks the source list on each failure; once it runs out, the band keeps
  // the site's own gradient rather than breaking.
  const [index, setIndex] = useState(0);
  const src = sources[index];

  if (sources.length === 0) return null;

  return (
    <span
      className="site-preview"
      aria-hidden="true"
      style={{ backgroundImage: `linear-gradient(140deg, hsl(${hue} 62% 40%), hsl(${(hue + 38) % 360} 58% 24%))` }}
    >
      {src && (
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
          referrerPolicy="no-referrer"
          onError={() => setIndex((current) => current + 1)}
        />
      )}
      <span className="site-preview-fade" />
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
      {/* The tiles tick every second, so they are hidden from assistive tech —
          otherwise a screen reader would try to read a number that changes
          under it. The static description below is what actually gets read. */}
      <div className="clock-row" role="timer" aria-hidden="true">
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
      <p className="sr-only">A live counter of how long base31 has been online.</p>
      <p className="clock-note">Live since 5:00 PM on September 20, 2026 — counting one second at a time.</p>
    </section>
  );
}

// One component, two pages. The homepage (`mode="home"`) is the landing page:
// the hero, then About, the community board, support, the launch clock, the FAQ
// and the signup. `/explore` (`mode="explore"`) is the directory: the search
// field and every list of sites.
//
// The split is a prop rather than two components because the directory's state
// — the query, the tag filter, the sort, pins, votes, the upload form, the
// reveal observer and the polling effects — is one machine, and the mobile
// drawer's search is a link into this same page. Keeping both modes here means
// there is exactly one implementation of the directory, reachable two ways.
export default function HomePage({ dict = EN, locale = "en", mode = "home" }: { dict?: Dictionary; locale?: Locale; mode?: "home" | "explore" }) {
  const isExplore = mode === "explore";
  // The mobile navigation drawer (components/nav-drawer.tsx), opened from the
  // header button that CSS shows on narrow screens only.
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [voteTotals, setVoteTotals] = useState<Record<string, VoteTotals>>({});
  // One rising "+1"/"-1" per click, counted per site so a repeat click on the
  // same thumb replays the animation instead of sitting still.
  const [votePops, setVotePops] = useState<Record<string, { up: number; down: number }>>({});
  const [theme, setTheme] = useState<Theme>("dark");
  const [views, setViews] = useState<number | null>(null);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [exitNudge, setExitNudge] = useState<Site | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("liked");
  // Lets a visitor fold the directory away without losing their filters.
  const [sitesCollapsed, setSitesCollapsed] = useState(false);
  // The directory shows its first nine cards until this is set, which is what
  // the last line of the list is for.
  const [showAllSites, setShowAllSites] = useState(false);
  // True for the moment after the fold, so the whole section can wobble like
  // the Support section does when its panel opens or closes.
  const [sitesVibrating, setSitesVibrating] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // The banner lives in the layout; this page only needs to know the choice so
  // the floating pieces can make room for it.
  const consentNeeded = useConsent() === null;
  // Two-letter code for the language switcher ("en" on the default page).
  const localeCode: Locale = locale;
  const [booting, setBooting] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [userSites, setUserSites] = useState<PublishedSite[]>([]);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [form, setForm] = useState({ title: "", description: "", tags: "", slug: "", email: "" });
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  // Holds the timer that removes the one-off theme-transition class.
  const themeFadeTimer = useRef<number | null>(null);
  // When this tab was opened, so the exit nudge can wait until the visitor has
  // actually had a chance to read something.
  const openedAt = useRef(Date.now());
  const shareRef = useRef<HTMLDivElement>(null);
  const milestoneRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLDivElement>(null);

  useDialogFocus(shareOpen, shareRef);
  useDialogFocus(milestone != null, milestoneRef);
  useDialogFocus(submitOpen, submitRef);
  useDialogFocus(exitNudge != null, exitRef);

  // The directory's own shake, mirroring the Support section's: it starts on
  // the toggle after mount (so the initial open is not a "change"), runs for
  // the length of the CSS animation, then clears so the next toggle replays
  // it. The haptic tick rides along on devices that support it.
  const sitesMounted = useRef(false);
  useEffect(() => {
    if (!sitesMounted.current) {
      sitesMounted.current = true;
      return;
    }
    setSitesVibrating(true);
    tick(6);
    const timer = window.setTimeout(() => setSitesVibrating(false), 460);
    return () => window.clearTimeout(timer);
  }, [sitesCollapsed]);

  // A deep link can carry the search: /explore?q=pomodoro opens the directory
  // filtered to that query, so a shared link — and the mobile drawer's search
  // form, which is a plain GET to this page — lands where the sender meant.
  // Runs once on mount, and only where there is a list to filter.
  useEffect(() => {
    if (!isExplore) return;
    const fromUrl = new URLSearchParams(window.location.search).get("q");
    if (fromUrl) {
      setQuery(fromUrl);
      setSitesCollapsed(false);
    }
  }, [isExplore]);

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
      const saved = JSON.parse(localStorage.getItem("base31-votes") || "{}");
      const external = Object.fromEntries(Object.entries(saved).filter(([key]) => key.startsWith("external:")));
      const featured = Object.fromEntries(Object.entries(votes).filter(([key]) => !key.startsWith("external:")));
      localStorage.setItem("base31-votes", JSON.stringify({ ...external, ...featured }));
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

  // Dark and light repaint every surface on the page, and CSS variables swap
  // instantly, so the change used to snap. `theme-fade` on <html> adds one
  // short colour transition for the length of the switch (see
  // app/overrides.css); it is added, the layout flushed, and only then is the
  // theme flipped, so the transition actually sees both values. The class is
  // removed again afterwards so hover and scroll keep their own timings, and
  // nothing is added at all when the visitor prefers reduced motion.
  const switchTheme = () => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      root.classList.add("theme-fade");
      void root.offsetWidth;
      if (themeFadeTimer.current) window.clearTimeout(themeFadeTimer.current);
      themeFadeTimer.current = window.setTimeout(() => root.classList.remove("theme-fade"), 480);
    }
    buzz(8);
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // The fade class lives on <html>, which survives client-side navigation, so
  // it must not outlive this page.
  useEffect(() => () => {
    if (themeFadeTimer.current) window.clearTimeout(themeFadeTimer.current);
    document.documentElement.classList.remove("theme-fade");
  }, []);

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
      piece.setAttribute("aria-hidden", "true");
      document.body.appendChild(piece);
      window.setTimeout(() => piece.remove(), 2100);
    }
  }, []);

  // Light haptic feedback on meaningful actions. The guard, the reduced-motion
  // rule and the try/catch all live in lib/haptics.ts, which the rail and the
  // header nav share.
  const buzz = useCallback((pattern: number | number[]) => tick(pattern), []);

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
        // Only the directory has a search field to focus; on the homepage the
        // key would otherwise swallow a slash for no reason.
        if (!isExplore) return;
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key.toLowerCase() === "s" && !shareOpen && !submitOpen && milestone == null) {
        event.preventDefault();
        setShareOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExplore, milestone, shareOpen, submitOpen]);

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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    // Send the count up out of the thumb it came from, once per click.
    setVotePops((current) => {
      const entry = current[key] ?? { up: 0, down: 0 };
      return { ...current, [key]: direction === 1 ? { ...entry, up: entry.up + 1 } : { ...entry, down: entry.down + 1 } };
    });
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

  // Every tag in the directory, most used first, for the filter chips.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const site of allSites) {
      for (const tag of site.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_TAG_CHIPS)
      .map(([tag, count]) => ({ tag, count }));
  }, [allSites]);

  const searchTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of [...directoryEntries, ...userSites]) {
      for (const tag of entry.tags ?? []) if (!/\s/.test(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([tag]) => tag);
  }, [userSites]);

  const list = useMemo(() => {
    const matched = allSites.filter((site) => {
      if (activeTag && !(site.tags ?? []).includes(activeTag)) return false;
      return matchesQuery(site, query);
    });
    return [...matched].sort((a, b) => {
      const pinnedA = favorites.includes(a.subdomain) ? 1 : 0;
      const pinnedB = favorites.includes(b.subdomain) ? 1 : 0;
      if (sortMode !== "liked" && pinnedA !== pinnedB) return pinnedB - pinnedA;
      if (sortMode === "az") return a.name.localeCompare(b.name);
      if (sortMode === "newest") {
        const byDate = (b.createdAt ?? (b.addedAt ? Date.parse(b.addedAt) : 0)) - (a.createdAt ?? (a.addedAt ? Date.parse(a.addedAt) : 0));
        return byDate !== 0 ? byDate : a.name.localeCompare(b.name);
      }
      // Vote ranking is strict: pins do not move a lower-voted site ahead.
      return compareVotes(voteTotals[a.subdomain], voteTotals[b.subdomain]) || a.name.localeCompare(b.name);
    });
  }, [query, activeTag, sortMode, favorites, allSites, voteTotals]);

  // A new question starts a short list again: search text, a tag chip or a new
  // sort folds the directory back to its first nine cards, so "Show all" is
  // never left open from an earlier look at the page.
  useEffect(() => {
    setShowAllSites(false);
  }, [query, activeTag, sortMode]);

  // The directory's first screenful: nine cards, then the line under them that
  // opens the rest. `foldCount` is how many cards the cut is holding back — the
  // same number either way, read as "+13" while they are hidden and "-13" once
  // they are showing.
  const shownSites = showAllSites || query.trim() ? list : list.slice(0, SECTION_PREVIEW);
  useEffect(() => { if (query.trim()) { setSitesCollapsed(false); setActiveTag(null); } }, [query]);
  const foldCount = Math.max(0, list.length - SECTION_PREVIEW);

  // What the reveal effect below watches. The cards it has to fade in are not
  // only a function of `list.length`: "Show all", a new sort, or the vote
  // totals arriving and reordering the first screenful all swap which cards
  // are mounted while the length stays the same. A dependency on the length
  // alone missed those, so a freshly mounted card kept the CSS `opacity: 0` it
  // shipped with and left a blank gap in the grid until the next full reload.
  const revealKey = shownSites.map((site) => site.subdomain).join("|");

  // Search applies to every collection; a featured tag chip scopes the draw.
  const surpriseMe = useCallback(() => {
    const external = directoryEntries.filter((entry) => entry.sectionId !== "sites" && matchesQuery(entry, query));
    const pool = activeTag ? list : [...list, ...external];
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    buzz(12);
    launchConfetti(10);
    notify(`Opening ${pick.name}`);
    window.open(pick.url, "_blank", "noopener,noreferrer");
  }, [activeTag, query, buzz, launchConfetti, list, notify]);

  const newCutoff = Date.now() - NEW_WINDOW_MS;

  // The section rail walks the page in render order, so it lists the sections
  // the page actually renders. The two labels the dictionary holds are used
  // from it, so a translated page reads its own words there; the rest are the
  // English names those sections already print on every locale.
  const railSections = useMemo<RailSection[]>(() => (isExplore ? [
    { id: "page-title", label: "Top" },
    { id: "sites", label: dict.featured },
    { id: "cool-sites", label: dict.coolSites },
    { id: "cool-apis", label: dict.coolApis },
    { id: "cool-apps", label: dict.coolApps },
    { id: "cool-ais", label: dict.coolAis },
    { id: "no-code-ai-tools", label: dict.noCodeAiTools },
    { id: "request-url", label: "Submit" },
  ] : [
    { id: "page-title", label: "Top" },
    { id: "editors-picks", label: "Editor's picks" },
    { id: "top-ten", label: "Top 10" },
    { id: "request-url", label: "Submit" },
    { id: "browse-tags", label: "Tags" },
    // The support hub sits directly under About now, so the rail walks them in
    // that order too — the rail is a readout of the page, not a menu of its own.
    { id: "about", label: "About" },
    { id: "support", label: "Support" },
    { id: "discussion", label: "Community" },
    { id: "faq-heading", label: "FAQ" },
    { id: "updates", label: "Updates" },
  ]), [dict, isExplore]);

  // The mobile drawer's two lists. "Explore" is the directory's own sections:
  // every row is a plain link to /explore with that section's id as the hash,
  // so the browser loads the page and scrolls to the list the visitor asked
  // for without any routing code. "More" is the rest of the site.
  const drawerCategories = useMemo<DrawerLink[]>(() => [
    { href: "/explore", label: "Everything", meta: `${allSites.length} sites` },
    { href: "/explore#sites", label: dict.featured, meta: `${allSites.length}` },
    { href: "/explore#cool-sites", label: dict.coolSites, meta: `${coolSites.length}` },
    { href: "/explore#cool-apis", label: dict.coolApis, meta: `${coolApis.length}` },
    { href: "/explore#cool-apps", label: dict.coolApps, meta: `${coolApps.length}` },
    { href: "/explore#cool-ais", label: dict.coolAis, meta: `${allCoolAis.length}` },
    { href: "/explore#no-code-ai-tools", label: dict.noCodeAiTools, meta: `${sectionCount("no-code-ai-tools")}` },
    { href: "/explore#request-url", label: "Submit a URL" },
  ], [allSites.length, dict]);

  const drawerMore = useMemo<DrawerLink[]>(() => [
    { href: "/blog", label: "Blog" },
    { href: "/tools", label: "Tool guides" },
    { href: "/recently-added", label: "Recently added", meta: `${recentlyAdded.length}` },
    { href: "/tags", label: "Tags", meta: `${tagCount}` },
    { href: "/quality-report", label: "Quality report" },
    { href: "/websites-of-the-week", label: "Website of the week" },
    { href: "/stats", label: "Stats" },
    { href: "/about", label: "About us" },
  ], []);

  // How many off-directory picks the same search found — the cool sites, the
  // cool APIs and the cool apps down the page — so the directory's empty state
  // can point at the strips instead of dead-ending.
  const coolMatchCount = useMemo(
    () =>
      query.trim()
        ? searchCoolSites(query).length + searchCoolApis(query).length + searchCoolApps(query).length + searchCoolAis(query).length
        : 0,
    [query],
  );

  // What a search leaves on the page. A section with nothing matching is not
  // rendered at all — heading, divider and closed note included — so the answer
  // to a question is a short page of the sections that did match instead of six
  // headings and five "nothing here" lines. The rule itself is
  // `sectionsWithMatches` in lib/sections.ts; the two AI strips are one block in
  // the markup, so either of them standing keeps that block up.
  const visibleSections = useMemo(() => new Set(sectionsWithMatches(query)), [query]);
  const showSites = visibleSections.has("sites");
  const showCoolSites = visibleSections.has("cool-sites");
  const showCoolApis = visibleSections.has("cool-apis");
  const showCoolApps = visibleSections.has("cool-apps");
  const showCoolAis = visibleSections.has("cool-ais") || visibleSections.has("no-code-ai-tools");

  // Fade each section in as it scrolls into view. The motion flag on <html> is
  // set by the pre-paint script in the layout, so this can never leave content
  // hidden for visitors without JavaScript.
  //
  // The marker is a `data-revealed` attribute rather than a class on purpose:
  // React rewrites `class` whenever a card's className prop changes (pinning a
  // site adds `is-pinned`), which would wipe a class the observer had added and
  // leave that card stuck at opacity 0 — a blank gap in the list that nothing
  // ever moves up to fill. React does not manage this attribute, so it sticks.
  useEffect(() => {
    if (document.documentElement.getAttribute("data-motion") !== "enabled") return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])"));
    if (targets.length === 0) return;
    const reveal = (element: Element) => element.setAttribute("data-revealed", "");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0 },
    );
    for (const target of targets) {
      // Whatever is already on screen shows straight away.
      if (target.getBoundingClientRect().top < window.innerHeight * 0.92) reveal(target);
      else observer.observe(target);
    }
    return () => observer.disconnect();
  }, [revealKey]);

  const openSubmit = useCallback(() => {
    buzz(10);
    setForm({ title: "", description: "", tags: "", slug: "", email: "" });
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
          email: form.email.trim(),
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
  const shareAddress = siteUrl.replace(/^https?:\/\//, "");

  // The WebSite/Organization graph ships site-wide from app/layout.tsx, so the
  // homepage only adds the part that is genuinely about this page: the list of
  // directory entries. Emitting the WebSite node twice duplicates the graph.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${siteUrl}${isExplore ? "/explore" : "/"}#directory`,
    name: "base31.org website directory",
    description: "A list of live sites and web projects on base31.org.",
    numberOfItems: visibleSites.length,
    itemListElement: visibleSites.map((site, index) => ({ "@type": "ListItem", position: index + 1, name: site.name, url: site.url })),
  };

  // The headline, laid out one span per word so it can rise into place on
  // load (the animation lives in app/late.css). One word also carries the
  // accent — the negation in "Totally Not Boring Websites" — matched by
  // `HERO_ACCENT_WORD`, so no translation renders a headline nobody styled.
  // The explore page uses the same treatment for its own title.
  const heroHeading = (title: string) => (
    <span className="h1-line h1-title">
      {heroWordsOf(title).map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          {index > 0 ? " " : null}
          <span
            className={`h1-word${HERO_ACCENT_WORD.test(word) ? " is-not" : ""}`}
            style={{ animationDelay: `${90 + index * 85}ms` }}
          >
            {word}
          </span>
        </Fragment>
      ))}
    </span>
  );

  return (
    <>
      <Cursor />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <a className="skip-link" href={isExplore ? "#sites" : "#page-title"}>
        {isExplore ? "Skip to the directory" : "Skip to the content"}
      </a>

      <SiteHeader
        theme={theme}
        onToggleTheme={switchTheme}
        onOpenNav={() => { tick(10); setNavOpen(true); }}
        navOpen={navOpen}
      />

      {/* The phone's menu: the search field and the category list, drawn over
          the page instead of under it. */}
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} categories={drawerCategories} more={drawerMore} />

      {/* The lines down the right edge: where you are, and the fast way
          between sections. */}
      <SectionRail sections={railSections} />

      <main className="home-main">
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow mono">{isExplore ? "the directory" : "the real web directory"}</p>
          {/* One line, three words: the title is a single phrase now, so it
              needs no per-line spaces to read correctly when flattened to
              text (search snippets, screen readers). It is rendered word by
              word — one span each, with a real space between them so a phone
              can still wrap the line — which is what lets the headline rise
              into place on load. The negation in the middle wears the accent
              (see `.h1-word.is-not` in app/late.css). */}
          <h1 id="page-title">{heroHeading(isExplore ? "Explore the directory" : dict.heroTitle)}</h1>
          <p className="subtitle">
            {isExplore
              ? "Every site, tool, API and app base31 has picked, in one list. Search it, filter it by tag, or start at the top and keep scrolling."
              : dict.subtitle}
          </p>
          {!isExplore && (
            <>
              {/* Views, unique directory destinations, and estimated source lines. */}
              <HeroStats visitors={views} sites={new Set([...directoryEntries, ...allSites].map((site) => site.url.replace(/\/$/, ""))).size} />
              {/* The landing page's one job is to get people into the list, so
                  the directory gets a full-width control of its own, shaped
                  like the search field it replaces. It is a link, not an
                  input, because the searching happens on /explore — where the
                  field is, and where the query ends up in the URL. */}
              <a className="explore-cta" href="/explore" onClick={() => tick(12)}>
                <span className="explore-cta-icon mono" aria-hidden="true">⌕</span>
                <span className="explore-cta-body">
                  <span className="explore-cta-title">Explore the directory</span>
                  <span className="explore-cta-meta mono">{allSites.length} sites · {directoryEntries.length} picks · search everything</span>
                </span>
                <span className="explore-cta-arrow mono" aria-hidden="true">→</span>
              </a>
            </>
          )}
          {/* One call to action, directly under the numbers. The "Why base31?"
              anchor and the old "Browse all sites" link are both gone: the
              list is one tap away, and the rail already steps to About, so
              each only duplicated something else. */}
          <div className="intro-links">
            <button type="button" className="surprise-button" onClick={surpriseMe} title="Open a random matching pick from any collection">
              <span className="surprise-icon" aria-hidden="true">↯</span>
              <span className="surprise-label">{dict.surprise}</span>
            </button>
            {/* The submission form is on both faces now, so the button
                anchors to the copy the visitor is already looking at. */}
            <a className="submit-url-link" href="#request-url"><span className="submit-url-icon" aria-hidden="true">＋</span><span>Submit a URL</span><span className="submit-url-arrow" aria-hidden="true">↗</span></a>
          </div>
          {/* The directory's search. The landing page has no list to filter,
              so its hero carries the explore call to action instead and the
              field lives here — and in the phone's drawer. A landmark with an
              explicit name: the wrapping label used to name the field "/"
              (its only text was the shortcut hint). */}
          {isExplore && <>
          <div className="search-wrap" role="search">
            <span className="search-icon mono" aria-hidden="true">⌕</span>
            <input
              id="site-search"
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSitesCollapsed(false); }}
              placeholder={dict.searchPlaceholder}
              aria-label={dict.searchAria}
              aria-describedby="site-search-hint"
              autoComplete="off"
              enterKeyHint="search"
            />
            {/* The slash hint gives way to a clear button once there is
                something to clear, so the field always ends in one action. */}
            {query ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => { buzz(6); setQuery(""); searchRef.current?.focus(); }}
                aria-label="Clear the search"
              >
                <span aria-hidden="true">×</span>
              </button>
            ) : (
              <kbd className="shortcut-hint" aria-hidden="true">/</kbd>
            )}
            <span id="site-search-hint" className="sr-only">Search names, descriptions and tags across every collection. Use #tag or tag:value for an exact tag. Combine words to narrow results. Press slash to focus this field.</span>
          </div>
          <div className="search-tag-suggestions" aria-label="Search tags across all collections">
            <span className="mono">Try a tag</span>
            {searchTags.map((tag) => <button type="button" key={tag} aria-pressed={query.toLowerCase() === `#${tag.toLowerCase()}`} onClick={() => { setQuery(`#${tag}`); searchRef.current?.focus(); }}>#{tag}</button>)}
          </div>
          </>}
        </section>

        {/* Everything from here down to the footer sits on the page's grey
            field: a full-bleed slab that starts just under the search bar and
            runs to the bottom of the page, so the hero reads as a lit header
            above a grey body. The quick jumps moved out of the hero and into
            the slab, since they belong to the browsing half of the page. */}
        <div className="page-band">
          {/* Two halves of one component, and three blocks. `/explore`
              (`isExplore`) carries the directory itself: the search, the
              filters, the featured sites, the four off-directory strips and
              the URL request form. The landing page carries a browsing half
              of its own — the section keys, the editor's picks, the top ten
              and the tag shelf — followed by the prose sections and the
              signup. The blocks are wrapped rather than split into separate
              files so there is one implementation of the directory — its
              state, its filters, its polling — and so the section order its
              tests pin stays in one readable place. */}
          {!isExplore && <>
          {/* The landing page's way in. The lists themselves live on
              `/explore`, so every key here is a link into that page's own
              section (or into one of the derived indexes), not an anchor into
              this one. They lead the band, above the editor's picks and the
              top ten, because the whole job of the landing page is to get a
              visitor into the list. */}
          <nav className="quick-jumps" aria-label="Jump to a section">
            {[
              { href: "/explore#sites", label: dict.featured, count: `${allSites.length} sites` },
              { href: "/explore#cool-sites", label: dict.coolSites, count: `${coolSites.length} sites` },
              { href: "/explore#cool-apis", label: dict.coolApis, count: `${coolApis.length} APIs` },
              { href: "/explore#cool-apps", label: dict.coolApps, count: `${coolApps.length} apps` },
              { href: "/explore#cool-ais", label: dict.coolAis, count: `${allCoolAis.length} AIs` },
              // The only key that leaves for a page rather than a section of this
              // one: no-code AI tools has a subsite of its own, like every other
              // section, and nothing on the landing page lists it yet.
              { href: "/explore/no-code-ai-tools", label: dict.noCodeAiTools, count: `${sectionCount("no-code-ai-tools")} tools` },
              { href: "/tags", label: "Tags", count: `${tagCount} tags` },
              { href: "/recently-added", label: "Recently added", count: `${recentlyAdded.length} dated` },
              { href: "/quality-report", label: "Quality report", count: "reviews" },
            ].map((jump) => (
              <a key={jump.href} className="quick-jump" href={jump.href} onClick={() => tick(12)}>
                <span className="quick-jump-label">{jump.label}</span>
                <span className="quick-jump-meta">
                  <span className="quick-jump-count mono">{jump.count}</span>
                  <span className="quick-jump-arrow mono" aria-hidden="true">→</span>
                </span>
              </a>
            ))}
          </nav>

          {/* The editor's picks rotate through the shortlist on /explore; the
              landing page shows the same carousel, because the picks are the
              editorial voice of the directory and a visitor who never opens
              a menu should still meet them. */}
          <EditorsPicks />

          {/* The ten most-voted picks, in the streaming-service shape: a rank
              numeral, a row, a flame. It reads the same shared vote totals the
              cards do, so the two can never disagree. */}
          <TopTen />

          {/* The upload form is not the directory's alone: a visitor who found
              something while browsing the homepage should be able to pass it
              on without opening /explore first. It is the same component and
              the same Worker route as the copy at the bottom of /explore, and
              it sits between the Top 10 and the tag shelf so those two lists
              stay the pair they were. */}
          <UrlRequest />

          {/* Tags are an index of their own, so the landing page offers the
              shelf rather than only a link to it: every chip is a real
              `/tags/<slug>` page listing every entry that carries the tag. */}
          <section id="browse-tags" className="tag-strip directory-section" aria-labelledby="browse-tags-heading">
            <div className="tag-strip-heading">
              <h2 id="browse-tags-heading">Browse by tag</h2>
              <Link className="tag-strip-all mono" href="/tags" onClick={() => tick(12)}>All {tagCount} tags <span aria-hidden="true">→</span></Link>
            </div>
            <div className="tag-strip-list">
              {directoryTags.slice(0, 18).map((info) => (
                <Link
                  key={info.slug}
                  className={`tag-strip-item tone-${tagTone(info.tag)}`}
                  href={`/tags/${info.slug}`}
                  onClick={() => tick(12)}
                >
                  <span className="tag-strip-name">#{info.tag}</span>
                  <span className="tag-strip-count mono">{info.count}</span>
                </Link>
              ))}
            </div>
          </section>
          </>}

          {isExplore && <>
          {/* The answer first: the closest matches from every collection in one
              block, above the sections that hold them. It renders nothing at
              all while there is no query, and nothing when nothing matched. */}
          <BestMatches query={query} />

          {/* The section keys, for the visitor who would rather browse than
              type. Each one is an in-page anchor, so it needs no routing: the
              browser scrolls, the section's own scroll-margin keeps it clear
              of the header, and the rail follows the move like any other
              scroll. They hide while there is a question on screen, because
              the list of what matched is the answer and not a menu.

              The editor's picks carousel used to lead this page. It is the
              landing page's now, and only the landing page's: /explore exists
              to be searched. */}
          {!query.trim() && <nav className="quick-jumps" aria-label="Jump to a section">
            {[
              { href: "#sites", label: dict.featured, count: `${allSites.length} sites` },
              { href: "#cool-sites", label: dict.coolSites, count: `${coolSites.length} sites` },
              { href: "#cool-apis", label: dict.coolApis, count: `${coolApis.length} APIs` },
              { href: "#cool-apps", label: dict.coolApps, count: `${coolApps.length} apps` },
              { href: "#cool-ais", label: dict.coolAis, count: `${allCoolAis.length} AIs` },
              { href: "#no-code-ai-tools", label: dict.noCodeAiTools, count: `${sectionCount("no-code-ai-tools")} tools` },
              // The two in-page jumps above are anchors; these three leave the
              // page for the derived indexes. They are grouped last so the row
              // still reads as "browse this page, then browse the whole thing".
              { href: "/recently-added", label: "Recently added", count: `${recentlyAdded.length} dated` },
              { href: "/tags", label: "Tags", count: `${tagCount} tags` },
              { href: "/quality-report", label: "Quality report", count: "reviews" },
            ].map((jump) => (
              <a key={jump.href} className="quick-jump" href={jump.href} onClick={() => tick(12)}>
                <span className="quick-jump-label">{jump.label}</span>
                <span className="quick-jump-meta">
                  <span className="quick-jump-count mono">{jump.count}</span>
                  <span className="quick-jump-arrow mono" aria-hidden="true">→</span>
                </span>
              </a>
            ))}
          </nav>}

        {showSites && (
        <section id="sites" className={`directory-section${sitesVibrating ? " is-vibrating" : ""}`} aria-labelledby="sites-heading">
          <div className="section-heading" data-reveal>
            {/* The heading is the disclosure control: the label and the arrow
                live in one button, so clicking either one toggles the panel. */}
            <h2 id="sites-heading" className="section-heading-main">
              <button
                type="button"
                className={`sites-toggle${sitesCollapsed ? " is-collapsed" : ""}`}
                onClick={() => { setSitesCollapsed((collapsed) => !collapsed); }}
                aria-expanded={!sitesCollapsed}
                aria-controls="sites-panel"
              >
                <span className="sites-toggle-label">{dict.featured}</span>
                <svg className="sites-toggle-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </h2>
            {(query.trim() || activeTag) && (
              <span className="section-count mono" aria-live="polite">
                {list.length} match{list.length === 1 ? "" : "es"}
              </span>
            )}
          </div>

          {/* With the panel hidden the list simply vanishes, so the closed
              state says so in words instead of leaving a silent gap. */}
          {sitesCollapsed && (
            <p className="section-closed-note" role="status">
              {dict.featuredClosed}
            </p>
          )}

          <div id="sites-panel" className="sites-panel" hidden={sitesCollapsed}>
          <div className="filter-bar" data-reveal>
            <div className="tag-filters" role="group" aria-label={dict.filterByTag}>
              <button
                type="button"
                className={`tag-chip${activeTag === null ? " is-active" : ""}`}
                aria-pressed={activeTag === null}
                onClick={() => { buzz(6); setActiveTag(null); }}
              >
                {dict.allTag}
              </button>
              {allTags.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-chip${activeTag === tag ? " is-active" : ""}`}
                  aria-pressed={activeTag === tag}
                  onClick={() => { buzz(6); setActiveTag(activeTag === tag ? null : tag); }}
                >
                  {tag} <span className="tag-chip-count mono">{count}</span>
                </button>
              ))}
            </div>
            <div className="sort-controls" role="group" aria-label={dict.sortBy}>
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`sort-button${sortMode === option.value ? " is-active" : ""}`}
                  aria-pressed={sortMode === option.value}
                  onClick={() => { buzz(6); setSortMode(option.value); }}
                >
                  {option.value === "liked" ? dict.liked : option.value === "newest" ? dict.newest : dict.az}
                </button>
              ))}
            </div>
          </div>

          <div className="site-list" role="list" aria-label="Deployed sites" aria-busy={booting}>
            {list.length === 0 && (
              <p className="empty">
                No sites match{activeTag ? <> the tag <strong>{activeTag}</strong></> : null}
                {query.trim() ? <> “{query.trim()}”</> : null}.{" "}
                {coolMatchCount > 0 && (
                  <>
                    {coolMatchCount} off-directory pick{coolMatchCount === 1 ? "" : "s"} in the strips below{" "}
                    {coolMatchCount === 1 ? "matches" : "match"}.{" "}
                  </>
                )}
                <button
                  type="button"
                  className="empty-reset"
                  onClick={() => { setQuery(""); setActiveTag(null); }}
                >
                  Clear filters
                </button>
              </p>
            )}
            {shownSites.map((site, index) => {
              const pinned = favorites.includes(site.subdomain);
              const vote = votes[site.subdomain];
              const totals = voteTotals[site.subdomain];
              const pops = votePops[site.subdomain];
              const isNew = !!site.createdAt && site.createdAt > newCutoff;
              return (
                <article
                  key={site.subdomain}
                  className={`site-card${pinned ? " is-pinned" : ""}`}
                  data-reveal
                  role="listitem"
                  style={{ "--i": index } as CSSProperties}
                >
                  {/* Preview tags and copy belong to the outbound link;
                      votes, details and the pin remain separate controls. */}
                  <a
                    href={site.url}
                    className="site-link site-card-main"
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${site.name} — open site${site.description ? `: ${site.description}` : ""}`}
                  >
                    <span className="site-preview-shell">
                      <SitePreview site={site} />
                      {!!site.tags?.length && <span className="tags preview-tags" aria-label="Tags">
                        {site.tags.map((tag) => <span key={tag} className={`tag mono tone-${tagTone(tag)}`}>{tag}</span>)}
                      </span>}
                    </span>
                    <span className="site-card-info">
                      <span className="site-card-title">
                        <span className="site-name">{site.name}</span>
                        {site.community && <span className="site-badge mono">community</span>}
                        {isNew && <span className="site-badge is-new mono">new</span>}
                      </span>
                      <span className="site-card-head">
                        <SiteIcon site={site} />
                        <span className="site-card-host mono">{new URL(site.url).hostname.replace(/^www\./, "")}</span>
                        <span className="site-open mono" aria-hidden="true">↗</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </span>
                      {site.description && <span className="site-description">{site.description}</span>}
                    </span>
                  </a>
                  {/* The vote row sits under the link, so the thumbs stay
                      outside it and nothing interactive is ever nested. The
                      pin floats over the preview. */}
                  <Freshness item={{ ...site, description: site.description ?? "" }} />
                  <div className="site-card-lower">
                    <div className="site-actions">
                      {/* Rate first; the detail link follows on its own row. */}
                      <span className="vote-stack">
                        <button
                          type="button"
                          className={`vote-button up${vote === 1 ? " is-active" : ""}`}
                          onClick={() => castVote(site.subdomain, 1)}
                          aria-pressed={vote === 1}
                          aria-label={`Thumbs up ${site.name}${totals ? `, ${totals.up} up` : ""}`}
                        >
                          <ThumbIcon />
                          {/* keyed so the count replays its pop animation on change;
                              the number is in the button's label, so this is
                              decorative to avoid reading the same value twice. */}
                          <span key={totals ? totals.up : "none"} className="vote-count mono" aria-hidden="true">{totals ? totals.up : "–"}</span>
                          {/* Keyed on the click count so it replays on every
                              vote: a rising +1 that scrolls up out of the
                              button and fades, decoration only. */}
                          {pops?.up ? (
                            <span key={`pop-${pops.up}`} className="vote-pop mono" aria-hidden="true">+1</span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className={`vote-button down${vote === -1 ? " is-active" : ""}`}
                          onClick={() => castVote(site.subdomain, -1)}
                          aria-pressed={vote === -1}
                          aria-label={`Thumbs down ${site.name}${totals ? `, ${totals.down} down` : ""}`}
                        >
                          <ThumbIcon down />
                          <span key={totals ? totals.down : "none"} className="vote-count mono" aria-hidden="true">{totals ? totals.down : "–"}</span>
                          {pops?.down ? (
                            <span key={`pop-${pops.down}`} className="vote-pop mono" aria-hidden="true">-1</span>
                          ) : null}
                        </button>
                      </span>
                    </div>
                    {detailPath(site.url) && <a className="site-detail-link featured-detail-link" href={detailPath(site.url)!}>Details <span aria-hidden="true">→</span><span className="sr-only"> about {site.name}</span></a>}
                  </div>
                  {/* The pin floats at the card's top-right corner, over the
                      preview, but stays outside the link so the two controls
                      never overlap in the tab order. */}
                  <button
                    type="button"
                    className={`favorite-button${pinned ? " is-active" : ""}`}
                    onClick={() => toggleFavorite(site.subdomain)}
                    aria-pressed={pinned}
                    aria-label={pinned ? `Unpin ${site.name}` : `Pin ${site.name} to the top`}
                  >
                    <HeartIcon filled={pinned} />
                  </button>
                </article>
              );
            })}
            {/* The cut. A long directory lands as a screenful you can take in,
                with one line at the end holding the rest — the count is that
                line's point, so it stays quiet until the pointer is on it. */}
            {foldCount > 0 && !query.trim() && (
              <button
                type="button"
                className="show-all"
                data-reveal
                aria-expanded={showAllSites}
                onClick={() => { buzz(8); setShowAllSites((value) => !value); }}
              >
                <span className="show-all-label">
                  {showAllSites ? "Show fewer" : `Show all ${list.length} sites`}
                </span>
                <span className="show-all-count mono" aria-hidden="true">
                  {showAllSites ? `-${foldCount}` : `+${foldCount}`}
                </span>
              </button>
            )}
            {!query.trim() && (
              <button type="button" className="upload-card" data-reveal onClick={openSubmit} aria-haspopup="dialog">
                <span className="upload-card-icon mono" aria-hidden="true">＋</span>
                <span className="upload-card-body">
                    <span className="upload-card-title">{dict.addYourSite}</span>
                    <span className="upload-card-text">{dict.addYourSiteText}</span>
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
          </div>
          {/* One link from the homepage into the tool guides. Those pages
              carry the in-depth copy and the FAQ schema, so this is the entry
              point that lets a visitor (and a crawler) reach them. */}
          <p className="tools-hub-link">
            Want the full story on any of these? <a href="/tools">Read the tool guides →</a>{" "}
            Or take the whole list with you: <Link href="/explore/sites">open the featured sites section →</Link>
          </p>
        </section>
        )}

        {/* The four off-directory strips are plain lists with no border of
            their own, so each one is marked off with a divider; the bordered
            blocks below (about, discussion, support) already separate
            themselves and are left alone.

            A search decides what is on screen. A strip with nothing matching
            is not rendered at all — heading, divider and closed note with it —
            so the answer to a question is a short page of the sections that
            did match rather than six headings and five "nothing here" lines.
            Each strip also hands over the way to its own page, where the whole
            collection can be searched and filtered on its own. */}
        {showCoolSites && <>
        <hr className="section-divider" aria-hidden="true" />

        {/* Off-directory picks: external cool sites from config/cool-sites.json,
            rendered as smaller, quieter cards than the directory's own. */}
        <CoolSites dict={dict} query={query} />
        </>}

        {showCoolApis && <>
        <hr className="section-divider" aria-hidden="true" />

        {/* A second strip in the same shape as the one above: free public
            APIs from config/cool-apis.json, for visitors who came to build
            something rather than only browse. */}
        <CoolApis dict={dict} query={query} />
        </>}

        {showCoolApps && <>
        <hr className="section-divider" aria-hidden="true" />

        {/* A third strip in the same shape: browser apps from
            config/cool-apps.json, for the visitor who wants a tool to use
            rather than a site to read. */}
        <CoolApps dict={dict} query={query} />
        </>}

        {showCoolAis && <>
        <hr className="section-divider" aria-hidden="true" />

        {/* The last strip is the pair of AI lists, so it stays up while either
            "Cool AIs" or "No-code AI tools" has something to show. */}
        <CoolAis dict={dict} query={query} />
        </>}

        <hr className="section-divider" aria-hidden="true" />

        <UrlRequest />

          </>}

        {!isExplore && <>
        <AboutSection />

        {/* The support hub: the Trustpilot reviews, the donation board, the
            sponsored referrals and the paid support button, gathered under one
            collapsible "Support" heading. It is open by default and the
            heading toggles it, the same way the featured-sites heading does.

            It sits directly under About the directory now: those two are the
            page's "who this is and how it stays free" pair, and the board
            follows them instead of interrupting. */}
        <SupportSection />

        <DiscussionBoard />

        <hr className="section-divider" aria-hidden="true" />

        {/* SEO FAQ. */}
        <Faq />

        <hr className="section-divider" aria-hidden="true" />

        {/* Live count-up from the launch of base31. It used to sit above the
            questions; it now closes the page's prose, directly under them. */}
        <LaunchClock />

        {/* The subscribe block is the last thing before the footer, so the page
            ends on the call to action. */}
        <DirectoryNotifications />

        {/* The bottom of the page: the decorative sparkle and the sponsorship
            invitation, directly above the footer. */}
        <FooterSponsor />
        </>}
        </div>
      </main>

      <footer className="site-footer">
        <nav className="footer-publications" aria-label="Read our posts elsewhere">
          <span className="mono">Beyond the directory</span>
          <a href="https://dev.to/base31" target="_blank" rel="noopener noreferrer"><strong>DEV</strong> Read our posts on dev.to <span aria-hidden="true">↗</span></a>
          <a href="https://medium.com/@base31dotorg" target="_blank" rel="noopener noreferrer"><strong>M</strong> Read our posts on Medium <span aria-hidden="true">↗</span></a>
        </nav>
        {/* Contact details and the deployed build version. They sit at the very
            bottom of the page, for visitors and search crawlers alike. The
            version comes from package.json, so it tracks the release. */}
        <div className="footer-meta mono">
          <address className="footer-contact">
            <span className="footer-contact-label">Contact</span>
            <a className="footer-contact-item" href="mailto:hello@base31.org">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3.6 7 8.4 6 8.4-6" />
              </svg>
              hello@base31.org
            </a>
            <a className="footer-contact-item" href="tel:+16124443853">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5.2 3.5h3l1.5 4-2 1.4a12.4 12.4 0 0 0 5.4 5.4l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A15.6 15.6 0 0 1 3.5 5.7 2 2 0 0 1 5.2 3.5Z" />
              </svg>
              612 444 3853
            </a>
            <span className="footer-contact-item">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s7-6.4 7-11.1a7 7 0 1 0-14 0C5 14.6 12 21 12 21Z" />
                <circle cx="12" cy="9.9" r="2.6" />
              </svg>
              Minneapolis, Minnesota
            </span>
          </address>
          {/* Links to the changelog, so the version number has somewhere to go. */}
          <a className="footer-version" href="/whats-new" title="What's new in this version">v{pkg.version}</a>
        </div>
        {/* The language switcher: the four shipped locales, hand-rolled rather
            than Next's built-in i18n (the routes are explicit folders, so a
            static switcher is all the routing that exists). It sits in the
            footer now, with the rest of the site's small print, instead of
            competing with the wordmark and the account actions up top. The
            active language is hidden from the tab order but stays announced
            via aria-current. `order` puts it below the two other footer rows. */}
        <div className="footer-lang mono">
          <span className="footer-lang-label">Language</span>
          <nav className="lang-switch" aria-label="Language">
            {LOCALES.map((item) => (
              <a
                key={item.code}
                href={item.code === "en" ? "/" : `/${item.code}`}
                className={`lang-link${item.code === localeCode ? " is-active" : ""}`}
                aria-current={item.code === localeCode ? "page" : undefined}
                title={item.label}
              >
                {item.short}
              </a>
            ))}
          </nav>
        </div>
        <div className="site-footer-inner mono">
          <span>
            Copyright © 2026 base31.org · built by Sawyer Schulz · sparkle gif from{" "}
            <a href="https://www.glitter-graphics.com" target="_blank" rel="noreferrer">glitter-graphics.com</a>
          </span>
          <nav className="footer-links" aria-label="Footer navigation">
            <a href="/blog">Blog</a>
            <a href="/tools">Tools</a>
            {/* The signup block is on the landing page only, so the directory
                has to link back to it rather than to a hash it does not have. */}
            <a href={isExplore ? "/#updates" : "#updates"}>Updates</a>
            <a href="/whats-new">What&rsquo;s new</a>
            <a href="/recently-added">Recently added</a>
            <a href="/tags">Tags</a>
            <a href="/quality-report">Quality report</a>
            <a href="/stats">Stats</a>
            <a href="/admin/community-sites">Admin</a>
            <a href="/about">About us</a>
            <a href="/our-story">Our story</a>
            <a href="/terms">Terms of service</a>
            <a href="/privacy">Privacy</a>
            <a href="/security">Security</a>
            <a href="https://dmca.base31.org" target="_blank" rel="noopener">DMCA takedown</a>
            {/* The one footer item that leaves the site, so it carries the
                GitHub mark and reads as a small button rather than a link. */}
            <a className="footer-source" href="https://github.com/NOTAM-bobk/base31" target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M12 1.8a10.2 10.2 0 0 0-3.2 19.9c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.7-1.4-2.3-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.5 9.5 0 0 1 5 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10.2 10.2 0 0 0 12 1.8Z" />
              </svg>
              Source code
            </a>
            <a href="mailto:hello@base31.org?subject=base31%20bug%20report">Bug report</a>
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

      {shareOpen && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShareOpen(false)}>
          <div ref={shareRef} tabIndex={-1} className="modal share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-title">
            <button type="button" className="modal-close" onClick={() => setShareOpen(false)} aria-label="Close share screen">×</button>
            <p className="eyebrow mono">share the directory</p>
            <h2 id="share-title">Send base31 to a friend.</h2>
            <p className="share-lede">Hand-picked sites, tiny tools, and the odd strange corner of the web — one page, no feed to scroll.</p>

            <div className="share-preview" aria-hidden="true">
              <span className="share-mark mono">31</span>
              <span className="share-preview-copy">
                <strong>base31.org</strong>
                <span>Cool sites for curious people.</span>
              </span>
            </div>

            <div className="share-link">
              <span className="share-link-url mono">{shareAddress}</span>
              <button type="button" className="share-copy mono" onClick={() => copyLink()}>
                copy
              </button>
            </div>

            <div className="share-targets">
              <button type="button" className="share-target is-primary" onClick={nativeShare}>
                <span className="share-target-icon" aria-hidden="true">↗</span>
                Share…
              </button>
              <a className="share-target" href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noreferrer">
                <span className="share-target-icon" aria-hidden="true">𝕏</span> X
              </a>
              <a className="share-target" href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noreferrer">
                <span className="share-target-icon" aria-hidden="true">f</span> Facebook
              </a>
              <a className="share-target" href={`https://www.reddit.com/submit?url=${shareUrl}&title=${shareText}`} target="_blank" rel="noreferrer">
                <span className="share-target-icon" aria-hidden="true">▲</span> Reddit
              </a>
              <a className="share-target" href={`mailto:?subject=${shareText}&body=${shareUrl}`}>
                <span className="share-target-icon" aria-hidden="true">@</span> Email
              </a>
            </div>

            <p className="share-note mono">no account · no feed · just sites</p>
          </div>
        </div>
      )}

      {milestone != null && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setMilestone(null)}>
          <div ref={milestoneRef} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="milestone-title" aria-live="polite">
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
          <div ref={submitRef} tabIndex={-1} className="modal submit-sheet" role="dialog" aria-modal="true" aria-labelledby="submit-title">
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
          <div ref={exitRef} tabIndex={-1} className="modal exit-modal" role="dialog" aria-modal="true" aria-labelledby="exit-title">
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

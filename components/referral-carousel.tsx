"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import referrals from "@/config/referrals.json";

type Referral = {
  name: string;
  url: string;
  description: string;
  /** Optional badge, e.g. "referral" or "support". */
  tag?: string;
  /** Optional image override. Defaults to a screenshot of the destination. */
  image?: string;
  show?: boolean;
};

const ROTATE_MS = 7000;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// A live screenshot of the destination (WordPress mShots needs no API key),
// with the site's own favicon as the fallback and a lettered tile as the last
// resort — so a blocked or slow image never leaves an empty box. These are
// plain destination previews, not tracking, so they load whatever the visitor
// answered in the cookie banner; the links themselves stay inert until
// clicked, exactly as before.
const shotSrc = (referral: Referral) =>
  referral.image || `https://s0.wp.com/mshots/v1/${encodeURIComponent(referral.url)}?w=640&h=400`;
const faviconSrc = (referral: Referral) => {
  try {
    return `${new URL(referral.url).origin}/favicon.ico`;
  } catch {
    return "";
  }
};

function ReferralShot({ referral }: { referral: Referral }) {
  const [stage, setStage] = useState<"shot" | "favicon" | "letter">("shot");
  const favicon = faviconSrc(referral);

  if (stage === "letter" || (stage === "favicon" && !favicon)) {
    return <span className="referral-fallback mono" aria-hidden="true">{referral.name.slice(0, 1).toUpperCase()}</span>;
  }

  return (
    <img
      className={stage === "favicon" ? "is-favicon" : undefined}
      src={stage === "shot" ? shotSrc(referral) : favicon}
      /* The name, host and description sit right beside this, so the image is
         decorative and stays out of the accessibility tree. */
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setStage((current) => (current === "shot" ? "favicon" : "letter"))}
    />
  );
}

export default function ReferralCarousel() {
  const items = useMemo(
    () => (referrals as Referral[]).filter((item) => item.show !== false && !!item.name?.trim() && /^https:\/\//.test(item.url)),
    [],
  );
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  const go = useCallback((delta: number) => {
    if (count < 2) return;
    setIndex((current) => (current + delta + count) % count);
  }, [count]);

  // Advance on its own unless the visitor is interacting with the carousel.
  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, paused]);

  const buzz = (pattern: number) => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      navigator.vibrate(pattern);
    } catch {}
  };

  if (count === 0) return null;

  return (
    <section
      className="referral-block"
      data-reveal
      aria-roledescription="carousel"
      aria-label="Sponsored referral links"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          buzz(6);
          go(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          buzz(6);
          go(-1);
        }
      }}
    >
      <div className="referral-head">
        <span className="referral-ad mono">ad</span>
        <h2>Referrals worth a look</h2>
        <div className="referral-controls">
          <button
            type="button"
            className="referral-nav"
            onClick={() => { buzz(6); go(-1); }}
            aria-label="Previous referral"
            disabled={count < 2}
          >
            ‹
          </button>
          <button
            type="button"
            className="referral-nav"
            onClick={() => { buzz(6); go(1); }}
            aria-label="Next referral"
            disabled={count < 2}
          >
            ›
          </button>
        </div>
      </div>

      <div
        className="referral-viewport"
        onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (start == null) return;
          const distance = (event.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(distance) > 40) {
            buzz(6);
            go(distance < 0 ? 1 : -1);
          }
        }}
      >
        <ul className="referral-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {items.map((item, itemIndex) => (
            <li key={item.url} className="referral-slide" role="group" aria-roledescription="slide" aria-label={`${itemIndex + 1} of ${count}: ${item.name}`} aria-hidden={itemIndex !== index}>
              <a
                className="referral-card"
                href={item.url}
                target="_blank"
                rel="noreferrer sponsored"
                tabIndex={itemIndex === index ? 0 : -1}
              >
                <span className="referral-shot">
                  <ReferralShot referral={item} />
                </span>
                <span className="referral-copy">
                  <span className="referral-name">
                    {item.name}
                    {item.tag && <span className="referral-tag mono">{item.tag}</span>}
                  </span>
                  <span className="referral-host mono">{hostOf(item.url)}</span>
                  <span className="referral-desc">{item.description}</span>
                  <span className="referral-visit">
                    Visit {hostOf(item.url)} <span aria-hidden="true">↗</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Announces the slide the carousel moved to, for screen readers that
          never see the (aria-hidden) off-screen slides. */}
      <p className="sr-only" role="status">
        {index + 1} of {count}: {items[index]?.name}
      </p>

      {count > 1 && (
        <div className="referral-dots">
          {items.map((item, itemIndex) => (
            <button
              key={item.url}
              type="button"
              className={`referral-dot${itemIndex === index ? " is-active" : ""}`}
              aria-label={`Show ${item.name}`}
              aria-current={itemIndex === index ? "true" : undefined}
              onClick={() => { buzz(6); setIndex(itemIndex); }}
            />
          ))}
        </div>
      )}

      <p className="referral-note mono">
        {index + 1} / {count} · sponsored link — we may earn something if you visit
      </p>
    </section>
  );
}

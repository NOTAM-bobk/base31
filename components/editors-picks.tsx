"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import picks from "@/config/editors-picks.json";
import { directoryEntries, tagTone } from "@/lib/directory";

// One slide per configured pick, joined to its directory entry so the carousel
// shows the real name, section and tags rather than a duplicated shortlist.
const items = picks.flatMap((pick) => {
  const entry = directoryEntries.find((item) => item.slug === pick.slug);
  return entry ? [{ ...entry, note: pick.note }] : [];
});

const ROTATE_MS = 7000;

export default function EditorsPicks() {
  const [index, setIndex] = useState(0);
  // Which way the last move travelled, so the slide animates in from that side.
  const [direction, setDirection] = useState(1);
  const [interacted, setInteracted] = useState(false);
  const touchStart = useRef<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const rotating = !interacted && !hovered && !focused && !reduced;
  useEffect(() => {
    if (!rotating || items.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        setDirection(1);
        setIndex((current) => (current + 1) % items.length);
      }
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating]);
  if (!items.length) return null;
  const item = items[index];
  const go = (delta: number) => {
    setInteracted(true);
    setDirection(delta >= 0 ? 1 : -1);
    setIndex((current) => (current + delta + items.length) % items.length);
  };
  const tagChips = (item.tags ?? []).slice(0, 3);
  return (
    <section id="editors-picks" className={`editors-picks${rotating ? " is-rotating" : ""}`} aria-label="Editor's picks" aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => { setFocused(true); setInteracted(true); }} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; setInteracted(true); }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (start === null) return;
        const distance = (event.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(distance) > 50) go(distance < 0 ? 1 : -1);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); go(event.key === "ArrowRight" ? 1 : -1); }
      }}>
      <div className="editors-heading">
        <h2>Editor&rsquo;s picks</h2>
        <span className="editors-position mono" aria-hidden="true">{String(index + 1).padStart(2, "0")} <span className="editors-position-sep">/</span> {String(items.length).padStart(2, "0")}</span>
      </div>
      <p className="sr-only">Focus a pick to pause rotation. Use left and right arrow keys to browse, or swipe on a touchscreen. Manual browsing stops automatic rotation.</p>
      {/* Remounting on the slug is what lets the enter animation replay; the
          direction attribute is what tells it which edge to slide in from. */}
      <div className="editors-slide" key={item.slug} data-direction={direction} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${items.length}`} aria-live={rotating ? "off" : "polite"}>
        <span className="editors-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <div className="editors-copy">
          {/* Only the tags now: the pick's collection was printed above its
              name, and the name of a site already says which kind of thing it
              is — the label repeated the directory's own furniture on a card
              that is about one entry. */}
          <div className="editors-meta">
            {tagChips.length > 0 && (
              <span className="editors-tags" aria-hidden="true">
                {tagChips.map((tag) => <span key={tag} className={`editors-tag mono tone-${tagTone(tag)}`}>#{tag}</span>)}
              </span>
            )}
          </div>
          <h3><Link href={`/sites/${item.slug}`}>{item.name}</Link></h3>
          <p>{item.note}</p>
        </div>
        <Link className="editors-cta" href={`/sites/${item.slug}`}>
          <span>Explore pick</span>
          <span className="editors-cta-arrow" aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="editors-progress" key={`progress-${index}`} aria-hidden="true">
        {items.map((pick, position) => <span key={pick.slug} className={position === index ? "is-active" : undefined} />)}
      </div>
    </section>
  );
}

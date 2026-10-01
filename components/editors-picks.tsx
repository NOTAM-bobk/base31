"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import picks from "@/config/editors-picks.json";
import { directoryEntries } from "@/lib/directory";

const items = picks.flatMap((pick) => {
  const entry = directoryEntries.find((item) => item.slug === pick.slug);
  return entry ? [{ ...entry, note: pick.note }] : [];
});

export default function EditorsPicks() {
  const [index, setIndex] = useState(0);
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
      if (!document.hidden) setIndex((current) => (current + 1) % items.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [rotating]);
  if (!items.length) return null;
  const item = items[index];
  const go = (delta: number) => {
    setInteracted(true);
    setIndex((current) => (current + delta + items.length) % items.length);
  };
  return (
    <section id="editors-picks" className="editors-picks" aria-label="Editor's picks" aria-roledescription="carousel"
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
      <div className="editors-heading"><h2>Editor's picks</h2><span className="editors-position mono" aria-hidden="true">{index + 1} / {items.length}</span></div>
      <p className="sr-only">Focus a pick to pause rotation. Use left and right arrow keys to browse, or swipe on a touchscreen. Manual browsing stops automatic rotation.</p>
      <div className="editors-slide" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${items.length}`} aria-live={rotating ? "off" : "polite"}>
        <span className="editors-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <div className="editors-copy"><span className="editors-section mono">{item.section}</span><h3><Link href={`/sites/${item.slug}`}>{item.name}</Link></h3><p>{item.note}</p></div>
        <Link className="editors-cta" href={`/sites/${item.slug}`}>Explore pick <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="editors-progress" aria-hidden="true">{items.map((pick, position) => <span key={pick.slug} className={position === index ? "is-active" : undefined} />)}</div>
    </section>
  );
}

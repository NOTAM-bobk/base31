"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import picks from "@/config/editors-picks.json";
import { directoryEntries } from "@/lib/directory";

const items = picks.flatMap((pick) => {
  const entry = directoryEntries.find((item) => item.slug === pick.slug);
  return entry ? [{ ...entry, note: pick.note }] : [];
});

export default function EditorsPicks() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
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
  const rotating = !paused && !hovered && !focused && !reduced;
  useEffect(() => {
    if (!rotating || items.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % items.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [rotating]);
  if (!items.length) return null;
  const item = items[index];
  const go = (delta: number) => setIndex((current) => (current + delta + items.length) % items.length);
  return (
    <section id="editors-picks" className="editors-picks" aria-label="Editor's picks" aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); go(event.key === "ArrowRight" ? 1 : -1); }
      }}>
      <div className="editors-heading">
        <div><p className="eyebrow mono">THE SHORTLIST · NOT SPONSORED</p><h2>Editor's picks</h2></div>
        <div className="editors-controls">
          {!reduced && <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Start automatic rotation" : "Pause automatic rotation"}>{paused ? "Play" : "Pause"}</button>}
          <button type="button" onClick={() => go(-1)} disabled={items.length < 2} aria-label="Previous editor's pick">←</button>
          <button type="button" onClick={() => go(1)} disabled={items.length < 2} aria-label="Next editor's pick">→</button>
        </div>
      </div>
      <div className="editors-slide" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${items.length}`} aria-live={rotating ? "off" : "polite"}>
        <span className="editors-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <div className="editors-copy"><span className="editors-section mono">{item.section}</span><h3><Link href={`/sites/${item.slug}`}>{item.name}</Link></h3><p>{item.note}</p></div>
        <Link className="editors-cta" href={`/sites/${item.slug}`}>Explore pick <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="editors-dots" aria-label="Choose an editor's pick">{items.map((pick, position) => <button type="button" key={pick.slug} aria-label={`Show ${pick.name}`} aria-current={position === index ? "true" : undefined} onClick={() => setIndex(position)}><span /></button>)}</div>
    </section>
  );
}

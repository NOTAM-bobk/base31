"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { tick } from "@/lib/haptics";

export type RailSection = { id: string; label: string };

/**
 * The section rail: a slim column of small lines down the right edge of the
 * homepage, one per section, in page order.
 *
 * It is drawn as part of the page rather than as a panel on top of it — no
 * fill, no border, no blur, no shadow — so only the bars themselves sit in the
 * gutter beside the column, against the background. The single exception is the
 * label that opens for the section you are in: it carries a faint wash of the
 * page colour so it stays readable wherever it reaches.
 *
 * Every section is rendered, so the whole page is reachable from the rail
 * itself: when the list is taller than the rail's cap the column scrolls —
 * the wheel works inside it like any other scroll container — and
 * the line for the section you are reading is kept scrolled into view as you
 * read down the page, so the readout never slides off the end of the column.
 *
 * The line for the current section stands on end and turns green while its
 * label slides out beside it, so the rail is both a position readout and a
 * menu. Clicking a line scrolls the page there, and the arrow keys walk the
 * list one section at a time. Hold a line briefly, then drag to scrub the full
 * section list; pointer capture keeps the gesture working outside the rail.
 *
 * It is always there, from the first screen on, at every width: on a wide
 * monitor it sits in the gutter beside the centered column, on a phone it is a
 * slim strip of bars in the same gutter. Nothing to scroll past to find it, and
 * nothing it covers.
 *
 * Every step it takes — a click or an arrow key — buzzes once through the
 * Vibration API, so moving a section lands as a physical tick on a phone
 * instead of only a scroll. `lib/haptics.ts` turns it off entirely for
 * visitors who asked for reduced motion.
 */
export default function SectionRail({ sections }: { sections: RailSection[] }) {
  const [active, setActive] = useState(0);
  const rail = useRef<HTMLElement | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const gesture = useRef<{ id: number; startY: number; y: number; index: number; last: number; held: boolean } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);

  // Which section is on screen: the last one whose top has passed a third of
  // the way down the viewport. Measured on scroll inside a rAF so a fast wheel
  // cannot queue a layout per event. The rail itself never hides, so this only
  // ever picks the line that stands up.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.34;
      let current = 0;
      sections.forEach((section, index) => {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= line) current = index;
      });
      if (!gesture.current?.held) setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections]);

  // Keep the current line inside the rail's own scroll area. The rail can be
  // scrolled by hand to browse ahead, so this only runs when the *page* moves
  // the current section — a manual scroll of the list is left alone.
  useEffect(() => {
    const node = rail.current;
    if (!node || gesture.current?.held) return;
    const line = node.querySelector<HTMLElement>(".rail-item.is-active");
    if (!line) return;
    const top = line.offsetTop - (node.clientHeight - line.offsetHeight) / 2;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
  }, [active]);

  const goTo = useCallback(
    (index: number, instant = false) => {
      const section = sections[index];
      if (!section) return;
      const element = document.getElementById(section.id);
      if (!element) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // The first entry is the hero, which starts at the very top of the page;
      // everything else stops just below the fixed header.
      const top = section.id === "page-title" ? 0 : element.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({ top: Math.max(0, top), behavior: reduced || instant ? "instant" : "smooth" });
      setActive(index);
      tick(12);
    },
    [sections],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      goTo(Math.min(sections.length - 1, Math.max(0, active + (event.key === "ArrowDown" ? 1 : -1))));
      tick(10);
    },
    [active, goTo, sections.length],
  );

  // Hold for 280ms, then scrub from the pressed section. Moving one rail
  // height traverses the full list, including lines outside the clipped area.
  const scrub = () => {
    const current = gesture.current;
    const node = rail.current;
    if (!current?.held || !node) return;
    const step = Math.max(12, node.clientHeight / Math.max(1, sections.length - 1));
    const index = Math.min(sections.length - 1, Math.max(0, current.index + Math.round((current.y - current.startY) / step)));
    if (index === current.last) return;
    current.last = index;
    goTo(index, true);
  };
  const pointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || gesture.current) return;
    const button = (event.target as Element).closest<HTMLButtonElement>(".rail-item");
    if (!button) return;
    const index = Number(button.dataset.index);
    suppressClick.current = false;
    gesture.current = { id: event.pointerId, startY: event.clientY, y: event.clientY, index, last: index, held: false };
    button.setPointerCapture(event.pointerId);
    holdTimer.current = setTimeout(() => {
      const current = gesture.current;
      if (!current) return;
      current.held = true;
      suppressClick.current = true;
      setScrubbing(true);
      goTo(current.index, true);
      scrub();
    }, 280);
  };
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    current.y = event.clientY;
    if (!current.held && Math.abs(current.y - current.startY) > 8) {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      suppressClick.current = true;
      return;
    }
    scrub();
  };
  const pointerEnd = (event: PointerEvent<HTMLElement>) => {
    if (gesture.current?.id !== event.pointerId) return;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (event.type === "pointercancel") suppressClick.current = true;
    gesture.current = null;
    setScrubbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <nav ref={rail} className={`section-rail${scrubbing ? " is-scrubbing" : ""}`} aria-label="Page sections" onKeyDown={onKeyDown}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}>
      <span className="sr-only">Tap a line to jump. Hold a line, then slide up or down to move between sections.</span>
      {scrubbing && <span className="rail-scrub-label mono" aria-hidden="true">{sections[active]?.label}</span>}
      {sections.map((section, index) => {
        const current = index === active;
        return (
          <button
            key={section.id}
            type="button"
            className={`rail-item${current ? " is-active" : ""}`}
            data-index={index}
            onClick={(event) => {
              if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
              goTo(index);
            }}
            aria-label={section.label}
            aria-current={current ? "true" : undefined}
            title={section.label}
          >
            <span className="rail-label mono" aria-hidden="true">{section.label}</span>
            <span className="rail-bar" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}

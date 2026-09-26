"use client";

import { useEffect, useRef } from "react";

// The custom pointer: a dot that tracks the cursor and a slower ring that trails
// it. It only mounts on fine-pointer, motion-friendly devices — the effect
// bails out otherwise — so touch and reduced-motion visitors keep the native
// cursor. Moved out of app/page.tsx so that file stays small.
export default function Cursor() {
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

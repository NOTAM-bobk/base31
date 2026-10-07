"use client";

import { useState } from "react";
import type { CSSProperties, FocusEvent } from "react";
import { directoryEntries } from "@/lib/directory";
import { directorySections } from "@/lib/sections";

/* The site web: the whole directory drawn as one branching graph.
   ====================================================================

   Every collection is a hub and every pick in it hangs off that hub on its own
   thread, so the shape of the picture is the shape of the directory: six
   branches, and the number of threads on each one is that collection's real
   count. Nothing here is drawn from a hand-kept list — the hubs come from
   `lib/sections.ts` (the one registry every collection is described in) and the
   leaves come from `lib/directory.ts` (the derived entry list the cards, the
   strips and every detail page are built from). Add a pick to any config and it
   appears on the next build with no edit in this file, which is what makes the
   map maintain itself.

   Two decisions are worth knowing about before changing anything here.

   1. The geometry is computed once, at module scope, and rounded to a tenth of
   a pixel. The server and the browser each run this file, so a layout that
   depended on `Math.random()` or on a live clock would hydrate differently on
   every visit — React would then throw a mismatch. A stable hash of each
   slug supplies the small irregularity that stops the picture looking like a
   printout, so the same input always gives the same picture.

   2. Every node is a real `<a href>`, not an onClick handler: a hub opens its
   collection's page (`/explore/<id>`) and a leaf opens its pick
   (`/sites/<slug>`). That keeps the middle click, the context menu and the
   back button working, and it means the graph is still a usable list of links
   before any JavaScript has run. Hovering or focusing anything lights its whole
   branch and dims the rest, which is the "how does this link up" answer.

   The drawing is decoration with real links in it, so the SVG carries a short
   `aria-label` and a second, visually-hidden list under it names every
   collection with its count — a screen reader does not have to read 200 nodes
   to learn what the map says. Motion is the site's own rule: the idle drift
   only runs while <html> has `data-motion="enabled"` (set by the pre-paint
   script in app/layout.tsx for visitors who have not asked for reduced
   motion), and app/late.css drops it entirely under
   `prefers-reduced-motion: reduce`. */

// The canvas. A 1000x600 box scaled to the container keeps the proportions
// right at every width; the hubs sit on this ellipse and each cluster spreads
// about 90px, which is why the ellipse is wider than it is tall.
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 600;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = 296;
const HUB_RX = 330;
const HUB_RY = 196;
// The golden angle: consecutive leaves of one cluster land evenly spaced
// around their hub without a random number in sight.
const GOLDEN_ANGLE = 2.399963229728653;
const HUB_BASE_RADIUS = 13;
const LEAF_RADIUS = 3.2;
const MAX_CLUSTER_RADIUS = 86;

/** One decimal place: identical strings on the server and in the browser. */
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * A stable 0..1 from a string — the FNV-1a step, not `Math.random()`.
 *
 * The layout needs a little irregularity (a perfectly regular spiral reads as
 * a diagram, not as a web) but it has to be the *same* irregularity on both
 * sides of a hydration, so the jitter comes from the thing that is already
 * unique — the slug — rather than from chance. `salt` gives one string several
 * independent numbers.
 */
const hashUnit = (value: string, salt: number): number => {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
};

type Hub = {
  id: string;
  label: string;
  unit: string;
  count: number;
  x: number;
  y: number;
  radius: number;
  /** Where this cluster's spiral starts, so no two clusters are aligned. */
  seed: number;
  /** Which accent tint the branch wears; see `.site-web-tone-*` in late.css. */
  tone: number;
};

type Leaf = {
  slug: string;
  name: string;
  sectionId: string;
  sectionLabel: string;
  category?: string;
  x: number;
  y: number;
  /** Where this leaf's thread leaves its hub — the hub is not drawn through. */
  fromX: number;
  fromY: number;
  /** Position within its own collection; also the animation's phase offset. */
  order: number;
  hub: Hub;
};

// The hubs. One per collection, spread around the ellipse from the top.
const HUBS: Hub[] = directorySections.map((section, index) => {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / directorySections.length;
  const count = section.items.length;
  return {
    id: section.id,
    label: section.label,
    unit: section.unit,
    count,
    x: round(CENTER_X + Math.cos(angle) * HUB_RX),
    y: round(CENTER_Y + Math.sin(angle) * HUB_RY),
    // A busier collection wears a visibly bigger hub, so the picture carries
    // the counts even before a visitor hovers anything.
    radius: round(HUB_BASE_RADIUS + Math.min(9, count * 0.16)),
    seed: hashUnit(section.id, 7) * Math.PI * 2,
    tone: index % 6,
  };
});

const HUB_BY_ID = new Map(HUBS.map((hub) => [hub.id, hub]));

// The leaves. `order` counts an entry's position inside its own collection —
// the Vogel spiral below spaces them evenly at any count, and the same number
// staggers the animation so the drift never pulses in unison.
const LEAVES: Leaf[] = (() => {
  const placed: Leaf[] = [];
  const seen = new Map<string, number>();
  for (const entry of directoryEntries) {
    const hub = HUB_BY_ID.get(entry.sectionId);
    if (!hub) continue;
    const order = seen.get(entry.sectionId) ?? 0;
    seen.set(entry.sectionId, order + 1);
    const angle = hub.seed + order * GOLDEN_ANGLE + (hashUnit(entry.slug, 3) - 0.5) * 0.22;
    const radius = Math.min(MAX_CLUSTER_RADIUS, 12 * Math.sqrt(order + 1.6)) + (hashUnit(entry.slug, 11) - 0.5) * 5;
    const x = round(hub.x + Math.cos(angle) * radius);
    const y = round(hub.y + Math.sin(angle) * radius);
    // The thread starts at the hub's own edge rather than its centre, so the
    // disc is not crossed by 60 lines.
    const dx = x - hub.x;
    const dy = y - hub.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const inset = Math.max(0, distance - hub.radius) / distance;
    placed.push({
      slug: entry.slug,
      name: entry.name,
      sectionId: entry.sectionId,
      sectionLabel: entry.section,
      ...(entry.category ? { category: entry.category } : {}),
      x,
      y,
      fromX: round(hub.x + dx * inset),
      fromY: round(hub.y + dy * inset),
      order,
      hub,
    });
  }
  return placed;
})();

/** What the label over the canvas says when nothing is under the pointer. */
const IDLE_TIP = "Hover, tap or tab a node to light its branch — every node opens its own page.";

type Highlight = { sectionId: string; label: string; note: string };

export default function SiteWeb() {
  // `hot` is the branch under the pointer (or holding focus). It starts null on
  // the server and on the first client render, so the two markups match; only a
  // real interaction ever changes it.
  const [hot, setHot] = useState<Highlight | null>(null);

  const highlightHub = (hub: Hub) => setHot({ sectionId: hub.id, label: hub.label, note: `${hub.count} ${hub.unit}` });
  const highlightLeaf = (leaf: Leaf) =>
    setHot({
      sectionId: leaf.sectionId,
      label: leaf.name,
      note: `${leaf.sectionLabel}${leaf.category ? ` · ${leaf.category}` : ""}`,
    });
  // Leaving the panel clears the highlight; a blur only clears it when focus
  // has actually left the whole graph, or tabbing between nodes would flicker.
  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHot(null);
  };

  const summary = `${HUBS.length} collections and ${LEAVES.length} picks`;
  const activeSection = hot?.sectionId ?? null;

  return (
    <section
      id="site-web"
      className={`site-web directory-section${hot ? " is-dimmed" : ""}`}
      data-reveal
      aria-labelledby="site-web-heading"
      onMouseLeave={() => setHot(null)}
      onBlur={handleBlur}
    >
      <div className="site-web-head">
        <h2 id="site-web-heading">The whole directory, as one web</h2>
        <span className="site-web-badge mono" aria-hidden="true">live map</span>
      </div>
      <p className="site-web-lede">
        All {LEAVES.length} picks in one picture: {HUBS.length} collections branch out of the middle, every pick hangs
        off the branch it belongs to, and a busier branch is drawn bigger. Hover, tap or tab a node to light its branch,
        then follow it to its page. It is drawn from the directory itself — a new pick appears here by itself the next
        time the site is published.
      </p>

      {/* The graph is wider than a phone. It scrolls inside its own box rather
          than pushing the page sideways; see app/late.css. */}
      <div className="site-web-scroll">
        <svg
          className="site-web-canvas"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          role="group"
          aria-label={`A map of the base31.org directory: ${summary}.`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* The threads are decoration: the links below them are the content. */}
          <g className="site-web-edges" aria-hidden="true">
            {LEAVES.map((leaf) => (
              <line
                key={leaf.slug}
                className={`site-web-edge site-web-tone-${leaf.hub.tone}${activeSection === leaf.sectionId ? " is-hot" : ""}`}
                x1={leaf.fromX}
                y1={leaf.fromY}
                x2={leaf.x}
                y2={leaf.y}
                style={{ "--i": leaf.order } as CSSProperties}
              />
            ))}
          </g>
          <g className="site-web-nodes">
            {LEAVES.map((leaf) => (
              <a
                key={leaf.slug}
                className={`site-web-node site-web-leaf site-web-tone-${leaf.hub.tone}${activeSection === leaf.sectionId ? " is-hot" : ""}`}
                href={`/sites/${leaf.slug}`}
                onMouseEnter={() => highlightLeaf(leaf)}
                onFocus={() => highlightLeaf(leaf)}
                style={{ "--i": leaf.order } as CSSProperties}
              >
                <title>{`${leaf.name} — ${leaf.sectionLabel}`}</title>
                {/* One circle, drawn small and given a fat transparent stroke
                    by app/late.css: the stroke is the tap target, so a cluster
                    of 60 dots stays legible and each one stays big enough to
                    hit. `transparent` is a colour, not `none`, so it still
                    receives the pointer. */}
                <circle className="site-web-leaf-dot" cx={leaf.x} cy={leaf.y} r={LEAF_RADIUS} />
              </a>
            ))}
            {HUBS.map((hub) => (
              <a
                key={hub.id}
                className={`site-web-node site-web-hub site-web-tone-${hub.tone}${activeSection === hub.id ? " is-hot" : ""}`}
                href={`/explore/${hub.id}`}
                onMouseEnter={() => highlightHub(hub)}
                onFocus={() => highlightHub(hub)}
              >
                <title>{`${hub.label} — ${hub.count} ${hub.unit}`}</title>
                <circle className="site-web-hub-ring" cx={hub.x} cy={hub.y} r={hub.radius} />
                <circle className="site-web-hub-core" cx={hub.x} cy={hub.y} r={round(hub.radius * 0.42)} />
              </a>
            ))}
          </g>
        </svg>
      </div>

      <p className="site-web-tip" aria-live="polite">
        {hot ? (
          <>
            <strong>{hot.label}</strong> <span className="site-web-tip-note mono">{hot.note}</span>
          </>
        ) : (
          IDLE_TIP
        )}
      </p>

      <ul className="site-web-legend">
        {HUBS.map((hub) => (
          <li key={hub.id}>
            <a
              className={`site-web-chip site-web-tone-${hub.tone}`}
              href={`/explore/${hub.id}`}
              onMouseEnter={() => highlightHub(hub)}
              onFocus={() => highlightHub(hub)}
            >
              <span className="site-web-legend-dot" aria-hidden="true" />
              <span>{hub.label}</span>
              <span className="site-web-count mono">{hub.count}</span>
            </a>
          </li>
        ))}
      </ul>

      {/* The same information as a sentence, for a reader who cannot see the
          picture — and cheap enough to print instead of 200 node labels. */}
      <p className="sr-only">
        A map of the base31.org directory, {summary}. {HUBS.map((hub) => `${hub.label}: ${hub.count} ${hub.unit}, at /explore/${hub.id}`).join(". ")}. Every
        pick is also listed at /explore, and each has its own page under /sites.
      </p>
    </section>
  );
}

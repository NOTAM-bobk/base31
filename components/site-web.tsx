"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FocusEvent } from "react";
import { directoryEntries } from "@/lib/directory";
import { tick } from "@/lib/haptics";
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

   Three decisions are worth knowing about before changing anything here.

   1. The geometry is computed once, at module scope, and rounded to a tenth of
   a pixel. The server and the browser each run this file, so a layout that
   depended on `Math.random()` or on a live clock would hydrate differently on
   every visit — React would then throw a mismatch. A stable hash of each
   slug supplies the small irregularity that stops the picture looking like a
   printout, so the same input always gives the same picture. The one number
   that should *be* a surprise — which pick the wander button lights — is drawn
   from the platform's entropy source at the moment the visitor asks for it, so
   the picture still hydrates identically and the button still surprises.

   2. Every node is a real `<a href>`, not an onClick handler: a hub opens its
   collection's page (`/explore/<id>`) and a leaf opens its pick
   (`/sites/<slug>`). That keeps the middle click, the context menu and the
   back button working, and it means the graph is still a usable list of links
   before any JavaScript has run. Hovering or focusing anything lights its whole
   branch and dims the rest, which is the "how does this link up" answer.

   3. The drawing is decoration with real links in it, so the SVG carries a short
   `aria-label` and a second, visually-hidden list under it names every
   collection with its count — a screen reader does not have to read 200 nodes
   to learn what the map says. Motion is the site's own rule: the idle drift
   only runs while <html> has `data-motion="enabled"` (set by the pre-paint
   script in app/layout.tsx for visitors who have not asked for reduced
   motion), and app/late.css drops it entirely under
   `prefers-reduced-motion: reduce`.

   The map is not a panel. There is no box drawn around it — the canvas, its
   heading and its controls sit on the page band itself, and the only thing
   behind them is a soft glow (see the foot of app/late.css). Everything
   interactive is on the canvas: the hot node's name is written next to it,
   `Wander the web` lights a pick at random and the line beneath the canvas
   offers the visit it just named, and the small bar under that counts the picks
   this visitor has met, which is kept in their browser rather than on the
   server. */

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

/** Every slug the map can hand a visitor, for the met-count lookup below. */
const LEAF_SLUGS = new Set(LEAVES.map((leaf) => leaf.slug));

// The picks this visitor has already met, kept beside the votes and the fires
// in localStorage. Like those two it is a keepsake rather than a record: the
// server never sees it, nothing depends on it, and a cleared browser starts the
// count again at zero.
const MET_STORAGE_KEY = "base31-web-met";

/** What the label over the canvas says when nothing is under the pointer. */
const IDLE_TIP = "Hover, tap or tab a node to light its branch — every node opens its own page.";

type Highlight = {
  sectionId: string;
  label: string;
  note: string;
  x: number;
  y: number;
  /** Set on a leaf: what the tip's visit link opens. Absent on a hub. */
  slug?: string;
};

/** The hot state a leaf produces, so hovering and wandering describe it alike. */
const describeLeaf = (leaf: Leaf): Highlight => ({
  sectionId: leaf.sectionId,
  label: leaf.name,
  note: `${leaf.sectionLabel}${leaf.category ? ` · ${leaf.category}` : ""}`,
  x: leaf.x,
  y: leaf.y,
  slug: leaf.slug,
});

/** The picks met so far, narrowed to the ones the directory still lists. */
const readMet = (): Set<string> => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(MET_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return new Set();
    return new Set(saved.filter((slug): slug is string => typeof slug === "string" && LEAF_SLUGS.has(slug)));
  } catch {
    return new Set();
  }
};

/**
 * One index out of `length`, never the one already lit.
 *
 * The geometry avoids `Math.random()` so both sides of the hydration agree on
 * it, but a wander button that always landed on the same node would be a puzzle
 * instead of a wander. This is the one number that is better off random, so it
 * comes from the platform's entropy source — and only at the moment the visitor
 * presses the button, which is long after the two renderings have to match.
 */
const pickIndex = (length: number, avoid: number): number => {
  if (length <= 1) return 0;
  let index = 0;
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const draws = crypto.getRandomValues(new Uint32Array(1));
    index = (draws[0] ?? 0) % length;
  }
  if (index === avoid) index = (index + 1) % length;
  return index;
};

export default function SiteWeb() {
  // `hover` is the node under the pointer (or holding focus) and `wanderIndex`
  // points at the pick the button lit. Both start empty on the server and on
  // the first client render, so the two markups match; only a real interaction
  // ever fills them. A wandered pick stays lit after the pointer leaves the
  // canvas, which is why the two are separate states rather than one: leaving
  // the map hands the branch back to the pick you asked to see, and the button
  // clears the hover when it is pressed so the tip describes that pick rather
  // than whatever the pointer was last over.
  const [hover, setHover] = useState<Highlight | null>(null);
  const [wanderIndex, setWanderIndex] = useState<number | null>(null);
  const [met, setMet] = useState<Set<string>>(() => new Set());

  // The count lives in the visitor's browser, so it can only be read after
  // mount: the server has no way to know it, and rendering it during hydration
  // would be a guess that React would then have to correct. Reading it in an
  // effect keeps the first paint on both sides identical.
  useEffect(() => {
    setMet(readMet());
  }, []);

  const wanderLeaf = wanderIndex === null ? null : LEAVES[wanderIndex] ?? null;
  const hot = hover ?? (wanderLeaf ? describeLeaf(wanderLeaf) : null);

  const meet = (slug: string) => {
    if (met.has(slug)) return;
    const next = new Set(met).add(slug);
    setMet(next);
    try {
      localStorage.setItem(MET_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Storage can be full or switched off; the count is a keepsake, not state.
    }
  };

  const forgetMet = () => {
    setMet(new Set());
    try {
      localStorage.removeItem(MET_STORAGE_KEY);
    } catch {
      // Nothing to undo if the write was never possible in the first place.
    }
  };

  const highlightHub = (hub: Hub) =>
    setHover({ sectionId: hub.id, label: hub.label, note: `${hub.count} ${hub.unit}`, x: hub.x, y: hub.y });
  const highlightLeaf = (leaf: Leaf) => {
    setHover(describeLeaf(leaf));
    meet(leaf.slug);
  };
  // Leaving the panel clears the pointer's highlight; a blur only clears it when
  // focus has actually left the whole graph, or tabbing between nodes would
  // flicker.
  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover(null);
  };

  const wander = () => {
    const index = pickIndex(LEAVES.length, wanderIndex ?? -1);
    const leaf = LEAVES[index];
    setWanderIndex(index);
    if (!leaf) return;
    setHover(null);
    meet(leaf.slug);
    tick(14);
  };

  const summary = `${HUBS.length} collections and ${LEAVES.length} picks`;
  const activeSection = hot?.sectionId ?? null;
  const visit = hot?.slug ?? null;
  // The label grows away from the middle of the canvas, so a name near an edge
  // opens inward instead of running off the picture, and it sits above its node
  // unless the node is at the very top.
  const labelFlipped = hot ? hot.x > VIEW_WIDTH * 0.62 : false;
  const labelX = hot ? round(hot.x + (labelFlipped ? -16 : 16)) : 0;
  const labelY = hot ? round(hot.y < 60 ? hot.y + 30 : hot.y - 16) : 0;
  const metPercent = Math.round((met.size / Math.max(1, LEAVES.length)) * 100);

  return (
    <section
      id="site-web"
      className={`site-web directory-section${hot ? " is-dimmed" : ""}`}
      data-reveal
      aria-labelledby="site-web-heading"
      onMouseLeave={() => setHover(null)}
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
            {/* The ripple that marks where the wander button landed. Drawn
                under the dots so it reads as a wave leaving the pick. */}
            {wanderLeaf && (
              <circle className="site-web-aim" cx={wanderLeaf.x} cy={wanderLeaf.y} r={7} aria-hidden="true" />
            )}
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
          {/* What you are pointing at, named where you are pointing. The line
              under the canvas says the same thing for anyone who cannot see
              this, so the label is decoration. */}
          {hot && (
            <g className="site-web-label" aria-hidden="true">
              <text
                className="site-web-label-name"
                x={labelX}
                y={labelY}
                textAnchor={labelFlipped ? "end" : "start"}
              >
                {hot.label}
              </text>
              <text
                className="site-web-label-note"
                x={labelX}
                y={labelY + 13}
                textAnchor={labelFlipped ? "end" : "start"}
              >
                {hot.note}
              </text>
            </g>
          )}
        </svg>
      </div>

      <p className="site-web-tip" aria-live="polite">
        {hot ? (
          <>
            <strong>{hot.label}</strong> <span className="site-web-tip-note mono">{hot.note}</span>
            {visit && (
              <a className="site-web-tip-visit" href={`/sites/${visit}`} onClick={() => tick(12)}>
                Visit <span aria-hidden="true">→</span>
              </a>
            )}
          </>
        ) : (
          IDLE_TIP
        )}
      </p>

      {/* The map's one control, and the count of how much of it this visitor has
          walked past. Both are quiet: the picture is the point. */}
      <div className="site-web-controls">
        <button type="button" className="site-web-wander" onClick={wander}>
          <span className="site-web-wander-icon" aria-hidden="true">✦</span>
          <span>{wanderLeaf ? "Wander again" : "Wander the web"}</span>
        </button>
        <div className="site-web-met">
          <span className="site-web-met-bar" aria-hidden="true">
            <span className="site-web-met-fill" style={{ width: `${metPercent}%` }} />
          </span>
          <span className="site-web-met-label mono">{met.size} / {LEAVES.length} picks met</span>
          {met.size > 0 && (
            <button type="button" className="site-web-met-reset" onClick={forgetMet}>Reset</button>
          )}
        </div>
      </div>

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
        pick is also listed at /explore, and each has its own page under /sites. A button below the map lights one pick at
        random, and the count beside it remembers how many of the {LEAVES.length} picks this visitor has pointed at.
      </p>
    </section>
  );
}

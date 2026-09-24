import type { CSSProperties } from "react";

/* A fixed wallpaper of code typing itself out behind the page.
   Server rendered on purpose: there is no JavaScript, no timer and no state
   here — each line is a CSS width animation with a stepped timing function,
   staggered by a negative delay so the lines never restart in sync. The
   layer is `aria-hidden`, ignores pointer events, and is dropped entirely
   under `prefers-reduced-motion` (see app/overrides.css). */

// Short on purpose: each line has to land in a glance, and none of them
// should read as real output from this project.
const CODE_LINES = [
  "const sites = await fetchSites({ live: true })",
  "sites.filter(isLive).map(renderCard)",
  "await kv.put(`votes:${key}:up`, String(next))",
  "export default function Home() { ... }",
  "npm run validate:content && npm run typecheck",
  "git commit -m \"ship it\" && git push",
  "if (prefersReducedMotion) return null",
  "curl -s https://base31.org/sitemap.xml | head",
  "addEventListener(\"push\", (event) => show(event))",
  "serve(public/sites/example/index.html)",
];

export default function CodeBackdrop() {
  return (
    <div className="code-backdrop" aria-hidden="true">
      {CODE_LINES.map((line, index) => (
        <span
          key={line}
          className="code-line"
          // One character per step, measured in `ch`, so the monospace line
          // types exactly as wide as its own text at every font size.
          style={{ "--i": index, "--ch": `${line.length}ch`, "--steps": line.length } as CSSProperties}
        >
          {line}
        </span>
      ))}
    </div>
  );
}

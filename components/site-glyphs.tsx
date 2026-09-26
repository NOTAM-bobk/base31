import type { ReactNode } from "react";

// The fallback glyphs drawn on a directory card when its favicon is missing or
// fails to load. Every kept site ships a hand-made favicon at
// /site-icons/<subdomain>.svg, so this list is the safety net that keeps a card
// from showing an empty box. They live here rather than in app/page.tsx so that
// file stays small (and within a comfortable editing window).
export const SITE_GLYPHS: ReactNode[] = [
  // bolt
  <path key="bolt" d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12L13 2Z" />,
  // star
  <path key="star" d="m12 3.5 2.6 5.6 6 .9-4.4 4.2 1.1 6-5.3-3.1-5.3 3.1 1.1-6-4.4-4.2 6-.9Z" />,
  // globe
  <g key="globe">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18" />
  </g>,
  // open book
  <g key="book">
    <path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4Z" />
    <path d="M20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6Z" />
  </g>,
  // burst
  <path key="burst" d="M12 3v5m0 8v5M3 12h5m8 0h5M6.2 6.2l3.2 3.2m5.2 5.2 3.2 3.2m0-11.6-3.2 3.2m-5.2 5.2-3.2 3.2" />,
  // compass
  <g key="compass">
    <circle cx="12" cy="12" r="9" />
    <path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3Z" />
  </g>,
  // camera
  <g key="camera">
    <path d="M3.5 8.5h3L8 6h8l1.5 2.5h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.1" />
  </g>,
  // music note
  <g key="music">
    <path d="M9 18V6.5l9-2V16" />
    <circle cx="6.6" cy="18" r="2.4" />
    <circle cx="15.6" cy="16" r="2.4" />
  </g>,
  // ghost
  <g key="ghost">
    <path d="M5 20V10a7 7 0 0 1 14 0v10l-2.4-1.9-2.4 1.9-2.2-1.9-2.4 1.9L7.4 18Z" />
    <path d="M9.6 10h.01M14.4 10h.01" />
  </g>,
  // rocket
  <g key="rocket">
    <path d="M13.6 3.6c3.4.5 6.3 3.4 6.8 6.8-2.3 4.5-5.6 7.6-9.6 9.3L7 16.2c1.7-4 4.3-7.4 6.6-12.6Z" />
    <path d="M9.6 15.4 6 19m3.6-10L5.4 12" />
  </g>,
  // leaf
  <g key="leaf">
    <path d="M20 4c0 8.2-5 13-11.2 13H5C5 8.8 10 4 16.2 4Z" />
    <path d="M4 20c3.2-5 7.4-8.2 12.4-10.2" />
  </g>,
  // moon
  <path key="moon" d="M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6Z" />,
  // coffee cup
  <g key="cup">
    <path d="M4 8h11v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" />
    <path d="M15 10h2a3 3 0 0 1 0 6h-2" />
    <path d="M6.5 4.5c0 .9 1 1.3 1 2.2M10 4c0 1 1 1.5 1 2.4" />
  </g>,
  // terminal
  <g key="terminal">
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <path d="m7.2 9.5 2.8 2.8-2.8 2.8M12.8 15.2H17" />
  </g>,
  // cloud
  <path key="cloud" d="M7 18.5h10a4.1 4.1 0 0 0 .4-8.2 5.6 5.6 0 0 0-10.8 1.3A3.5 3.5 0 0 0 7 18.5Z" />,
  // dice
  <g key="dice">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" />
  </g>,
];

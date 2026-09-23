import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./overrides.css";
import ConsentAwareAds from "@/components/consent-aware-ads";
import ConsentAwareAnalytics from "@/components/consent-aware-analytics";
import PrivacyConsent from "@/components/privacy-consent";
import StructuredData from "@/components/structured-data";

const siteUrl = "https://base31.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "base31.org — A Directory of Cool Sites and Fun Websites",
  description: "Explore base31.org, an independent directory of cool sites, fun websites, creative web projects, and useful online tools built for the open web.",
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "/blog/feed.xml", "application/feed+json": "/blog/feed.json" },
  },
  manifest: "/manifest.webmanifest",
  keywords: ["website directory", "cool sites", "fun websites", "creative web projects", "indie web", "online tools", "interesting websites"],
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "base31.org — A Directory of Cool Sites and Fun Websites",
    description: "A curated directory of cool sites, fun websites, creative projects, and useful tools on the open web.",
    siteName: "base31.org",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "base31.org — Cool Sites and Fun Websites", description: "Discover creative web projects, useful tools, and fun websites in the base31.org directory." },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "light dark", viewportFit: "cover" };
// Runs before the first paint: restore the saved theme, and opt into the
// scroll-reveal animations only when the visitor allows motion. Because the
// flag lives on <html> and is set by this script, `[data-reveal]` content is
// never hidden when JavaScript is unavailable.
const themeScript = `try{if(localStorage.getItem("base31-theme")==="light"){document.documentElement.setAttribute("data-theme","light")}}catch(e){}try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.classList.add("anim")}}catch(e){}try{addEventListener("error",function(){document.documentElement.classList.remove("anim")},true)}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script id="base31-theme" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <noscript><style>{`.site-skeleton,.cursor-layer{display:none!important}`}</style></noscript>
      </head>
      <body>
        <div className="top-accent" aria-hidden="true" />
        <StructuredData />
        {children}
        <PrivacyConsent />
        <ConsentAwareAnalytics />
        <ConsentAwareAds />
      </body>
    </html>
  );
}

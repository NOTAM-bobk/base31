import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Gochi_Hand, Titan_One } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "./overrides.css";
// Styles for the inner pages that live outside the homepage (/stats,
// /whats-new, /tools); loaded after the two above so it can layer over them.
import "./inner-pages.css";
// Small corrections that must win over overrides.css (same specificity, later
// file). See the file header for why it exists.
import "./late.css";
import { GOOGLE_ANALYTICS_ID, googleTagSnippet } from "@/lib/analytics";
import CodeBackdrop from "@/components/code-backdrop";
import ConsentAwareAds from "@/components/consent-aware-ads";
import ConsentAwareAnalytics from "@/components/consent-aware-analytics";
import PrivacyConsent from "@/components/privacy-consent";
import StructuredData from "@/components/structured-data";
import BlogTransitions from "@/components/blog-transitions";
import PageBehaviors from "@/components/page-behaviors";

// Two display faces from Google Fonts. next/font downloads and self-hosts the
// files at build time, so nothing on the page ever asks fonts.googleapis.com
// for them — no third-party request, no render-blocking stylesheet and no font
// fetched before the visitor has answered the cookie banner. Card names wear
// Titan One and the header text wears Gochi Hand; the rules that use them live
// in app/late.css, which is why both hand over a CSS variable.
const titanOne = Titan_One({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const gochiHand = Gochi_Hand({ subsets: ["latin"], weight: "400", variable: "--font-hand", display: "swap" });

const siteUrl = "https://base31.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "base31.org — A Directory of Cool Sites and Fun Websites",
  description: "Explore base31.org, an independent directory of cool sites, fun websites, creative web projects, and useful online tools built for the open web.",
  alternates: {
    canonical: "/",
    // hreflang pair for the shipped homepage translations: crawlers get an
    // explicit map instead of guessing from /es-style slugs. x-default
    // (searchers whose language is not covered) points at English.
    languages: { "x-default": "/", en: "/", es: "/es", fr: "/fr", pt: "/pt" },
    types: { "application/rss+xml": "/blog/feed.xml", "application/feed+json": "/blog/feed.json" },
  },
  manifest: "/manifest.webmanifest",
  keywords: ["base31", "base31.org", "base 31", "website directory", "cool sites", "fun websites", "creative web projects", "indie web", "online tools", "interesting websites"],
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "base31.org — A Directory of Cool Sites and Fun Websites",
    description: "A curated directory of cool sites, fun websites, creative projects, and useful tools on the open web.",
    siteName: "base31.org",
    locale: "en_US",
    alternateLocale: ["es_ES", "fr_FR", "pt_BR"],
  },
  twitter: { card: "summary_large_image", title: "base31.org — Cool Sites and Fun Websites", description: "Discover creative web projects, useful tools, and fun websites in the base31.org directory." },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "light dark", viewportFit: "cover" };
// Runs before the first paint: restore the saved theme, and opt into the
// scroll-reveal animations only when the visitor allows motion. Because the
// flag lives on <html> and is set by this script, `[data-reveal]` content is
// never hidden when JavaScript is unavailable.
const themeScript = `try{if(localStorage.getItem("base31-theme")==="light"){document.documentElement.setAttribute("data-theme","light")}}catch(e){}try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.setAttribute("data-motion","enabled")}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${titanOne.variable} ${gochiHand.variable}`}>
      <head>
        {/* Google tag (gtag.js), first in the head as Google's installation
            instruction asks. The snippet documented at the top of README.md is
            served here instead of being appended after hydration, so the tag is
            part of the HTML of every page and Google can verify it. Consent Mode
            keeps the cookie banner in charge: all four storage types start
            `denied`, and components/consent-aware-analytics.tsx grants them when
            the visitor accepts. One tag per page — this is the only one. */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`} />
        <script id="google-analytics" dangerouslySetInnerHTML={{ __html: googleTagSnippet }} />
        <meta name="impact-site-verification" content="0c13bbc7-5a07-4070-84da-1b320feed539" />
        {/* Trustpilot one-time domain verification (documented in README.md). */}
        <meta name="trustpilot-one-time-domain-verification-id" content="c33dc438-a677-4add-a519-04714888e931" />
        <script id="base31-theme" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <noscript><style>{`.site-skeleton,.cursor-layer{display:none!important}`}</style></noscript>
      </head>
      <body>
        <CodeBackdrop />
        <div className="top-accent" aria-hidden="true" />
        <StructuredData />
        <BlogTransitions />
        {/* Screen Wake Lock plus the leave warning; see the component for why. */}
        <PageBehaviors />
        {children}
        {/* Trustpilot TrustBox bootstrap. It scans for `.trustpilot-widget`
            placeholders (the review collector lives in app/page.tsx) and swaps
            them for the hosted widget once the page is interactive. */}
        <Script
          id="trustpilot-bootstrap"
          src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
          strategy="afterInteractive"
        />
        <PrivacyConsent />
        <ConsentAwareAnalytics />
        <ConsentAwareAds />
        <Analytics />
      </body>
    </html>
  );
}

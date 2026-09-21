import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const siteUrl = "https://base31.org";

// Microsoft Clarity analytics snippet, injected into the document <head>.
const clarityTag = "ylsxc7fokm";
const clarityScript = `(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${clarityTag}");`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "base31.org — A Directory of Cool Sites and Fun Websites",
  description:
    "Explore base31.org, an independent directory of cool sites, fun websites, creative web projects, and useful online tools built for the open web.",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      // Google Search only renders favicons that are square and a multiple of
      // 48px, so the 48/96/192px assets below are the ones it actually uses.
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/base31-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  keywords: [
    "website directory",
    "cool sites",
    "fun websites",
    "creative web projects",
    "indie web",
    "online tools",
    "interesting websites",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "base31.org — A Directory of Cool Sites and Fun Websites",
    description:
      "A curated directory of cool sites, fun websites, creative projects, and useful tools on the open web.",
    siteName: "base31.org",
    locale: "en_US",
    images: [{ url: "/icons/base31-icon-512.png", width: 512, height: 512, alt: "base31 geometric mark" }],
  },
  twitter: {
    card: "summary",
    title: "base31.org — Cool Sites and Fun Websites",
    description:
      "Discover creative web projects, useful tools, and fun websites in the base31.org directory.",
    images: ["/icons/base31-icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "light dark" };

// Applied before paint so a saved light theme never flashes dark.
const themeScript = `try{if(localStorage.getItem("base31-theme")==="light"){document.documentElement.setAttribute("data-theme","light")}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script id="base31-theme" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          id="microsoft-clarity"
          type="text/javascript"
          dangerouslySetInnerHTML={{ __html: clarityScript }}
        />
        {/* Without JS these never clear themselves, so hide them entirely. */}
        <noscript>
          <style>{`.site-skeleton,.cursor-layer{display:none!important}`}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const siteUrl = "https://base31.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "base31.org — A Directory of Cool Sites and Fun Websites",
  description:
    "Explore base31.org, an independent directory of cool sites, fun websites, creative web projects, and useful online tools built for the open web.",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
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

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

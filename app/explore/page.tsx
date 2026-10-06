import type { Metadata } from "next";
import HomePage from "@/components/home-page";

// The directory itself. The sites and every list of them moved off the homepage
// and onto this route, so the landing page can stay a landing page and the
// listings get a URL of their own to be linked, shared and crawled at.
//
// It is the same component as the homepage with `mode="explore"` — see
// components/home-page.tsx for why the two share one implementation. English
// only, like the other derived indexes (/tags, /recently-added): the
// translated homepages stay at /es, /fr and /pt and link here.

const siteUrl = "https://base31.org";

export const metadata: Metadata = {
  title: "Explore the Directory — Every Site, Tool and API on base31.org",
  description:
    "Browse every site in the base31.org directory: indie web projects, free browser tools, public APIs and AI picks. Search the whole list, filter it by tag, or sort by votes.",
  alternates: { canonical: "/explore" },
  openGraph: {
    type: "website",
    url: `${siteUrl}/explore`,
    siteName: "base31.org",
    locale: "en_US",
    title: "Explore the Directory — Every Site on base31.org",
    description: "Every site, tool, API and app in the base31.org directory, in one searchable list.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore the Directory — base31.org",
    description: "Every site in the base31.org directory, in one searchable list.",
  },
};

export default function ExplorePage() {
  return <HomePage mode="explore" />;
}

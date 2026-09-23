import Link from "next/link";

export const metadata = {
  title: "About base31.org — An Independent Website Directory",
  description: "Learn what base31.org is: an independent directory of cool sites, fun websites, creative web projects, and useful online tools.",
  alternates: { canonical: "/about" },
  // Without this the page would inherit the layout's openGraph, and og:url
  // would point at the homepage while the canonical says /about.
  openGraph: {
    type: "website",
    url: "https://base31.org/about",
    siteName: "base31.org",
    locale: "en_US",
    title: "About base31.org — An Independent Website Directory",
    description: "What base31.org is: an independent directory of cool sites, fun websites, creative web projects, and useful online tools.",
  },
  twitter: {
    card: "summary_large_image",
    title: "About base31.org",
    description: "An independent directory of cool sites, fun websites, and creative web projects.",
  },
};

export default function AboutPage() {
  return <main className="privacy-page about-page"><Link className="privacy-back mono" href="/">← base31.org</Link><p className="eyebrow mono">about base31.org</p><h1>A small home for the interesting internet.</h1><p className="privacy-updated">An independent directory for curious people.</p><section className="privacy-copy"><h2>What is base31?</h2><p>base31.org is a hand-built website directory for discovering cool sites, fun websites, creative web projects, personal pages, and useful online tools. It is intentionally small and human: instead of ranking the internet by engagement or advertising spend, the directory gives real projects a simple place to be found.</p><h2>Why another website directory?</h2><p>The web is full of inventive projects that do not fit neatly into an app store or a social feed. Independent makers, hobbyists, designers, and developers create games, experiments, tools, art, and communities every day. base31 exists to make those projects easier to explore without turning discovery into a noisy feed.</p><h2>How the directory works</h2><p>Each featured link leads to a live site or project. The directory can include static HTML sites, prebuilt React or other framework sites, and projects hosted on their own subdomains. New entries are added with a short description and a few useful tags so visitors can quickly understand what they will find.</p><h2>Built for the open web</h2><p>base31 favors direct links, readable pages, fast loading, and clear ownership. It is not affiliated with Base44 or any other website directory. It is simply an independent corner of the web for people who enjoy finding something new.</p><h2>Keep exploring</h2><p><Link href="/#sites">Browse the directory</Link> or <Link href="/terms">read the terms of service</Link> to learn more.</p></section></main>;
}

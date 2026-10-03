import Link from "next/link";

export const metadata = {
  title: "Our Story — Why base31.org Exists",
  description: "The story behind base31.org: an independent directory by Sawyer Schulz, built to give useful tools and creative corners of the web a place to be found.",
  alternates: { canonical: "/our-story" },
  openGraph: { type: "website", url: "https://base31.org/our-story", title: "Our Story — base31.org", description: "Making a little more room for the interesting internet.", siteName: "base31.org" },
  twitter: { card: "summary_large_image", title: "Our Story — base31.org", description: "Making a little more room for the interesting internet." },
};

export default function StoryPage() {
  return <main className="privacy-page story-page">
    <Link className="privacy-back mono" href="/">← base31.org</Link>
    <p className="eyebrow mono">our story</p>
    <h1>A directory, not another feed.</h1>
    <p className="privacy-updated">Built by Sawyer Schulz. Made for curious people.</p>
    <section className="privacy-copy">
      <h2>A small place to start</h2>
      <p>base31 is an independent project built around a simple idea: a useful tool or a wonderfully odd website deserves a direct link, a little context, and a chance to be discovered.</p>
      <p>The directory brings personal sites, browser tools, creative experiments, and other worthwhile corners of the web onto one page. You can browse, search, follow a link, and get on with exploring. There is no endless feed to catch up with.</p>
      <h2>Room for the little projects</h2>
      <p>Not every good idea needs to become a big platform. A small utility can solve one problem well. A playful experiment can make a visit worthwhile. base31 makes room for both, alongside the makers and independent sites that keep the web interesting.</p>
      <h2>Built in the open</h2>
      <p>The project’s <a href="https://github.com/NOTAM-bobk/base31" target="_blank" rel="noopener noreferrer">source is on GitHub</a>, and the <Link href="/whats-new">release notes</Link> record how it changes. The directory has grown to include tool guides, editorial picks, and a shared discussion space—not just more links, but more ways to understand and enjoy them.</p>
      <h2>The next chapter is shared</h2>
      <p>Found something worth passing on? <Link href="/#request-url">Suggest a URL</Link> for review. Have a question or a discovery? <Link href="/#discussion">Join the conversation</Link>. Voluntary <a href="https://donation.base31.org/">support</a> helps keep the project going, but you never need to contribute to browse.</p>
      <nav className="about-page-links" aria-label="Keep exploring"><Link href="/about">About Us →</Link><Link href="/#sites">Explore the directory →</Link></nav>
    </section>
  </main>;
}

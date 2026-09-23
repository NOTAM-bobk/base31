import Link from "next/link";

export const metadata = {
  title: "Terms of Service — base31.org",
  description: "Terms of service for using the base31.org website directory.",
  alternates: { canonical: "/terms" },
  // Otherwise the layout's openGraph leaks in and og:url points at the
  // homepage, disagreeing with the canonical above.
  openGraph: {
    type: "website",
    url: "https://base31.org/terms",
    siteName: "base31.org",
    locale: "en_US",
    title: "Terms of Service — base31.org",
    description: "Terms of service for using the base31.org website directory.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — base31.org",
    description: "Terms of service for using the base31.org website directory.",
  },
};

export default function TermsPage() {
  return <main className="privacy-page"><Link className="privacy-back mono" href="/">← base31.org</Link><p className="eyebrow mono">terms of service</p><h1>Simple terms for a simple directory.</h1><p className="privacy-updated">Last updated: September 17, 2026</p><section className="privacy-copy"><h2>Use of the site</h2><p>You may use base31.org to browse links and discover websites for lawful, personal, and informational purposes. Please follow the rules and policies of any linked site you visit.</p><h2>External websites</h2><p>Links in the directory lead to independent third-party projects. base31.org does not control, guarantee, or endorse every external site, and each project is responsible for its own content, availability, privacy practices, and terms.</p><h2>Availability</h2><p>The directory is provided as-is and may change, move, or be temporarily unavailable. Site listings may be updated or removed as projects evolve.</p><h2>Respect the web</h2><p>Do not use base31.org to abuse, disrupt, scrape, or attack the directory or linked projects. Automated access should be respectful and follow applicable policies.</p><h2>Questions</h2><p>For questions about these terms, start with the relevant project owner. You can also return to the <Link href="/about">about page</Link> to learn more about base31.</p></section></main>;
}

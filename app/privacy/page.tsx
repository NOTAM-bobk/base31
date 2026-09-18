import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — base31.org",
  description: "How base31.org handles the limited data used for site preferences and page views.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <Link className="privacy-back mono" href="/">← base31.org</Link>
      <p className="eyebrow mono">privacy policy</p>
      <h1>Privacy, without the noise.</h1>
      <p className="privacy-updated">Last updated: September 17, 2026</p>
      <section className="privacy-copy">
        <h2>What we collect</h2>
        <p>
          The base31 directory uses a small cookie-like preference stored in your browser to remember
          whether you accepted or denied the consent notice. We do not use that preference for
          advertising or profiling.
        </p>
        <h2>Page views</h2>
        <p>
          When the directory loads, it sends a page-view request to our Cloudflare Worker. The
          Worker stores an aggregate count in Cloudflare KV. The counter is not intended to identify
          you and does not store your name, email address, or browsing history.
        </p>
        <h2>Your choices</h2>
        <p>
          You can deny the optional preference at any time by clearing site data in your browser.
          The directory and its links remain usable if you deny consent.
        </p>
        <h2>Contact</h2>
        <p>
          For questions about this policy, contact the site owner through the contact method listed
          on the relevant project page.
        </p>
      </section>
    </main>
  );
}

import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — base31.org",
  description:
    "How base31.org handles preferences, page views, analytics, and the cookies used by its third-party ad partners.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <Link className="privacy-back mono" href="/">← base31.org</Link>
      <p className="eyebrow mono">privacy policy</p>
      <h1>Privacy, without the noise.</h1>
      <p className="privacy-updated">Last updated: September 22, 2026</p>
      <section className="privacy-copy">
        <h2>What we collect</h2>
        <p>
          The base31 directory stores a small cookie-like preference in your browser to remember
          whether you accepted or denied the consent notice. We do not sell that preference or use
          it to identify you.
        </p>

        <h2>Cookies and your choice</h2>
        <p>
          We only set our own preference after you choose. Selecting “Deny” leaves the directory
          fully usable and you can change your mind at any time by clearing site data in your
          browser.
        </p>
        <p>
          The directory is also supported by advertising, and ads are served by a third-party ad
          network. Those partners may set their own cookies or device identifiers to show and
          measure ads, and those cookies are not controlled by the preference you set here. Where
          the law requires it, you can manage or withdraw consent for interest-based advertising
          through your browser settings and the ad partner’s own tools.
        </p>

        <h2>Page views</h2>
        <p>
          When the directory loads, it sends a page-view request to our Cloudflare Worker. The
          Worker stores an aggregate count in Cloudflare KV. The counter is not intended to identify
          you and does not store your name, email address, or browsing history.
        </p>

        <h2>Analytics</h2>
        <p>
          We use Microsoft Clarity to understand how the directory is used — which pages are viewed
          and where visitors click — so we can improve it. Clarity may set cookies and record
          aggregated interaction data. See the{" "}
          <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noreferrer">
            Microsoft privacy statement
          </a>{" "}
          for details.
        </p>

        <h2>Advertising</h2>
        <p>
          base31.org is supported by ads served through Adsterra. Ad partners may use cookies,
          device identifiers, and similar technologies to display ads, measure their performance,
          and limit how often you see them. This data is collected by those partners under their own
          privacy policies, and we do not control it. See the{" "}
          <a href="https://adsterra.com/privacy-policy/" target="_blank" rel="noreferrer">
            Adsterra privacy policy
          </a>{" "}
          for details.
        </p>

        <h2>Links to other sites</h2>
        <p>
          The directory links to independent third-party projects. Once you follow a link, that
          site’s own privacy policy applies, and we are not responsible for how it handles your
          data.
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

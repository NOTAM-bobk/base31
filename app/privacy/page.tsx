import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — base31.org",
  description:
    "How base31.org handles preferences, page views, analytics, and the cookies used by its third-party ad partners.",
  alternates: { canonical: "/privacy" },
  // Otherwise the layout's openGraph leaks in and og:url points at the
  // homepage, disagreeing with the canonical above.
  openGraph: {
    type: "website",
    url: "https://base31.org/privacy",
    siteName: "base31.org",
    locale: "en_US",
    title: "Privacy Policy — base31.org",
    description:
      "How base31.org handles preferences, page views, analytics, and the cookies used by its third-party ad partners.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy — base31.org",
    description: "How base31.org handles preferences, analytics, and ad cookies.",
  },
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <Link className="privacy-back mono" href="/">← base31.org</Link>
      <p className="eyebrow mono">privacy policy</p>
      <h1>Privacy, without the noise.</h1>
      <p className="privacy-updated">Last updated: September 29, 2026</p>
      <section className="privacy-copy">
        <h2>What we collect</h2>
        <p>
          The base31 directory stores a small cookie-like preference in your browser to remember
          whether you accepted or denied the consent notice. We do not sell that preference or use
          it to identify you.
        </p>

        <h2>Cookies and your choice</h2>
        <p>
          We only set our own preference after you choose. Until then the Google tag loads with its
          storage switched off, so it writes no cookie and stores nothing that identifies you, and
          no session recording or advertising script runs at all; the directory works exactly the
          same either way.
        </p>
        <p>
          Choosing “Confirm” lets Google Analytics write its analytics cookies and lets Microsoft
          Clarity and our ad network load. Choosing “Deny” keeps analytics storage off, clears any
          Google Analytics cookies an earlier visit left behind, and leaves Clarity and the ad
          network unloaded — the only thing stored is the preference itself. You can change your
          answer whenever you like with the{" "}
          <strong>Cookie settings</strong> link in the footer, which brings the notice back so you
          can choose again.
        </p>

        <h2>Page views</h2>
        <p>
          When the directory loads, it sends a page-view request to our Cloudflare Worker. The
          Worker stores an aggregate count in Cloudflare KV. The counter is not intended to identify
          you and does not store your name, email address, or browsing history.
        </p>

        <h2>Email updates, browser alerts, and bug reports</h2>
        <p>
          If you subscribe to community-site updates, your email address is stored by our Cloudflare Worker
          until you unsubscribe. We send a confirmation message first; only confirmed subscribers receive
          publication notices, and each notice includes an unsubscribe link. If you enable browser alerts,
          this browser’s push subscription is stored so we can send an alert when a community site is
          published. You can turn alerts off from the same control in the directory. These features are
          optional and are separate from the cookie/analytics choice.
        </p>
        <p>
          Bug reports are sent to the site operator through Resend. The report includes the message, the
          page URL, and an email address only if you choose to provide one. Reports are retained in the
          email provider’s systems; an optional reply address is used only to respond to the report.
        </p>

        <h2>Analytics</h2>
        <p>
          The Google tag is part of every page so Google can confirm the property is installed. It
          runs with consent mode: storage is denied until you answer, so before you do no cookie is
          written and nothing that identifies you is stored. If you confirm the cookie notice we
          grant analytics storage and load Microsoft Clarity, so we can understand how the directory
          is used — which pages are viewed and where visitors click — and improve it. If you deny,
          analytics storage stays off, Google Analytics cookies from earlier visits are cleared, and
          Clarity is not loaded at all. Google Analytics reports traffic only in aggregate. See
          the{" "}
          <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noreferrer">
            Microsoft privacy statement
          </a>{" "}
          and the{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Google privacy policy
          </a>{" "}
          for details.
        </p>

        <h2>Advertising</h2>
        <p>
          base31.org is supported by ads served through Adcash. The Adcash auto-tag only loads after you
          confirm the cookie notice — deny it and no ad code, cookie, or tracking request from the
          ad network is added to the page at all.
        </p>
        <p>
          The sponsored cards in the referral carousel and the cards in the directory are ordinary links: they request nothing from
          a third party unless you click one. Each one shows a small preview image of where the
          link goes — a screenshot or the destination’s favicon, loaded directly from that site (or a
          screenshot service) so you can see what you are clicking. Those image requests are
          decorative and set no cookies; if you would rather not make them, blocking third-party
          images in your browser has no effect on anything else on the page. Once the ad script is
          running, the network may use cookies, device identifiers, and similar technologies to
          display ads, measure their performance, and limit how often you see them. That data is
          collected by those partners under their own privacy policies, and we do not control it.
          See the{" "}
          <a href="https://adcash.com/legal/" target="_blank" rel="noreferrer">
            Adcash legal and privacy information
          </a>{" "}
          for details.
        </p>

        <h2>Site icons</h2>
        <p>
          Every directory entry has a small favicon. The ones shipped with base31.org come from this
          site itself and cost no extra request. A site uploaded by a visitor has no icon of its
          own here, so its card asks that site for its favicon; if it does not have one, a generated
          placeholder is shown instead.
        </p>

        <h2>Links to other sites</h2>
        <p>
          The directory links to independent third-party projects. Once you follow a link, that
          site’s own privacy policy applies, and we are not responsible for how it handles your
          data.
        </p>

        <h2>Your choices</h2>
        <p>
          Use <strong>Cookie settings</strong> in the footer to change or withdraw your answer at
          any time; withdrawing it takes the Clarity and ad loaders back out, switches Google
          Analytics storage back to denied and clears its cookies, and all of it stays off until you
          confirm. Clearing site data in
          your browser also works. The directory and every link in it stay fully usable either way.
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

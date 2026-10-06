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
      <p className="privacy-updated">Last updated: October 1, 2026</p>
      <section className="privacy-copy">
        <h2>What we collect</h2>
        <p>
          The base31 directory stores a small cookie-like preference in your browser to remember
          whether you accepted or denied the consent notice. We do not sell that preference or use
          it to identify you.
        </p>

        <h2>Cookies and your choice</h2>
        <p>
          We only set our own preference after you choose. Two counters run on every visit — before
          you answer the notice and whatever you answer: the Google tag, because that is what lets
          Google confirm the property, and Umami, a cookieless page counter that sets no cookie and
          stores nothing on your device. Session recording and advertising stay switched off until
          you confirm, and the directory works exactly the same either way.
        </p>
        <p>
          Choosing “Confirm” allows Microsoft Clarity to record sessions and our ad network to load.
          Choosing “Deny” leaves both switched off — Google Analytics keeps counting the visit
          either way, as it also does before you answer — and the only thing stored is the
          preference itself. You can change your answer whenever you like with the{" "}
          <strong>Cookie settings</strong> link in the footer, which brings the notice back so you
          can choose again.
        </p>

        <h2>Page views</h2>
        <p>
          When the directory loads, it sends a page-view request to our Cloudflare Worker, which
          keeps aggregate counts in Cloudflare KV. Two numbers come out of it: total views, which
          counts every load, and unique visitors, which counts a person once. To tell them apart the
          Worker derives a one-way SHA-256 hash from the request&rsquo;s IP address and the
          browser&rsquo;s User-Agent string, writes that hash as a mark that expires after 400 days,
          and raises the unique total only the first time it sees it. The same hash also raises a
          separate per-day count the first time you are seen on that day, which is what the daily
          graph of people on our stats page is drawn from; it is another aggregate number, not a
          per-visitor record that could be read back. The raw address and browser string are never
          written to storage, and the hash cannot be turned back into either. The counter is not
          intended to identify you and does not store your name, email address, or browsing
          history.
        </p>

        <h2>Community discussion</h2>
        <p>
          Discussion messages, display names, reply relationships and posting times are public and stored
          in Cloudflare Durable Objects until removed by the operator. Do not post private information.
          Names are chosen by visitors, not verified accounts. Your browser saves your display name locally;
          drafts are kept only in the current page and are lost when it closes or reloads.
        </p>
        <p>
          To limit spam, the Worker derives a daily SHA-256 hash from the connecting IP address and date.
          It stores this rate-limit signal with posting counts and times, not the raw IP. These signals
          are cleaned up after 24 hours on a subsequent post; hashing is not a guarantee of anonymity.
          Shared networks may share posting limits. Contact <a href="mailto:hello@base31.org">hello@base31.org</a>
          {" "}with the message details to request removal or report abuse. Messages are not automatically moderated.
        </p>

        <h2>Email updates, browser alerts, and bug reports</h2>
        <p>
          If you subscribe to community-site updates, your email address is stored by our Cloudflare Worker
          until you unsubscribe. Signing up adds you to the active list immediately, without a confirmation
          email. Your email is visible only to the operator through the protected community inbox.
          Publication notices include an unsubscribe link. If you enable browser alerts,
          this browser’s push subscription is stored so we can send an alert when a community site is
          published. You can turn alerts off from the same control in the directory. These features are
          optional and are separate from the cookie/analytics choice.
        </p>
        <p>
          If you request a URL for the directory, we store the URL, your description, and any optional email
          address you provide so the site operator can review the suggestion. Suggestions are not published
          automatically.
        </p>
        <p>
          Bug reports and feature ideas are stored by our Cloudflare Worker and shown in the site operator’s
          private moderation inbox, next to the URL suggestions. A report includes the message, the page URL,
          and an email address only if you choose to provide one; no email provider is involved, and an
          optional reply address is used only to respond to the report.
        </p>

        <h2>Analytics</h2>
        <p>
          The Google tag is part of every page and runs on every visit, so Google can see that the
          property is installed and we can see which pages are viewed and where visitors click —
          whether you confirm the cookie notice or deny it. Umami also counts page views on every
          visit, and it is cookieless: no cookie, no identifier kept for you, nothing stored on your
          device. Google Analytics and Umami both report traffic in aggregate. If you confirm,
          Microsoft Clarity also
          records sessions, which shows how a visit actually unfolded. If you deny, Clarity is not
          loaded at all. See
          the{" "}
          <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noreferrer">
            Microsoft privacy statement
          </a>{" "}
          and the{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Google privacy policy
          </a>{" "}
          and the{" "}
          <a href="https://umami.is/privacy" target="_blank" rel="noreferrer">
            Umami privacy policy
          </a>{" "}
          for details.
        </p>

        <h2>Advertising</h2>
        <p>
          base31.org is supported by ads from three networks: Adcash, whose auto-tag runs on the
          directory; Adsterra, whose 160x300 banner fills the Support section as well as the same
          slot on compmails.base31.org; and the profitable-rate CPM network, whose unit sits beside
          that banner. All three follow one rule — no ad code, cookie, or tracking request is added
          to the page until you confirm the cookie notice. Deny it and nothing is fetched from any
          of them. Withdrawing your choice afterwards takes the script back out along with the frame
          it had built.
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
          and the{" "}
          <a href="https://adsterra.com/privacy-policy/" target="_blank" rel="noreferrer">
            Adsterra privacy policy
          </a>{" "}
          and the{" "}
          <a href="https://www.profitableratecpmnetwork.com/" target="_blank" rel="noreferrer">
            profitable-rate CPM network
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

        <h2>Community discussion avatars</h2>
        <p>
          Each message in the community discussion shows a small avatar. It is generated by the
          DiceBear API from the display name you typed, so the same name always draws the same
          picture and no image is stored here. Your browser requests that image from{" "}
          <a href="https://www.dicebear.com/" target="_blank" rel="noreferrer">
            dicebear.com
          </a>
          , which means the display name travels to their servers in the image URL. The avatar is
          decorative and the message header names the author; blocking third-party images simply
          leaves the avatar space blank. Names in the discussion are public and are not verified
          identities.
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
          any time; withdrawing it takes the Clarity and ad loaders back out and they stay off until
          you confirm, while Google Analytics keeps counting visits as described above. Clearing site
          data in your browser also works. The directory and every link in it stay fully usable
          either way.
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

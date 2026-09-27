import Link from "next/link";

const siteUrl = "https://base31.org";
const email = "hello@base31.org";
const mailto = `mailto:${email}?subject=Sponsorship%20on%20base31.org`;

export const metadata = {
  title: "Sponsor base31.org — Put Your Link in Front of Curious People",
  description:
    "Sponsor base31.org: a labelled card in the referral carousel or the support button slot. Reach people who like finding tools on the open web. Email hello@base31.org.",
  alternates: { canonical: "/sponsor" },
  // Setting openGraph replaces the layout's object rather than merging it, so it
  // repeats siteName, locale and a page-accurate url.
  openGraph: {
    type: "website",
    url: `${siteUrl}/sponsor`,
    siteName: "base31.org",
    locale: "en_US",
    title: "Sponsor base31.org — Put Your Link in Front of Curious People",
    description:
      "A labelled referral card or the support button slot on base31.org. Every placement is marked as sponsored, and there is nothing to track.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsor base31.org",
    description: "Put your referral link or ad in front of people who like finding tools on the open web.",
  },
};

const placements = [
  {
    name: "Referral carousel card",
    where: "Homepage, inside the Support section",
    what: "Your name, one sentence, and a picture — a live screenshot of your site, or an image you supply. Rotates with the other cards and opens in a new tab.",
    best: "Best for a product or service an audience of tinkerers would actually try.",
  },
  {
    name: "The support button",
    where: "Foot of the Support section, under the carousel",
    what: "A single labelled button with one line of copy. The most direct slot on the page, and the one that stays in view when the carousel advances.",
    best: "Best for one specific action: a signup, a download, a free tier.",
  },
];

const steps = [
  "Email hello@base31.org with your name, your URL, one sentence describing it, and which slot you want.",
  "Include an image if you have one. Otherwise the card shows a live screenshot of your page, which is usually enough.",
  "We reply with the price and the next available slot. Nothing goes live until you say yes.",
  "Once it is up, the card is labelled as sponsored and joins the rotation. Ask any time to change the copy or to stop.",
];

const rules = [
  "Every placement is labelled. The carousel is headed “ad”, the cards carry a sponsored label, and links use rel=\"sponsored\".",
  "Relevant to this audience: developer tools, hosting, indie projects, design, games, learning, or something genuinely useful.",
  "No adult content, gambling, malware, fake downloads, or anything that misrepresents what happens after the click.",
  "No tracking pixels and no third-party scripts in a placement — that would break the promise the privacy page makes.",
  "A placement can be pulled if it stops being honest, without a refund for the remaining time.",
];

const faqs = [
  {
    q: "Does paying get my site into the directory?",
    a: "No. Directory entries are free: anyone can publish a small static site through the upload form on the homepage, and hand-picked entries are added on their own merits. Sponsorship buys a labelled card in the referral carousel or the support button slot, and never a place in the list or a review.",
  },
  {
    q: "Can I see how many clicks I got?",
    a: "base31 does not track clicks or visitors individually, so there is no per-placement report to hand over. The site does publish its own visitor numbers on the stats page, which is a fair guide to the traffic a placement joins.",
  },
  {
    q: "How much does a placement cost?",
    a: "It depends on the slot and how long you want it, so the price comes with the reply rather than from a rate card. Ask, and you will get a number and what it covers.",
  },
  {
    q: "Can I just support the project instead?",
    a: "Yes, and plenty of people do. The donation page takes a one-off contribution with no card in return, which keeps the directory running without putting anything in front of a visitor.",
  },
];

export default function SponsorPage() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/sponsor#page`,
        url: `${siteUrl}/sponsor`,
        name: "Sponsor base31.org — Put Your Link in Front of Curious People",
        description:
          "How sponsorship works on base31.org: a labelled card in the referral carousel or the support button slot, arranged by email.",
        inLanguage: "en-US",
        isPartOf: { "@id": `${siteUrl}/#website` },
        breadcrumb: { "@id": `${siteUrl}/sponsor#breadcrumb` },
      },
      {
        "@type": "Service",
        "@id": `${siteUrl}/sponsor#service`,
        name: "Sponsored placements on base31.org",
        serviceType: "Sponsored placement",
        description:
          "Labelled sponsored placements on base31.org: a card in the referral carousel or the support button slot on the homepage.",
        provider: { "@id": `${siteUrl}/#organization` },
        areaServed: { "@type": "Place", name: "Worldwide" },
        availableChannel: {
          "@type": "ServiceChannel",
          serviceUrl: mailto,
          availableLanguage: "en",
        },
        isPartOf: { "@id": `${siteUrl}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/sponsor#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "base31.org", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Sponsor", item: `${siteUrl}/sponsor` },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/sponsor#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
    ],
  };

  return (
    <main className="privacy-page sponsor-page">
      <Link className="privacy-back mono" href="/">← base31.org</Link>
      <p className="eyebrow mono">sponsor</p>
      <h1>Put your link in front of curious people.</h1>
      <p className="privacy-updated">
        base31.org is a small directory of tools, experiments, and personal projects. Sponsorship is how the hosting gets paid for — and
        every placement is labelled, because a directory that hides its ads is not worth reading.
      </p>

      <a className="sponsor-cta" href={mailto}>
        <span className="sponsor-cta-icon mono" aria-hidden="true">✉</span>
        <span className="sponsor-cta-text">
          <strong>Email {email}</strong>
          <span>Tell us what you want to promote and we will send the price and the next slot.</span>
        </span>
        <span className="sponsor-cta-arrow mono" aria-hidden="true">↗</span>
      </a>

      <section className="sponsor-section" aria-labelledby="placements-heading">
        <h2 id="placements-heading">Two places to be seen</h2>
        <ul className="sponsor-options">
          {placements.map((placement) => (
            <li key={placement.name} className="sponsor-option">
              <h3>{placement.name}</h3>
              <p className="sponsor-option-where mono">{placement.where}</p>
              <p>{placement.what}</p>
              <p className="sponsor-option-best">{placement.best}</p>
            </li>
          ))}
        </ul>
        <p className="sponsor-note">
          Directory listings are separate and always free — publishing a small static site through the upload form costs nothing, and paying
          does not move you up the list.
        </p>
      </section>

      <section className="sponsor-section" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <ol className="sponsor-steps">
          {steps.map((step) => (
            <li key={step.slice(0, 32)}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="sponsor-section" aria-labelledby="rules-heading">
        <h2 id="rules-heading">The house rules</h2>
        <ul className="sponsor-list">
          {rules.map((rule) => (
            <li key={rule.slice(0, 32)}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className="sponsor-section" aria-labelledby="sponsor-faq-heading">
        <h2 id="sponsor-faq-heading">Questions</h2>
        <ul className="sponsor-faqs">
          {faqs.map((faq) => (
            <li key={faq.q}>
              <details>
                <summary>
                  <span>{faq.q}</span>
                  <span className="sponsor-faq-chevron mono" aria-hidden="true">+</span>
                </summary>
                <p>{faq.a}</p>
              </details>
            </li>
          ))}
        </ul>
        <p className="sponsor-note">
          A few things worth reading first: <Link href="/stats">the visitor numbers</Link> for a sense of the audience,{" "}
          <Link href="/privacy">the privacy page</Link> for how ads and cookies are handled, and{" "}
          {/* The donation page is its own subdomain site, not an apex route. */}
          <a href="https://donation.base31.org">the donation page</a> if you would rather just help pay for the hosting.
        </p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
    </main>
  );
}

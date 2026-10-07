const FAQS = [
  {
    question: "What is base31.org?",
    answer:
      "base31.org is an independent directory of cool sites, fun websites, creative web projects and useful online tools. Every entry is a real, working site you can open right now — no store listings and no dead links.",
  },
  {
    question: "How are the sites in the directory chosen?",
    answer:
      "By hand. Each site is opened and checked, then given a short description and a few tags. Community submissions go through the same bar: the site has to have something to look at or something you can use.",
  },
  {
    question: "Can I add my own website to base31.org?",
    answer:
      "Yes. Use the “Add your own site” card at the end of the directory, upload your HTML, CSS and JavaScript files, and set a title, description and tags. It is hosted for free, it appears in the directory, and other visitors can vote on it.",
  },
  {
    question: "How are the sites ranked?",
    answer:
      "Sites you heart are pinned to the top of the list for you. Everything else sorts by how liked it is — thumbs up minus thumbs down — with the most-liked sites first and sites that have no votes yet falling back to alphabetical order.",
  },
  {
    question: "Is base31.org free to use?",
    answer:
      "Browsing is free and there is no account to create. The directory is kept online by donations and by occasional sponsored or referral links, which are always labelled as ads.",
  },
  {
    question: "Does base31.org use cookies?",
    answer:
      "Only for analytics and advertising, and only in the ways described in our privacy policy. You can deny or confirm them in the cookie banner, and your choice is remembered in your own browser.",
  },
  {
    question: "Where can I find the useless web?",
    answer:
      "The useless web is the corner of the internet made of sites with no purpose at all: a button that sends you somewhere pointless, a page that only wobbles, a generator that makes nothing in particular. The best-known one is The Useless Web at theuselessweb.com, which drops you on a random useless site every time you press it. base31.org keeps its own hand-checked selection of them, sitting beside the useful things in the cool sites collection — the fun, toy, game and random picks.",
  },
  {
    question: "What are the best useless websites to waste time on?",
    answer:
      "The fun, random and toy picks in the cool sites collection, plus the page for the fun tag, are the directory's own answer to the useless web: random-site buttons, novelty generators, one-button toys and pages that exist for no reason other than the joke. base31.org itself is a hand-checked directory rather than a random-site generator, but the gloriously pointless end of the web is one of the things it keeps a list of — and every useless website in it was opened and described by hand.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://base31.org/#faq",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

/** The FAQ block that sits directly above the footer. Each question is a
 *  native <details>/<summary> disclosure: it opens and closes with no
 *  JavaScript, it is keyboard and screen-reader operable on its own, and the
 *  answer text stays in the served HTML — so the copy is still crawlable
 *  (and repeated in the FAQPage structured data below) even though every
 *  item starts collapsed.
 *
 *  Two of the questions answer the useless web on purpose: "the useless web"
 *  is a search people really make, and the directory really does keep a
 *  hand-checked list of it. The block under the questions says the same
 *  thing again in the words those searches use. It is `.sr-only` — hidden
 *  from sight, still read aloud and still in the served HTML — so the page
 *  answers the question for a reader who cannot see the list and for a
 *  crawler that cannot open a `<details>`. Nothing in it is a claim the
 *  directory does not already make on screen. */
export default function Faq() {
  return (
    <section className="faq-section" data-reveal aria-labelledby="faq-heading">
      <p className="eyebrow mono">questions</p>
      <h2 id="faq-heading">Frequently asked questions</h2>
      <div className="faq-list">
        {FAQS.map((item) => (
          <details className="faq-item" key={item.question}>
            <summary className="faq-question">
              <span>{item.question}</span>
              <svg
                className="faq-chevron"
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="faq-answer">{item.answer}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      {/* Visually hidden, read aloud by a screen reader, and in the served
          HTML for a crawler. These are the same answers as the questions
          above, spelled out in the plain sentences people actually search
          with — "the useless web", "random useless websites", "websites that
          are useless but fun" — so someone hunting the useless web lands
          here rather than nowhere. Every line names something the directory
          really has, which is the only reason it is worth printing. */}
      <div className="sr-only">
        <h3>The useless web, useless websites and other pointless pages</h3>
        <ul>
          <li>
            Where to find the useless web: base31.org collects useless websites, random-site buttons, novelty
            generators and other websites that are useless but fun, one entry per site, at
            https://base31.org/#cool-sites.
          </li>
          <li>
            The best-known useless website is The Useless Web at https://theuselessweb.com — press the button and it
            sends you to a random pointless site. It is listed in this directory.
          </li>
          <li>
            Random useless websites to waste time on: the cool sites collection at https://base31.org/#cool-sites holds
            the fun, toy, game and random picks from this directory, each one opened and checked by hand.
          </li>
          <li>
            Fun useless websites to waste time on, listed by tag: https://base31.org/tags/fun is every base31.org entry
            filed under the tag fun, with the count for each.
          </li>
          <li>
            Websites that are useless but fun sit beside the useful web here: the same directory also lists free
            browser tools, free public APIs, cool apps and AI assistants, so nothing pointless is hidden away in a
            separate corner.
          </li>
          <li>
            A useless-web list with a date on every entry: https://base31.org/recently-added shows the newest additions
            and https://base31.org/quality-report shows when each listed site was last checked.
          </li>
          <li>
            Useless web alternatives: base31.org is not a random-site button, but its useless-website picks are
            hand-checked, described and tagged, so the collection can be browsed deliberately instead of clicked at
            random.
          </li>
          <li>
            Search base31.org for useless websites directly at https://base31.org/explore, or see the whole directory
            drawn as one web at https://base31.org/#site-web.
          </li>
        </ul>
      </div>
    </section>
  );
}

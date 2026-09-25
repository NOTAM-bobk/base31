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
 *  item starts collapsed. */
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
    </section>
  );
}

// The homepage's Trustpilot review collector. The TrustBox bootstrap script
// lives in app/layout.tsx; it renders the hosted widget into this placeholder,
// and the link inside it is the no-JS fallback. A static five-star row sits
// above the collector so the rating reads at a glance before the hosted widget
// finishes loading, and the card carries the animated rainbow ring (styled in
// app/overrides.css).
export default function TrustpilotReviews() {
  return (
    <section className="trustpilot-section" data-reveal aria-labelledby="trustpilot-heading">
      <p className="eyebrow mono">reviews</p>
      <h2 id="trustpilot-heading">Enjoying base31?</h2>
      <p className="trustpilot-lede">Tell other curious people what you found. Reviews are collected by Trustpilot.</p>
      <div className="trustpilot-stars" role="img" aria-label="Rated 5 out of 5 stars">
        {[0, 1, 2, 3, 4].map((star) => (
          <svg key={star} viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.4l-5.8 3.06 1.11-6.46-4.7-4.58 6.49-.94z" />
          </svg>
        ))}
      </div>
      <div
        className="trustpilot-widget"
        data-locale="en-US"
        data-template-id="56278e9abfbbba0bdcd568bc"
        data-businessunit-id="6ab71f7b09356411d7a0b67f"
        data-style-height="52px"
        data-style-width="100%"
        data-token="922794cb-0a34-48a9-9ed1-9b845648dce8"
      >
        <a href="https://www.trustpilot.com/review/base31.org" target="_blank" rel="noopener noreferrer">Trustpilot</a>
      </div>
    </section>
  );
}

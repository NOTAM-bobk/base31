// The homepage's "about the directory" prose. It is static copy, so it lives
// in its own component to keep app/page.tsx a readable list of sections (and
// to stay clear of the page file's generous editing window).
export default function AboutSection() {
  return (
    <section id="about" className="about-section" data-reveal aria-labelledby="about-heading">
      <div className="about-heading-row">
        <div>
          <p className="eyebrow mono">about the directory</p>
          <h2 id="about-heading">A small home for the interesting internet.</h2>
        </div>
        {/* Decorative, like the header and footer sparkles: it carries no
            information, so it is hidden from assistive tech, skipped under
            prefers-reduced-motion, and served from public/ so the page keeps
            one origin. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="about-sparkle" src="/about-sparkle.gif" alt="" width={56} height={56} aria-hidden="true" />
      </div>
      <p>base31.org is an independent collection of personal sites, experiments, tools, and other projects worth exploring. It is a hand-built alternative to noisy app lists: every link leads to a real project with something to see or use.</p>
      <p>Looking for Base44? base31 is a separate, independent project and is not affiliated with Base44. Start here for a different kind of website directory: slower, stranger, and made for curious people.</p>
      <nav className="about-page-links" aria-label="Meet base31">
        <a href="/about" className="about-page-card">
          <span className="about-page-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
          </span>
          <span className="about-page-text">
            <span className="about-page-label">About Us</span>
            <span className="about-page-sub">Who runs base31 and why</span>
          </span>
          <span className="about-page-arrow" aria-hidden="true">→</span>
        </a>
        <a href="/our-story" className="about-page-card is-story">
          <span className="about-page-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></svg>
          </span>
          <span className="about-page-text">
            <span className="about-page-label">Our Story</span>
            <span className="about-page-sub">How the directory began</span>
          </span>
          <span className="about-page-arrow" aria-hidden="true">→</span>
        </a>
      </nav>
    </section>
  );
}

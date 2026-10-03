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
        <a href="/about">About Us <span aria-hidden="true">→</span></a>
        <a href="/our-story">Our Story <span aria-hidden="true">→</span></a>
      </nav>
      <div className="topic-links">
        <a href="#sites">Cool sites</a>
        <a href="#sites">Fun websites</a>
        <a href="#sites">Creative web projects</a>
        <a href="#sites">Useful online tools</a>
      </div>
      <p className="about-sparkle-credit mono">
        sparkle gif from{" "}
        <a href="https://www.glitter-graphics.com" target="_blank" rel="noreferrer">glitter-graphics.com</a>
      </p>
    </section>
  );
}

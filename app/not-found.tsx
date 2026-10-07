import StandaloneHeader from "@/components/standalone-header";

/**
 * The 404. It wears the site's own masthead — the same bar every other page
 * has — so a visitor who lands on a dead link still has the wordmark, the
 * navigation and the theme toggle in front of them instead of a bare page with
 * two ways out. The bar is the shared `StandaloneHeader`, not a copy of it, so
 * the two can never drift. `has-header` takes the header's height out of the
 * centred column, which keeps the message optically in the middle of what is
 * left rather than pushed down the window.
 */
export default function NotFound() {
  return (
    <>
      <StandaloneHeader />
      <main className="page-state has-header" role="status">
        <div className="page-state-mark mono" aria-hidden="true">31</div>
        <p className="eyebrow mono">404 · page not found</p>
        <h1>This corner of the web is missing.</h1>
        <p className="page-state-copy">The link may have moved, or it may never have existed.</p>
        <div className="page-state-actions">
          <a className="primary" href="/">Browse the directory</a>
          <a href="/blog">Read the blog</a>
        </div>
      </main>
    </>
  );
}

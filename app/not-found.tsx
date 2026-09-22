export default function NotFound() {
  return (
    <main className="page-state" role="status">
      <div className="page-state-mark mono" aria-hidden="true">31</div>
      <p className="eyebrow mono">404 · page not found</p>
      <h1>This corner of the web is missing.</h1>
      <p className="page-state-copy">The link may have moved, or it may never have existed.</p>
      <div className="page-state-actions">
        <a className="primary" href="/">Browse the directory</a>
        <a href="/blog">Read the blog</a>
      </div>
    </main>
  );
}

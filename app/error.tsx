"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("base31.org route error", error);
  }, [error]);

  return (
    <main className="page-state" role="alert">
      <div className="page-state-mark mono" aria-hidden="true">31</div>
      <p className="eyebrow mono">something went wrong</p>
      <h1>That page could not load.</h1>
      <p className="page-state-copy">Try again, or return to the directory and keep exploring.</p>
      <div className="page-state-actions">
        <button type="button" className="primary" onClick={reset}>Try again</button>
        <a href="/">Back to base31.org</a>
      </div>
    </main>
  );
}

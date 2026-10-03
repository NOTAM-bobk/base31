"use client";

import { useState, type FormEvent } from "react";

export default function UrlSubmission() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setStatus(""); setFailed(false);
    try {
      const response = await fetch("/api/bug-report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "url", url: values.get("url"), message: values.get("message"), email: values.get("email"), website: values.get("website"), page: window.location.href }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not send your suggestion. Please try again.");
      form.reset(); setStatus("Thanks! Your URL has been sent for review.");
    } catch (error) {
      setFailed(true); setStatus(error instanceof Error ? error.message : "Could not send your suggestion.");
    } finally { setBusy(false); }
  }

  return <section id="submit-url" className="url-submission" aria-labelledby="submit-url-heading">
    <div className="url-submission-copy">
      <span className="url-submission-mark mono" aria-hidden="true">↗</span>
      <p className="eyebrow mono">good finds deserve company</p>
      <h2 id="submit-url-heading">Found a keeper?<br /> Pass it on.</h2>
      <p>A tiny tool, a useful app, a wonderfully odd website. Send us a link you think belongs here.</p>
      <span className="url-submission-note mono">Hand-picked, not auto-published.</span>
    </div>
    <form onSubmit={submit} className="url-submission-form">
      <label htmlFor="suggest-url">Submit a URL</label>
      <input id="suggest-url" name="url" type="url" required maxLength={2048} placeholder="https://your-favorite-find.com" />
      <label htmlFor="suggest-message">What makes it worth a visit?</label>
      <textarea id="suggest-message" name="message" required minLength={10} maxLength={4000} rows={3} placeholder="Tell us what you love about it…" />
      <label htmlFor="suggest-email">Your email <span>(optional)</span></label>
      <input id="suggest-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="Only if you’d like a reply" />
      <label className="report-honeypot" aria-hidden="true">Leave blank<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <button className="url-submit-button" type="submit" disabled={busy}>{busy ? "Sending…" : "Send a discovery ↗"}</button>
      <p className="url-submission-privacy">Suggestions go to the site operator for review. <a href="/privacy">Privacy</a></p>
      {status && <p className={failed ? "discussion-error" : "discussion-notice"} role={failed ? "alert" : "status"}>{status}</p>}
    </form>
  </section>;
}

"use client";

import { useState, type FormEvent } from "react";

const counterUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");

export default function UrlRequest() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setStatus(""); setFailed(false);
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch(`${counterUrl}/request-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: values.get("request-url"), title: values.get("request-title"), note: values.get("request-note"), email: values.get("request-email") }),
        signal: AbortSignal.timeout(12000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not send that suggestion right now.");
      form.reset(); setStatus("Thanks — your suggestion is in the queue.");
    } catch (error) {
      setFailed(true); setStatus(error instanceof Error ? error.message : "Could not send that suggestion right now.");
    } finally { setBusy(false); }
  };

  return <section className="url-submission" id="request-url" aria-labelledby="request-url-heading">
    <div className="url-submission-copy">
      <h2 id="request-url-heading">Found a keeper? Pass it on.</h2>
      <p>A tiny tool, a useful app, a wonderfully odd website. Send us a link you think belongs here.</p>
    </div>
    <form className="url-submission-form" onSubmit={submit}>
      <label htmlFor="request-website">Submit a URL</label><input id="request-website" name="request-url" type="url" required maxLength={2048} placeholder="https://your-favorite-find.com" />
      <div className="url-submission-row">
        <div><label htmlFor="request-title">Site name</label><input id="request-title" name="request-title" required maxLength={100} placeholder="What should we call it?" /></div>
        <div><label htmlFor="request-email">Your email <span>(optional)</span></label><input id="request-email" name="request-email" type="email" maxLength={254} autoComplete="email" placeholder="For a reply" /></div>
      </div>
      <label htmlFor="request-note">What makes it worth a visit?</label><textarea id="request-note" name="request-note" maxLength={500} rows={2} placeholder="Tell us what you love about it…" />
      <button className="url-submit-button" type="submit" disabled={busy}>{busy ? "Sending…" : "Send a discovery ↗"}</button>
      <p className="url-submission-privacy">Suggestions go to the private moderation inbox. <a href="/privacy">Privacy</a></p>
      {status && <p className={failed ? "discussion-error" : "discussion-notice"} role={failed ? "alert" : "status"}>{status}</p>}
    </form>
  </section>;
}

"use client";

import { useState, type FormEvent } from "react";

const counterUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");

export default function UrlRequest() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch(`${counterUrl}/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: values.get("request-url"),
          title: values.get("request-title"),
          note: values.get("request-note"),
          email: values.get("request-email"),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not send that suggestion right now.");
      form.reset();
      setStatus("Thanks — your suggestion is in the queue.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send that suggestion right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="url-request-panel" id="request-url" data-reveal aria-labelledby="request-url-heading">
      <p className="eyebrow mono">know a good corner of the web?</p>
      <h2 id="request-url-heading">Suggest a site for base31.</h2>
      <p className="url-request-lede">Send us a URL and a quick note. Suggestions go to the private moderation queue; they are not published automatically.</p>
      <form className="submit-form url-request-form" onSubmit={submit}>
        <label className="submit-field"><span>Website URL</span><input name="request-url" type="url" required maxLength={2048} placeholder="https://example.com" /></label>
        <label className="submit-field"><span>Site name</span><input name="request-title" required maxLength={100} placeholder="What should we call it?" /></label>
        <label className="submit-field"><span>Why is it worth adding?</span><textarea name="request-note" maxLength={500} rows={3} placeholder="A sentence or two is plenty." /></label>
        <label className="submit-field"><span>Your email <small>(optional)</small></span><input name="request-email" type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
        <button className="community-action is-primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Request this URL"}</button>
      </form>
      {status && <p className="community-status" role="status">{status}</p>}
    </section>
  );
}

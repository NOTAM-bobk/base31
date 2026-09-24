"use client";

import { useEffect, useState, type FormEvent } from "react";

const counterUrl = process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev";

const decodeVapidKey = (key: string) => {
  const padded = key.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(key.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
};

export default function DirectoryNotifications() {
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportStatus, setReportStatus] = useState("");

  useEffect(() => {
    const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setPushSupported(supported);
    if (!supported) return;
    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setPushEnabled(!!subscription);
    }).catch(() => setPushStatus("Browser notifications could not be prepared here."));
  }, []);

  const subscribeEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailBusy(true);
    setEmailStatus("");
    try {
      const response = await fetch(`${counterUrl}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not subscribe right now.");
      setEmailStatus(result?.alreadySubscribed ? "That address is already on the list." : "Check your inbox to confirm your subscription.");
    } catch (error) {
      setEmailStatus(error instanceof Error ? error.message : "Could not subscribe right now.");
    } finally {
      setEmailBusy(false);
    }
  };

  const togglePush = async () => {
    if (!pushSupported || pushBusy) return;
    setPushBusy(true);
    setPushStatus("");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const response = await fetch(`${counterUrl}/push/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        if (!response.ok) throw new Error("Could not turn notifications off. Please try again.");
        await existing.unsubscribe();
        setPushEnabled(false);
        setPushStatus("Browser notifications are turned off.");
        return;
      }

      if (Notification.permission === "denied") {
        throw new Error("Notifications are blocked in your browser settings.");
      }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");

      const keyResponse = await fetch(`${counterUrl}/push/public-key`);
      const keyData = await keyResponse.json().catch(() => null);
      if (!keyResponse.ok || typeof keyData?.publicKey !== "string") {
        throw new Error(keyData?.error || "Browser notifications are not configured yet.");
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(keyData.publicKey),
      });
      const saveResponse = await fetch(`${counterUrl}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!saveResponse.ok) {
        await subscription.unsubscribe();
        const result = await saveResponse.json().catch(() => null);
        throw new Error(result?.error || "Could not save this browser subscription.");
      }
      setPushEnabled(true);
      setPushStatus("You’ll get a browser alert when a community site goes live.");
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : "Could not update browser notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const sendBugReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportBusy(true);
    setReportStatus("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.get("report-email"),
          message: values.get("report-message"),
          page: window.location.href,
          website: values.get("website"),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not send the report right now.");
      form.reset();
      setReportStatus("Thanks — your report has been sent.");
    } catch (error) {
      setReportStatus(error instanceof Error ? error.message : "Could not send the report right now.");
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <section className="community-panel" id="updates" data-reveal aria-labelledby="updates-heading">
      <p className="eyebrow mono">stay in the loop</p>
      <h2 id="updates-heading">A new corner of the web, straight to you.</h2>
      <p className="community-panel-lede">Get one email when a community-built site is published. You can also opt into browser alerts on this device.</p>

      <form className="community-email-form" onSubmit={subscribeEmail}>
        <label className="sr-only" htmlFor="updates-email">Email address</label>
        <input id="updates-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <button className="community-action is-primary" type="submit" disabled={emailBusy}>{emailBusy ? "Sending…" : "Get site updates"}</button>
      </form>
      <p className="community-privacy-note">We’ll send a confirmation link first. No cookie tracking, and every update email includes an unsubscribe link.</p>
      {emailStatus && <p className="community-status" role="status">{emailStatus}</p>}

      <div className="push-opt-in">
        <div>
          <strong>Browser notifications</strong>
          <p>{pushSupported ? "Optional alerts on this device when a community site is published." : "This browser does not support web push notifications."}</p>
        </div>
        <button className="community-action" type="button" onClick={togglePush} disabled={!pushSupported || pushBusy}>
          {pushBusy ? "Updating…" : pushEnabled ? "Turn off" : "Enable alerts"}
        </button>
      </div>
      {pushStatus && <p className="community-status" role="status">{pushStatus}</p>}

      <details className="bug-report-details">
        <summary>Found a bug? Send a report</summary>
        <form className="submit-form bug-report-form" onSubmit={sendBugReport}>
          <label className="submit-field">
            <span>Your email <small>(optional, if you’d like a reply)</small></span>
            <input name="report-email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" />
          </label>
          <label className="submit-field">
            <span>What went wrong?</span>
            <textarea name="report-message" required minLength={10} maxLength={4000} rows={4} placeholder="What did you expect, and what happened instead?" />
          </label>
          <label className="report-honeypot" aria-hidden="true">
            <span>Leave this field blank</span>
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <div className="bug-report-submit">
            <button className="community-action is-primary" type="submit" disabled={reportBusy}>{reportBusy ? "Sending…" : "Send bug report"}</button>
            {reportStatus && <p className="community-status" role="status">{reportStatus}</p>}
          </div>
        </form>
      </details>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function PrivacyConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!window.localStorage.getItem("base31-consent"));
    } catch {
      setVisible(true);
    }
  }, []);

  const choose = (value: "accepted" | "denied") => {
    try {
      window.localStorage.setItem("base31-consent", value);
    } catch {
      // Continue even when storage is unavailable.
    }
    window.dispatchEvent(new Event("base31-consent-change"));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="cookie-consent" aria-label="Cookie consent">
      <div className="cookie-inner">
        <p>Analytics and our ad partners use cookies to measure visits and remember your choice. <a href="/privacy">Privacy policy</a>.</p>
        <div className="cookie-actions">
          <button type="button" className="cookie-button cookie-deny" onClick={() => choose("denied")}>Deny</button>
          <button type="button" className="cookie-button cookie-confirm" onClick={() => choose("accepted")}>Confirm</button>
        </div>
      </div>
    </aside>
  );
}

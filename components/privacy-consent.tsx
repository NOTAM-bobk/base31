"use client";

import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent, writeConsent } from "@/lib/consent";

export default function PrivacyConsent() {
  const [visible, setVisible] = useState(false);

  // Shows until a choice is stored, and again whenever the choice is cleared
  // from the footer's "Cookie settings" button.
  useEffect(() => {
    const sync = () => setVisible(readConsent() === null);
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (!visible) return null;

  return (
    <aside className="cookie-consent" aria-label="Cookie consent">
      <div className="cookie-inner">
        <p>
          Analytics and ads stay switched off until you choose. Confirm to allow them, or deny to keep the page
          script-free. <a href="/privacy">Privacy policy</a>.
        </p>
        <div className="cookie-actions">
          <button type="button" className="cookie-button cookie-deny" onClick={() => writeConsent("denied")}>
            Deny
          </button>
          <button type="button" className="cookie-button cookie-confirm" onClick={() => writeConsent("accepted")}>
            Confirm
          </button>
        </div>
      </div>
    </aside>
  );
}

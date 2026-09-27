"use client";

import { useEffect, useRef, useState } from "react";
import DonationBoard from "@/components/donation-board";
import ReferralCarousel from "@/components/referral-carousel";
import TrustpilotReviews from "@/components/trustpilot-reviews";

/* The support hub. Everything that asks the visitor for something —
   the Trustpilot review collector, the donation board, the sponsored
   referrals and the paid support button — is gathered under one heading that
   opens and closes, exactly like the "Featured sites" heading. It starts open;
   the heading button is a real disclosure control with `aria-expanded` and
   `aria-controls`, and a line of text spells out the closed state so a visitor
   never faces an empty gap with no explanation. Toggling gives the whole
   block a short shake (and a haptic tick on devices that support it) so the
   open/close reads as a physical response rather than a silent swap. */
export default function SupportSection() {
  const [collapsed, setCollapsed] = useState(false);
  const [vibrating, setVibrating] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    // Skip the first render: the section starts open, and that is not a toggle.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setVibrating(true);
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(20);
    }
    const timer = window.setTimeout(() => setVibrating(false), 460);
    return () => window.clearTimeout(timer);
  }, [collapsed]);

  return (
    <section
      id="support"
      className={`support-section directory-section${vibrating ? " is-vibrating" : ""}`}
      aria-labelledby="support-heading"
    >
      <div className="section-heading">
        <h2 id="support-heading" className="section-heading-main">
          <button
            type="button"
            className={`sites-toggle${collapsed ? " is-collapsed" : ""}`}
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-controls="support-panel"
          >
            <span className="sites-toggle-label">Support</span>
            <svg
              className="sites-toggle-arrow"
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </h2>
      </div>

      {collapsed && (
        <p className="section-closed-note" role="status">
          Support is closed right now. Open the “Support” heading above to see the reviews, the donation board and the sponsored links again.
        </p>
      )}

      <div id="support-panel" className="sites-panel support-panel" hidden={collapsed}>
        <TrustpilotReviews />

        <DonationBoard />

        <ReferralCarousel />

        {/* The affiliate slot's own pitch: this is where a sponsored card
            lives, so it is also where someone asks how to get one. */}
        <p className="support-sponsor-line">
          Want your link in that carousel or on the support button?{" "}
          <a href="/sponsor">Sponsor base31.org</a> — or email{" "}
          <a href="mailto:hello@base31.org">hello@base31.org</a>.
        </p>

        {/* The sponsored support button: an ad slot that pays for the rest of
            the page. It is a plain link, so it needs no consent gate. */}
        <a
          className="support-ad"
          data-reveal
          href="https://www.profitableratecpmnetwork.com/vsnt502b?key=014ca151909e76ba10dc8d6cfae88709"
          target="_blank"
          rel="noreferrer sponsored"
        >
          <span className="support-ad-tag mono">ad</span>
          <span className="support-ad-text">Want to support base31? Click this button to help</span>
          <span className="support-ad-arrow mono" aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}

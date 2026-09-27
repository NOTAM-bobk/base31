/* The last block on the page, directly above the footer: the second decorative
   sparkle plus the invitation to sponsor. It lives in its own component so the
   bottom of the page can be edited without touching the very long app/page.tsx.
   The GIF is served from public/ (see app/late.css) and is decorative only, so
   it is hidden from assistive tech and from reduced-motion visitors. */
export default function FooterSponsor() {
  return (
    <section className="footer-sponsor" aria-labelledby="footer-sponsor-heading">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="footer-sparkle"
        src="/footer-sparkle.gif"
        alt=""
        width={64}
        height={64}
        aria-hidden="true"
        loading="lazy"
      />
      <div className="footer-sponsor-copy">
        <h2 id="footer-sponsor-heading">Sponsor base31.org</h2>
        <p>
          Put your referral link or your ad in front of people who enjoy finding things on the open web. Every placement is labelled as
          sponsored, and there is nothing to track or install.
        </p>
        <a className="footer-sponsor-link" href="/sponsor">
          See the sponsorship options <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}

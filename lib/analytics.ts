/**
 * The Google tag (gtag.js) for base31.org.
 *
 * Google's instruction is to paste the snippet as high in the `<head>` as
 * possible, and the installation check only ever sees the HTML a page is
 * served — so the tag is rendered from `app/layout.tsx` on every page rather
 * than appended by a component after the fact.
 *
 * It runs on every visit, before the cookie banner is answered and whatever
 * the answer turns out to be. That is deliberate: Google verifies the property
 * from the served tag, so anything that waits for a click is invisible to it.
 * The banner still decides whether Microsoft Clarity records a session and
 * whether the ad network loads — see `components/consent-aware-analytics.tsx`
 * and `components/consent-aware-ads.tsx`.
 */
export const GOOGLE_ANALYTICS_ID = "G-W6J79P13FT";

/** The Google tag snippet, inline in `<head>` on every page. */
export const googleTagSnippet = [
  "window.dataLayer = window.dataLayer || [];",
  "function gtag(){dataLayer.push(arguments);}",
  "gtag('js', new Date());",
  `gtag('config', '${GOOGLE_ANALYTICS_ID}');`,
].join("\n");

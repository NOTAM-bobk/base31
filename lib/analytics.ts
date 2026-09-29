/**
 * The Google tag (gtag.js) for base31.org.
 *
 * Google's instruction is to paste the snippet as high in the `<head>` as
 * possible, and the installation check only ever sees the HTML a page is
 * served — so the tag is rendered from `app/layout.tsx` on every page rather
 * than appended by a component after the fact.
 *
 * Consent Mode is what keeps the tag compatible with the cookie banner (see
 * README.md, "Cookies, ads and analytics"): every storage type starts
 * `denied`, so the tag loads and Google can see it installed while nothing is
 * written to storage, and `components/consent-aware-analytics.tsx` sends the
 * update once the visitor answers.
 */
/**
 * The current measurement ID, taken from the tag pasted at the top of
 * README.md. Replace this one string when Google issues a new one — the loader
 * URL and the `config` call are both built from it, so they cannot drift apart.
 */
export const GOOGLE_ANALYTICS_ID = "G-W6J79P13FT";

/** The Consent Mode storage types the cookie banner switches on or off. */
export const CONSENT_TYPES = ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage"] as const;

/** The Google tag snippet, inline in `<head>` on every page. */
export const googleTagSnippet = [
  "window.dataLayer = window.dataLayer || [];",
  "function gtag(){dataLayer.push(arguments);}",
  "gtag('consent', 'default', {ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500});",
  "gtag('js', new Date());",
  `gtag('config', '${GOOGLE_ANALYTICS_ID}');`,
].join("\n");

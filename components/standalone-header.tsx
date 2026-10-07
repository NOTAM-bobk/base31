"use client";

import SiteHeader from "@/components/site-header";
import { useSiteTheme } from "@/lib/theme";

/**
 * The site's masthead on a page that is not the homepage.
 *
 * The homepage owns its theme state (it also fades the swap and opens the
 * navigation drawer), so `SiteHeader` takes that state as props. A page like
 * the 404 has no such state to give it and no drawer to open, so this thin
 * client wrapper supplies the shared theme hook instead: the same header, the
 * same wordmark, the same toggle, one implementation of both.
 */
export default function StandaloneHeader() {
  const { theme, toggleTheme } = useSiteTheme();
  return <SiteHeader theme={theme} onToggleTheme={toggleTheme} />;
}

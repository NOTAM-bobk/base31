"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export default function BlogTransitions() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute("download")) return;

      const destination = new URL(link.href, window.location.href);
      const isBlogPath = (path: string) => path === "/blog" || path.startsWith("/blog/");
      if (destination.origin !== window.location.origin) return;
      if (!isBlogPath(pathname) && !isBlogPath(destination.pathname)) return;
      if (destination.pathname === pathname && destination.search === window.location.search && destination.hash === window.location.hash) return;

      const viewDocument = document as ViewTransitionDocument;
      if (!viewDocument.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      event.preventDefault();
      viewDocument.startViewTransition(() => {
        router.push(`${destination.pathname}${destination.search}${destination.hash}`);
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, router]);

  return null;
}

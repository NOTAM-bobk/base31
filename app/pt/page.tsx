import type { Metadata } from "next";
import HomePage from "@/components/home-page";
import { PT } from "@/lib/i18n";

// Portuguese (Brazil) homepage: same shared component as "/", PT-BR copy,
// its own canonical URL and hreflang map for crawlers.
export const metadata: Metadata = {
  title: "base31.org — Um diretório de sites legais e páginas divertidas",
  description:
    "Explore o base31.org, um diretório independente de sites legais, páginas divertidas, projetos web criativos e ferramentas online úteis.",
  alternates: {
    canonical: "/pt",
    languages: { "x-default": "/", en: "/", es: "/es", fr: "/fr", pt: "/pt" },
  },
  openGraph: {
    title: "base31.org — Um diretório de sites legais e páginas divertidas",
    description: "Um diretório curado de sites legais, páginas divertidas, projetos criativos e ferramentas úteis na web aberta.",
    locale: "pt_BR",
    alternateLocale: ["en_US", "es_ES", "fr_FR"],
  },
  twitter: {
    title: "base31.org — Sites legais e páginas divertidas",
    description: "Descubra projetos web criativos, ferramentas úteis e páginas divertidas no diretório base31.org.",
  },
};

export default function Page() {
  return <HomePage dict={PT} locale="pt" />;
}

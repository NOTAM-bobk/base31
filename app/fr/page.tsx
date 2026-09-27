import type { Metadata } from "next";
import HomePage from "@/components/home-page";
import { FR } from "@/lib/i18n";

// French homepage: same shared component as "/", French copy, its own
// canonical URL and hreflang map so crawlers index the right variant.
export const metadata: Metadata = {
  title: "base31.org — Un annuaire de sites géniaux et de pages amusantes",
  description:
    "Explorez base31.org, un annuaire indépendant de sites géniaux, de pages amusantes, de projets web créatifs et d'outils en ligne utiles.",
  alternates: {
    canonical: "/fr",
    languages: { "x-default": "/", en: "/", es: "/es", fr: "/fr", pt: "/pt" },
  },
  openGraph: {
    title: "base31.org — Un annuaire de sites géniaux et de pages amusantes",
    description: "Un annuaire sélectionné de sites géniaux, de pages amusantes, de projets créatifs et d'outils utiles sur le web ouvert.",
    locale: "fr_FR",
    alternateLocale: ["en_US", "es_ES", "pt_BR"],
  },
  twitter: {
    title: "base31.org — Sites géniaux et pages amusantes",
    description: "Découvrez des projets web créatifs, des outils utiles et des pages amusantes dans l'annuaire base31.org.",
  },
};

export default function Page() {
  return <HomePage dict={FR} locale="fr" />;
}

import type { Metadata } from "next";
import HomePage from "@/components/home-page";
import { ES } from "@/lib/i18n";

// Spanish homepage. The description differs from the English page's metadata,
// so the Spanish Open Graph/Twitter copy mirrors the translated hero rather
// than leaking English into social previews.
export const metadata: Metadata = {
  title: "base31.org — Un directorio de sitios geniales y páginas divertidas",
  description:
    "Explora base31.org, un directorio independiente de sitios geniales, páginas divertidas, proyectos web creativos y herramientas útiles en línea.",
  alternates: {
    canonical: "/es",
    languages: { "x-default": "/", en: "/", es: "/es", fr: "/fr", pt: "/pt" },
  },
  openGraph: {
    title: "base31.org — Un directorio de sitios geniales y páginas divertidas",
    description: "Un directorio curado de sitios geniales, páginas divertidas, proyectos creativos y herramientas útiles en la web abierta.",
    locale: "es_ES",
    alternateLocale: ["en_US", "fr_FR", "pt_BR"],
  },
  twitter: {
    title: "base31.org — Sitios geniales y páginas divertidas",
    description: "Descubre proyectos web creativos, herramientas útiles y páginas divertidas en el directorio base31.org.",
  },
};

export default function Page() {
  return <HomePage dict={ES} locale="es" />;
}

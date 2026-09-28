// Lightweight i18n for the homepage's translated variants.
//
// The routes app/es, app/fr and app/pt are static pre-rendered copies of the
// homepage whose user-facing strings come from this module. There is no
// middleware and no [locale] dynamic segment on purpose: base31 ships three
// full locales, not an arbitrary set, so explicit folders keep every URL
// stable, crawlable and typable — and keep the default English homepage at
// "/" untouched for the 96% of visitors who read English.
//
// The home page component takes a `dict` prop; every nested string is
// required, so adding a locale means translating every key (typecheck fails
// on a partial translation instead of shipping a half-English page).

export type Locale = "en" | "es" | "fr" | "pt";

export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "ES" },
  { code: "fr", label: "Français", short: "FR" },
  { code: "pt", label: "Português", short: "PT" },
];

// BCP 47 tags used for <html lang> on the translated pages and for hreflang.
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en",
  es: "es",
  fr: "fr",
  pt: "pt",
};

// The English strings double as the Dictionary type. Keep every string
// sentence-case plain text — they are dropped into markup as-is.
export const EN = {
  heroTop: "Cool sites for",
  heroBottom: "people.",
  heroWords: ["curious", "bored", "restless", "picky"],
  subtitle:
    "Discover fun websites, useful online tools, and creative web projects built on base31.org and the open web.",
  whyLink: "Why base31?",
  surprise: "Surprise me",
  searchPlaceholder: "Search all sites...",
  searchAria: "Search all sites",
  featured: "Featured sites",
  featuredClosed:
    "Featured sites are closed right now. Open the “Featured sites” heading above to browse every site again.",
  coolSites: "Other cool sites",
  coolSitesLede:
    "Hand-picked corners of the web that live at their own addresses — not made by base31, just worth the trip.",
  coolSitesClosed:
    "Other cool sites are closed right now. Open the “Other cool sites” heading above to see the off-directory picks again.",
  links: "links",
  allTag: "All",
  filterByTag: "Filter by tag",
  liked: "Liked",
  newest: "Newest",
  az: "A–Z",
  sortBy: "Sort by",
  addYourSite: "Add your own site",
  addYourSiteText:
    "Upload your HTML files — we host them here for free, and visitors can browse and vote on your site.",
  views: "views",
};

export type Dictionary = typeof EN;
// Spanish — used by /es. Neutral Latin American Spanish, no regional slang.
export const ES: Dictionary = {
  heroTop: "Sitios geniales para",
  heroBottom: "personas.",
  heroWords: ["curiosas", "aburridas", "inquietas", "exigentes"],
  subtitle:
    "Descubre sitios divertidos, herramientas útiles en línea y proyectos web creativos hechos en base31.org y en la web abierta.",
  whyLink: "¿Por qué base31?",
  surprise: "Sorpréndeme",
  searchPlaceholder: "Buscar todos los sitios...",
  searchAria: "Buscar todos los sitios",
  featured: "Sitios destacados",
  featuredClosed:
    "Los sitios destacados están cerrados ahora mismo. Abre el encabezado «Sitios destacados» para volver a verlos todos.",
  coolSites: "Otros sitios geniales",
  coolSitesLede:
    "Rincones de la web elegidos a mano que viven en sus propias direcciones: no los hizo base31, solo valen el viaje.",
  coolSitesClosed:
    "Otros sitios geniales están cerrados ahora mismo. Abre el encabezado «Otros sitios geniales» para volver a ver los sitios externos.",
  links: "enlaces",
  allTag: "Todos",
  filterByTag: "Filtrar por etiqueta",
  liked: "Me gustados",
  newest: "Más nuevos",
  az: "A–Z",
  sortBy: "Ordenar por",
  addYourSite: "Añade tu propio sitio",
  addYourSiteText:
    "Sube tus archivos HTML — los alojamos gratis, y los visitantes pueden navegar y votar por tu sitio.",
  views: "vistas",
};

// French — used by /fr.
export const FR: Dictionary = {
  heroTop: "Des sites géniaux pour",
  heroBottom: "personnes.",
  heroWords: ["curieuses", "occupées", "aventureuses", "fatiguées"],
  subtitle:
    "Découvrez des sites amusants, des outils en ligne utiles et des projets web créatifs construits sur base31.org et le web ouvert.",
  whyLink: "Pourquoi base31 ?",
  surprise: "Surprends-moi",
  searchPlaceholder: "Rechercher tous les sites...",
  searchAria: "Rechercher tous les sites",
  featured: "Sites en vedette",
  featuredClosed:
    "Les sites en vedette sont fermés pour le moment. Ouvrez le titre « Sites en vedette » ci-dessus pour les revoir.",
  coolSites: "Autres sites sympas",
  coolSitesLede:
    "Des coins du web choisis à la main qui vivent à leurs propres adresses — pas réalisés par base31, juste dignes du détour.",
  coolSitesClosed:
    "Les autres sites sympas sont fermés pour le moment. Ouvrez le titre « Autres sites sympas » ci-dessus pour les revoir.",
  links: "liens",
  allTag: "Tous",
  filterByTag: "Filtrer par étiquette",
  liked: "Aimés",
  newest: "Nouveaux",
  az: "A–Z",
  sortBy: "Trier par",
  addYourSite: "Ajoutez votre site",
  addYourSiteText:
    "Envoyez vos fichiers HTML — nous les hébergeons gratuitement, et les visiteurs peuvent naviguer et voter pour votre site.",
  views: "vues",
};

// Brazilian Portuguese — used by /pt. BR spelling is the largest PT audience.
export const PT: Dictionary = {
  heroTop: "Sites legais para",
  heroBottom: "pessoas.",
  heroWords: ["curiosas", "entediadas", "agitadas", "exigentes"],
  subtitle:
    "Descubra sites divertidos, ferramentas online úteis e projetos web criativos feitos no base31.org e na web aberta.",
  whyLink: "Por que base31?",
  surprise: "Surpreenda-me",
  searchPlaceholder: "Pesquisar todos os sites...",
  searchAria: "Pesquisar todos os sites",
  featured: "Sites em destaque",
  featuredClosed:
    "Os sites em destaque estão fechados agora. Abra o título “Sites em destaque” acima para vê-los de novo.",
  coolSites: "Outros sites legais",
  coolSitesLede:
    "Cantos da web escolhidos a dedo que vivem em seus próprios endereços — não são feitos pela base31, apenas valem a viagem.",
  coolSitesClosed:
    "Os outros sites legais estão fechados agora. Abra o título “Outros sites legais” acima para vê-los de novo.",
  links: "links",
  allTag: "Todos",
  filterByTag: "Filtrar por tag",
  liked: "Curtidos",
  newest: "Recentes",
  az: "A–Z",
  sortBy: "Ordenar por",
  addYourSite: "Adicione seu site",
  addYourSiteText:
    "Envie seus arquivos HTML — hospedamos de graça, e os visitantes podem navegar e votar no seu site.",
  views: "visualizações",
};

export const DICTS: Record<Locale, Dictionary> = { en: EN, es: ES, fr: FR, pt: PT };

export const dictFor = (locale: Locale): Dictionary => DICTS[locale] ?? EN;

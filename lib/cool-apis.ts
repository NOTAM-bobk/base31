import coolApis from "@/config/cool-apis.json";

// A hand-picked, off-directory API: a free public service you can call from
// your own project (not a base31.org subdomain). The list is edited purely
// through config/cool-apis.json — this module adds the types and the search
// helper the homepage and the "Cool APIs" strip share, so the hero search
// matches these cards with the same rule in both places.
export type CoolApi = {
  name: string;
  url: string;
  tags: string[];
  description: string;
};

export const allCoolApis = coolApis as CoolApi[];

/** Everything about an API a search should look at, lowercased. */
const index = (api: CoolApi) => `${api.name} ${api.url} ${api.tags.join(" ")} ${api.description}`.toLowerCase();

/** The APIs matching a hero-search query (all of them when it is empty). */
export const searchCoolApis = (query: string): CoolApi[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return allCoolApis;
  return allCoolApis.filter((api) => index(api).includes(needle));
};

export default allCoolApis;

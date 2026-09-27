import coolSites from "@/config/cool-sites.json";

// A hand-picked, off-directory link: a cool site that lives at its own
// address (not a base31.org subdomain). The list is edited purely through
// config/cool-sites.json — this module adds nothing but types.
export type CoolSite = {
  name: string;
  url: string;
  tags: string[];
  description: string;
};

export default coolSites as CoolSite[];

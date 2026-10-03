import weeklySites from "@/config/websites-of-the-week.json";

export type WebsiteOfTheWeek = {
  weekOf: string;
  name: string;
  url: string;
  tagline: string;
  story: string;
  tags: string[];
};

export const websitesOfTheWeek = (weeklySites as WebsiteOfTheWeek[])
  .slice()
  .sort((a, b) => (a.weekOf < b.weekOf ? 1 : a.weekOf > b.weekOf ? -1 : 0));

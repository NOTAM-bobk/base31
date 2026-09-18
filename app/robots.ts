import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://base31.org/sitemap.xml",
    host: "https://base31.org",
  };
}

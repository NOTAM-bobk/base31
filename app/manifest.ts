import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "base31.org — Cool Sites Directory",
    short_name: "base31",
    description: "A directory of cool sites, fun websites, and creative web projects.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/base31-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/base31-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

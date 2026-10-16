import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shubhangi Engineers – Costing",
    short_name: "SE Costing",
    description: "Weight, development and cost of every item on a fabrication drawing.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6f4",
    theme_color: "#18181b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

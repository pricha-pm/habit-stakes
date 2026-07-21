import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Habit Stakes",
    short_name: "Stakes",
    description: "Miss a habit, owe a friend. Real stakes, grounded coaching.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4d5",
    theme_color: "#f7f4d5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

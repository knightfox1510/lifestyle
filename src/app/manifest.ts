import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Hearth: household lifestyle",
    short_name: "Hearth",
    description: "Track health, food, routines and household life together.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f6f3",
    theme_color: "#2f6f5e",
    // Matches the logo: home + flame (the two of you) + heart.
    categories: ["health", "lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android: share Zomato/Swiggy menu screenshots straight into Hearth.
    share_target: {
      action: "/dining/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", files: [{ name: "photos", accept: ["image/*"] }] },
    },
    shortcuts: [
      { name: "Medical timeline", url: "/medical", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Ask AI", url: "/assistant", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "TradeOS — Trading Journal",
    short_name:       "TradeOS",
    description:      "Track, analyze and improve your futures trading.",
    start_url:        "/dashboard",
    display:          "standalone",
    orientation:     "portrait-primary",
    background_color: "#0a0a0f",
    theme_color:      "#0a0a0f",
    categories:      ["finance", "productivity"],
    icons: [
      { src: "/icons/192",      sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512",      sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

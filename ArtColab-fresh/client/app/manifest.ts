import type { MetadataRoute } from "next";
import frogIcon from "../../frog icon.png";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Froddle",
    short_name: "Froddle",
    description:
      "Playful real-time collaborative drawing rooms with frog-powered energy",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f4e8",
    theme_color: "#19a7ff",
    icons: [
      {
        src: frogIcon.src,
        sizes: "1200x1200",
        type: "image/png",
        purpose: "any maskable" as any,
      },
      {
        src: frogIcon.src,
        sizes: "1200x1200",
        type: "image/png",
      },
    ],
  };
}

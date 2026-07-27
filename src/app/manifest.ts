import type { MetadataRoute } from "next";

// Makes Zivotix installable to a phone's home screen. There's no native app
// to maintain or submit for review: door staff open the site once, tap "add
// to home screen", and from then on it launches full-screen with its own icon
// and no browser chrome, which is what actually matters at a venue door.
//
// start_url is /scan rather than the homepage. Anyone installing this is
// working an event, and making them tap through the marketing site while a
// queue builds would be a poor trade for consistency.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zivotix Scanner",
    short_name: "Zivotix",
    description: "Scan tickets and check guests in at the door.",
    start_url: "/scan",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches the scanner's black backdrop, so there's no white flash between
    // the splash screen and the camera view.
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["business", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scan tickets", url: "/scan" },
      { name: "Organizer dashboard", url: "/organizer" },
    ],
  };
}

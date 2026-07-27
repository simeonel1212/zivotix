"use client";

import { useEffect } from "react";

// Registers /sw.js so the scanner can be installed and opens without network.
//
// Mounted only inside the /scan layout rather than the root layout: a service
// worker on the public marketing site would cache pages for buyers with no
// benefit and a real risk of serving them a stale event listing or price.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Registration failing is not worth surfacing to a person working a door.
    // They lose offline shell caching and nothing else.
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  return null;
}

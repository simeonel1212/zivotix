"use client";

import { useEffect, useState } from "react";

// Chrome fires this instead of showing its own install banner, letting us put
// the prompt behind our own button. It isn't in the DOM typings.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "desktop" | "installed";

export default function InstallButton() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already running as an installed app — there's nothing left to install,
    // and offering it again just looks broken.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari predates display-mode and uses its own flag.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setPlatform("installed");
      return;
    }

    const ua = navigator.userAgent;
    // iPadOS 13+ reports itself as a Mac, so touch support is the tiebreaker.
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIOS) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    function onPrompt(e: Event) {
      // Stops Chrome showing its own mini-infobar, so ours is the only
      // install affordance on the page.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setPlatform("installed"));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!deferred) return;
    setInstalling(true);
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event can only be used once — Chrome will fire a fresh one if they
    // change their mind later.
    setDeferred(null);
    setInstalling(false);
    if (outcome === "dismissed") setDismissed(true);
  }

  if (platform === null) {
    return <div className="h-[52px] w-full sm:w-64 animate-pulse rounded-full bg-neutral-900/10" />;
  }

  if (platform === "installed") {
    return (
      <div className="flex items-center gap-2 rounded-full bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-300">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        App installed
      </div>
    );
  }

  // Android with a live prompt: one tap and Chrome's own install dialog opens.
  if (deferred) {
    return (
      <div className="w-full sm:w-auto">
        <button onClick={install} disabled={installing} className="zv-btn-primary w-full sm:w-auto text-base px-8 py-3.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {installing ? "Installing…" : "Install app"}
        </button>
        {dismissed && (
          <p className="mt-2 text-xs text-neutral-500">
            Install cancelled. Tap again whenever you&apos;re ready.
          </p>
        )}
      </div>
    );
  }

  // iOS, or Android before Chrome has fired the prompt. Both need words
  // rather than a button, so the page's platform sections do the work — this
  // just points at them honestly instead of showing a button that can't fire.
  return (
    <a href="#how-to-install" className="zv-btn-primary w-full sm:w-auto text-base px-8 py-3.5">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {platform === "ios" ? "How to install on iPhone" : "How to install"}
    </a>
  );
}

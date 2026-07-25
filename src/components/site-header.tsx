"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ZivotixLogo from "@/components/zivotix-logo";

// Persistent public-site header: big brand mark on the left. Below the `lg`
// breakpoint, everything else lives behind a collapse menu on the right (the
// mobile pattern — logo + burger); at `lg` and up, the menu renders inline
// as a normal horizontal nav instead, since a hamburger with nothing next to
// it just reads as broken on a wide screen.
// Self-hides on dashboard/auth/scan surfaces, which have their own chrome.
const HIDDEN_PREFIXES = [
  "/organizer",
  "/admin",
  "/scan",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/checkout",
  "/auth",
];

const MENU = [
  { href: "/events", label: "Find Events" },
  { href: "/community", label: "Community" },
  { href: "/orders", label: "My Orders" },
  { href: "/organise", label: "Organise an Event" },
  { href: "mailto:support@zivotix.site", label: "Help" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click; link clicks close via the nav's onClick below.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <header className="sticky top-0 z-40 zv-glass border-b border-neutral-200/60">
      <div className="mx-auto max-w-6xl px-6 h-20 lg:h-24 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <ZivotixLogo markSize={52} textClassName="text-3xl" />
        </Link>

        {/* Desktop: plain horizontal nav — the menu items and Log in button
            sit inline in the header instead of behind a hamburger, since a
            lone icon with empty space around it looks unfinished on a wide
            screen. */}
        <nav className="hidden lg:flex items-center gap-8">
          {MENU.map((item) =>
            item.href.startsWith("mailto:") ? (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname.startsWith(item.href) ? "text-neutral-900" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {item.label}
              </Link>
            )
          )}
          <Link href="/login" className="zv-btn-primary text-sm px-5 py-2.5">
            Log in
          </Link>
        </nav>

        {/* Mobile/tablet: collapse everything behind a hamburger dropdown. */}
        <div className="relative lg:hidden" ref={menuRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="p-2.5 -mr-2 rounded-xl text-neutral-700 hover:text-neutral-900 hover:bg-white/70 transition-colors"
          >
            {open ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {open && (
            <div
              className="absolute right-0 top-full mt-3 w-64 rounded-2xl bg-white border border-neutral-200/70 shadow-[0_24px_56px_-16px_rgba(0,0,0,0.25)] overflow-hidden"
              onClick={() => setOpen(false)}
            >
              <nav className="py-2">
                {MENU.map((item) =>
                  item.href.startsWith("mailto:") ? (
                    <a
                      key={item.label}
                      href={item.href}
                      className="block px-5 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="block px-5 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                    >
                      {item.label}
                    </Link>
                  )
                )}
              </nav>
              <div className="border-t border-neutral-100 p-3">
                <Link href="/login" className="zv-btn-primary w-full text-sm">
                  Log in
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

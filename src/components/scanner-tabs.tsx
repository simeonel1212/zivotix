"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Bottom tab bar for the installed app.
//
// Only rendered on the list and community screens, never over the camera —
// a scanner working a queue shouldn't have a navigation bar under their thumb
// where a mis-tap drops them out mid-scan.
//
// The Community tab is only passed through for organizers. Door staff have no
// posts to write, and showing them a tab that leads nowhere useful is worse
// than not showing it.
export default function ScannerTabs({ showCommunity }: { showCommunity: boolean }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/scan", label: "Events", icon: ScanIcon },
    ...(showCommunity ? [{ href: "/scan/community", label: "Community", icon: CommunityIcon }] : []),
  ];

  if (tabs.length < 2) return null;

  return (
    <nav className="sticky bottom-0 z-20 border-t border-neutral-200/70 bg-white/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-semibold transition-colors ${
                active ? "text-neutral-900" : "text-neutral-400"
              }`}
            >
              <Icon active={active} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ScanIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "url(#zv-tab-gold)" : "currentColor"}
      strokeWidth="2"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="zv-tab-gold" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#facc15" />
          <stop offset="1" stopColor="#ca8a04" />
        </linearGradient>
      </defs>
      <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12h18" strokeLinecap="round" />
    </svg>
  );
}

function CommunityIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "url(#zv-tab-gold)" : "currentColor"}
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Inline 18px stroke icons for the dashboard nav — a proper icon set
// (rather than emoji) keeps the sidebar looking like a real product.
const ICONS: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" strokeLinecap="round" />
    </>
  ),
  ticket: (
    <>
      <path
        d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 1 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 1 0 0-4V8Z"
        strokeLinejoin="round"
      />
      <path d="M14 6v12" strokeDasharray="2.5 3" strokeLinecap="round" />
    </>
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.7-3 2.9-4.7 5.5-4.7s4.8 1.7 5.5 4.7" strokeLinecap="round" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 4.9M17.6 15c1.6.7 2.7 2.2 3.1 4.4" strokeLinecap="round" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10.5h18M7 15h4" strokeLinecap="round" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6l7-3Z" strokeLinejoin="round" />
      <path d="M9.3 12l2 2 3.4-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4" strokeLinecap="round" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <circle cx="12" cy="12.5" r="2.6" />
      <path d="M6.5 10.2v.01M17.5 15v.01" strokeLinecap="round" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2" strokeLinecap="round" />
      <path d="M4 12h16" strokeLinecap="round" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l1 5h2l-1-5h2l9 4V7l-9 4H6a2 2 0 0 0-2 2Z" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M19 9.5a3 3 0 0 1 0 5" strokeLinecap="round" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

// Shared sidebar link for the organizer/admin dashboards — highlights
// itself when the current page matches. "/organizer/events" is a special
// case: it should stay highlighted on an event's detail page (nested under
// it) but NOT on "/organizer/events/new", which has its own nav item.
export default function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const active =
    href === "/organizer/events"
      ? pathname === href || (pathname.startsWith(`${href}/`) && pathname !== "/organizer/events/new")
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-medium transition-all ${
        active
          ? "bg-white shadow-sm zv-gradient-text"
          : "text-neutral-600 hover:text-neutral-900 hover:bg-white hover:shadow-sm"
      }`}
    >
      {icon && ICONS[icon] && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className={`shrink-0 ${active ? "" : "text-neutral-400"}`}
          style={active ? { color: "var(--accent-solid)" } : undefined}
          aria-hidden="true"
        >
          {ICONS[icon]}
        </svg>
      )}
      {children}
    </Link>
  );
}

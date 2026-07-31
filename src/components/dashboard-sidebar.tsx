"use client";

import { useState } from "react";
import NavLink from "@/components/nav-link";

interface DashboardSidebarProps {
  brandTitle: string;
  brandSubtitle?: string;
  links: { href: string; label: string; icon?: string }[];
  footer?: React.ReactNode;
}

// Renders as a normal static sidebar on desktop. On mobile it collapses
// behind a hamburger button in a slim top bar and slides in as an overlay
// drawer, instead of permanently pushing page content down the screen.
export default function DashboardSidebar({ brandTitle, brandSubtitle, links, footer }: DashboardSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/15 bg-neutral-900">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600" />
          <p className="font-bold text-sm text-neutral-50">{brandTitle}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 -mr-2 text-neutral-300 hover:text-neutral-50"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 md:min-h-screen overflow-y-auto
          border-r border-white/15 p-6 space-y-8 bg-neutral-900 shadow-2xl md:shadow-none
          transform transition-transform duration-200 md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600" />
              <p className="font-bold text-neutral-50">{brandTitle}</p>
            </div>
            {brandSubtitle && <p className="text-xs text-neutral-500 pl-4">{brandSubtitle}</p>}
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="md:hidden p-1 text-neutral-500 hover:text-neutral-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1 text-sm" onClick={() => setOpen(false)}>
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} icon={l.icon}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        {footer}
      </aside>
    </>
  );
}

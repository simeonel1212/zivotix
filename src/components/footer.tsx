"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ZivotixMark } from "@/components/zivotix-logo";

// The scanner runs full-screen as an installed app on a phone at a venue
// door. A marketing footer with Terms and Privacy links underneath the camera
// view breaks that illusion and wastes the only screen space that matters.
const HIDDEN_PREFIXES = ["/scan"];

export default function Footer() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <footer className="border-t border-white/15 mt-auto">
      <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
        <p className="flex items-center gap-2">
          <ZivotixMark size={20} />
          © {new Date().getFullYear()} Eden Cloudwave Technology · Zivotix
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/terms" className="hover:text-neutral-200 transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-neutral-200 transition-colors">
            Privacy
          </Link>
          <Link href="/refund-policy" className="hover:text-neutral-200 transition-colors">
            Refund policy
          </Link>
          <Link href="/scanner-app" className="hover:text-neutral-200 transition-colors">
            Scanner app
          </Link>
          <Link href="/contact" className="hover:text-neutral-200 transition-colors">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}

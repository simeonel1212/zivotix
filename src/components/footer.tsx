import Link from "next/link";
import { ZivotixMark } from "@/components/zivotix-logo";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200/70 mt-auto">
      <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-400">
        <p className="flex items-center gap-2">
          <ZivotixMark size={20} />
          © {new Date().getFullYear()} Eden Cloudwave Technology · Zivotix
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/terms" className="hover:text-neutral-700 transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-neutral-700 transition-colors">
            Privacy
          </Link>
          <Link href="/refund-policy" className="hover:text-neutral-700 transition-colors">
            Refund policy
          </Link>
          <Link href="/contact" className="hover:text-neutral-700 transition-colors">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}

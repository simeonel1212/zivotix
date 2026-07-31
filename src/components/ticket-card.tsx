import Image from "next/image";
import { ZivotixMark } from "@/components/zivotix-logo";

// The single designed ticket card — shared by the branded /t/[token] page
// and the post-checkout success page, so a buyer sees the exact same ticket
// graphic (gold header, perforation, QR) everywhere, not a bare QR code.
export default function TicketCard({
  status,
  eventTitle,
  eventDateLabel,
  venue,
  city,
  ticketTypeName,
  buyerName,
  reference,
  qrDataUrl,
  logoUrl,
}: {
  status: "valid" | "used" | "void";
  eventTitle: string;
  eventDateLabel: string;
  venue: string | null;
  city: string | null;
  ticketTypeName: string;
  buyerName?: string | null;
  reference: string;
  qrDataUrl: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="rounded-3xl overflow-hidden shadow-[0_24px_64px_-16px_rgba(0,0,0,0.25)] bg-neutral-900">
        {/* Header band */}
        <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 px-6 pt-6 pb-5 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold tracking-tight">
              <ZivotixMark size={22} /> Zivotix
            </span>
            <span
              className={`zv-badge ${
                status === "valid" ? "bg-neutral-900/25 text-white" : status === "used" ? "bg-black/30 text-white" : "bg-red-600 text-white"
              }`}
            >
              {status === "valid" ? "Valid" : status === "used" ? "Checked in" : "Void"}
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-bold leading-snug">{eventTitle}</h1>
          <p className="mt-1 text-sm text-yellow-50/90">{eventDateLabel}</p>
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500">Venue</span>
            <span className="font-medium text-neutral-50 text-right">
              {venue}
              {city ? `, ${city}` : ""}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500">Ticket</span>
            <span className="font-medium text-neutral-50">{ticketTypeName}</span>
          </div>
          {buyerName && (
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Holder</span>
              <span className="font-medium text-neutral-50">{buyerName}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500">Ref</span>
            <span className="font-mono font-medium text-neutral-50">{reference}</span>
          </div>
        </div>

        {/* Perforation */}
        <div className="relative">
          <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-[var(--background)]" />
          <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-[var(--background)]" />
          <div className="border-t-2 border-dashed border-white/15" />
        </div>

        {/* QR */}
        <div className="px-6 py-6 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Ticket QR code" className="h-52 w-52 rounded-xl" />
          <p className="text-xs text-neutral-500 text-center">Show this code at the door. One scan per ticket.</p>
        </div>
      </div>

      {logoUrl && (
        <div className="mt-6 flex justify-center">
          <Image
            src={logoUrl}
            alt="Event logo"
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/15 shadow-sm"
          />
        </div>
      )}
    </div>
  );
}

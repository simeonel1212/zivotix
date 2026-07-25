import Link from "next/link";

// Shown on organizer dashboard pages when the signed-in user has no organizer
// record. Two real cases hit this: an admin account (which has no business of
// its own), and a signup where the profile was created but the organizer row
// wasn't. Previously both produced a raw "invalid input syntax for type uuid"
// database error.
export default function NoOrganizerNotice({ title }: { title: string }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{title}</h1>
      <div className="zv-card p-8 space-y-3">
        <p className="text-sm text-neutral-700 font-medium">
          This account isn&apos;t set up as an organizer yet.
        </p>
        <p className="text-sm text-neutral-500 leading-relaxed">
          You&apos;re signed in, but there&apos;s no business profile attached to this account, so
          there are no events or updates to show. If you signed up to sell tickets and are seeing
          this, your signup didn&apos;t finish. Get in touch and we&apos;ll fix it on our side.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/organise" className="zv-btn-primary text-sm">
            Set up an organizer account
          </Link>
          <a href="mailto:support@zivotix.site" className="zv-btn-secondary text-sm">
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

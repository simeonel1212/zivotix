// Small checkmark badge for organizers the platform has manually verified
// (see organizers.is_verified — toggled from /admin/organizers). Purely
// presentational, safe to drop next to a business name anywhere.
export default function VerifiedBadge() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="inline-block text-blue-500 shrink-0"
      aria-label="Verified organizer"
    >
      <title>Verified organizer</title>
      <path d="M12 1.5l2.6 2.1 3.3-.4 1 3.2 3 1.5-.9 3.3 1.6 3-2.5 2.3.4 3.3-3.3.6-1.7 2.9-3.1-1.1-3.1 1.1-1.7-2.9-3.3-.6.4-3.3-2.5-2.3 1.6-3-.9-3.3 3-1.5 1-3.2 3.3.4z" />
      <path
        d="M8.5 12.5l2.4 2.4 4.6-4.9"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

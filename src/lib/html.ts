// HTML escaping for values interpolated into the raw HTML email templates in
// src/lib/email.ts. Several of those values are user-controlled: buyer names
// come off the public checkout form, and event titles, ticket type names and
// business names are set by organizers. Without escaping, an organizer could
// inject markup (a fake "reset your password" link, say) into an email a
// buyer receives from the Zivotix domain.
//
// Lives in its own module with no dependencies so it can be unit tested
// directly, without pulling in the email client.
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

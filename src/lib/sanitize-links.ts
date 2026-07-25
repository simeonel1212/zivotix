import type { EventLink } from "./types";

// Organizer-supplied links are rendered as real anchors on the public event
// page, so this is an XSS boundary: only keep entries with a label and a
// proper http(s) URL, and drop anything else (javascript:, data:, empty
// rows). Also caps the count and label length so the event page can't be
// stuffed with dozens of links.
//
// Lives in its own dependency-free module so it can be unit tested directly
// rather than only through the API route.
export function sanitizeLinks(links: { label: string; url: string }[] | undefined): EventLink[] {
  return (links ?? [])
    .map((l) => ({
      label: String(l?.label ?? "").trim().slice(0, 60),
      url: String(l?.url ?? "").trim(),
    }))
    .filter((l) => l.label && /^https?:\/\//i.test(l.url))
    .slice(0, 4);
}

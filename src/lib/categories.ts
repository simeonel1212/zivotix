// Fixed set of event categories buyers can browse/filter by. Stored as plain
// text on events.category (validated against this list server-side) rather
// than a DB enum, so adding a new category later is a one-line change here.
export const EVENT_CATEGORIES = [
  { value: "music", label: "Music & Concerts" },
  { value: "nightlife", label: "Nightlife & Parties" },
  { value: "comedy", label: "Comedy" },
  { value: "arts", label: "Arts & Theatre" },
  { value: "business", label: "Business & Conferences" },
  { value: "sports", label: "Sports & Fitness" },
  { value: "food", label: "Food & Drink" },
  { value: "community", label: "Community & Culture" },
  { value: "other", label: "Other" },
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number]["value"];

const LABELS: Record<string, string> = Object.fromEntries(EVENT_CATEGORIES.map((c) => [c.value, c.label]));

export function categoryLabel(value: string): string {
  return LABELS[value] ?? "Other";
}

export function isValidCategory(value: unknown): value is EventCategory {
  return typeof value === "string" && value in LABELS;
}

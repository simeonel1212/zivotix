// Builds a Google Maps search URL from whatever location fields an event
// has. No API key needed — this just opens Maps with a text search, which
// works fine since we only ever store venue/city/country as free text.
export function googleMapsUrl(venue?: string | null, city?: string | null, country?: string | null): string | null {
  const parts = [venue, city, country].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
}

// Embeddable map preview (the classic "output=embed" trick) — shows an
// actual map on the page itself instead of just a link out to Maps. No API
// key needed, same as googleMapsUrl above.
export function googleMapsEmbedUrl(venue?: string | null, city?: string | null, country?: string | null): string | null {
  const parts = [venue, city, country].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(parts.join(", "))}&output=embed`;
}

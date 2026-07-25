import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidCategory } from "@/lib/categories";
import { sanitizeLinks } from "@/lib/sanitize-links";

interface TicketTypeInput {
  name: string;
  price: number;
  quantity_total: number;
  max_per_order: number;
}

interface CreateEventBody {
  title: string;
  description: string;
  venue: string;
  city: string;
  startsAt: string;
  currency: string;
  category?: string;
  coverImageUrl?: string;
  logoImageUrl?: string;
  galleryImageUrls?: string[];
  links?: { label: string; url: string }[];
  status: "draft" | "published";
  isUnlisted?: boolean;
  ticketTypes: TicketTypeInput[];
}

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 7)
  );
}

// Uses the user's own session (not the service role) — RLS's `events_owner_all`
// policy already restricts writes to the organizer's own rows, so this just
// works without needing to re-check ownership manually.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: organizer } = await supabase
    .from("organizers")
    .select("*")
    .eq("profile_id", user.id)
    .single();
  if (!organizer) return NextResponse.json({ error: "No organizer profile" }, { status: 403 });

  const body = (await req.json()) as CreateEventBody;
  if (!body.title || !body.startsAt || !body.ticketTypes?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      organizer_id: organizer.id,
      title: body.title,
      slug: slugify(body.title),
      description: body.description || null,
      venue: body.venue || null,
      city: body.city || null,
      country: organizer.country,
      currency: body.currency,
      category: isValidCategory(body.category) ? body.category : "other",
      cover_image_url: body.coverImageUrl || null,
      logo_image_url: body.logoImageUrl || null,
      gallery_image_urls: body.galleryImageUrls ?? [],
      links: sanitizeLinks(body.links),
      starts_at: body.startsAt,
      status: body.status,
      is_unlisted: body.isUnlisted === true,
    })
    .select()
    .single();

  if (error || !event) {
    return NextResponse.json({ error: error?.message ?? "Could not create event" }, { status: 500 });
  }

  const { error: ttError } = await supabase.from("ticket_types").insert(
    body.ticketTypes.map((tt) => ({
      event_id: event.id,
      name: tt.name,
      price: tt.price,
      quantity_total: tt.quantity_total,
      max_per_order: tt.max_per_order || 10,
    }))
  );
  if (ttError) {
    return NextResponse.json({ error: ttError.message }, { status: 500 });
  }

  return NextResponse.json({ event });
}

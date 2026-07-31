import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EventRow, TicketType } from "@/lib/types";

// Duplicates an event into a fresh draft.
//
// The point is recurring events: a monthly supper club, a weekly party, a
// quarterly showcase. Rebuilding the same listing from scratch every time —
// description, venue, images, links, tiers — is the single most tedious thing
// an organizer does on a ticketing platform.
//
// Runs on the caller's own session, so RLS's events_owner_all policy decides
// what they're allowed to read and write. No manual ownership check needed.

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 7)
  );
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: source } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle<EventRow>();
  // RLS means a missing row and a row they don't own are indistinguishable
  // here, which is the correct behaviour — don't confirm someone else's event
  // exists.
  if (!source) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { startsAt?: string; title?: string };

  // Default to the same time four weeks on. Most recurring events are monthly
  // or four-weekly, and a date in the future is safer than copying a date
  // that's already passed.
  const fallback = new Date(source.starts_at);
  fallback.setDate(fallback.getDate() + 28);
  const startsAt = body.startsAt ? new Date(body.startsAt).toISOString() : fallback.toISOString();

  if (Number.isNaN(new Date(startsAt).getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const title = (body.title ?? source.title).trim() || source.title;

  const { data: copy, error } = await supabase
    .from("events")
    .insert({
      organizer_id: source.organizer_id,
      title,
      slug: slugify(title),
      description: source.description,
      venue: source.venue,
      city: source.city,
      country: source.country,
      currency: source.currency,
      category: source.category,
      cover_image_url: source.cover_image_url,
      cover_aspect: source.cover_aspect,
      logo_image_url: source.logo_image_url,
      gallery_image_urls: source.gallery_image_urls ?? [],
      links: source.links ?? [],
      is_unlisted: source.is_unlisted,
      absorb_service_fee: source.absorb_service_fee,
      starts_at: startsAt,
      ends_at: null,
      // Always a draft, never published. A duplicate goes on sale the moment
      // the organizer has checked the date and the prices — not the moment
      // they clicked a button.
      status: "draft",
    })
    .select()
    .single<EventRow>();

  if (error || !copy) {
    return NextResponse.json({ error: error?.message ?? "Could not duplicate event" }, { status: 500 });
  }

  const { data: tiers } = await supabase
    .from("ticket_types")
    .select("name, category, description, price, quantity_total, max_per_order")
    .eq("event_id", id)
    .returns<Pick<TicketType, "name" | "category" | "description" | "price" | "quantity_total" | "max_per_order">[]>();

  if (tiers?.length) {
    const { error: ttError } = await supabase.from("ticket_types").insert(
      tiers.map((tt) => ({
        event_id: copy.id,
        name: tt.name,
        category: tt.category,
        description: tt.description,
        price: tt.price,
        quantity_total: tt.quantity_total,
        // Sold counts never carry over — that's the whole point of a new event.
        quantity_sold: 0,
        max_per_order: tt.max_per_order,
      }))
    );
    if (ttError) {
      // The event exists but has no tiers, which is a half-finished draft
      // rather than a broken one. Roll it back so the organizer doesn't have
      // to notice and clean up after us.
      await supabase.from("events").delete().eq("id", copy.id);
      return NextResponse.json({ error: ttError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ event: copy, tierCount: tiers?.length ?? 0 });
}

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { isReservedHandle } from "@/lib/handles";

// zivotix.site/eden → the organizer's public page.
//
// A top-level dynamic segment, so it catches anything Next.js hasn't already
// matched to a real route. Static routes win resolution, so /events and
// /community are never affected by this file.
//
// It redirects rather than rendering a copy of the profile: two URLs rendering
// the same content splits search ranking and doubles the maintenance. The
// handle is the pretty front door; /community/<id> stays the address.
async function lookup(handle: string) {
  if (isReservedHandle(handle)) return null;
  const { data } = await createServiceClient()
    .from("organizers")
    .select("id, business_name")
    .eq("handle", handle.toLowerCase())
    .maybeSingle<{ id: string; business_name: string }>();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const organizer = await lookup(handle);
  if (!organizer) return { title: "Not found" };
  return {
    title: organizer.business_name,
    description: `Tickets, passes and updates from ${organizer.business_name} on Zivotix.`,
    alternates: { canonical: `/community/${organizer.id}` },
  };
}

export default async function HandlePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const organizer = await lookup(handle);
  if (!organizer) notFound();
  redirect(`/community/${organizer.id}`);
}

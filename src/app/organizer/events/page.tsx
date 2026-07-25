import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";

export default async function OrganizerEventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: organizer } = await supabase
    .from("organizers")
    .select("id")
    .eq("profile_id", user!.id)
    .single();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("organizer_id", organizer?.id)
    .order("starts_at", { ascending: false })
    .returns<EventRow[]>();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">My events</h1>
          <p className="text-sm text-neutral-500 mt-1">Create, publish, and track every event you run.</p>
        </div>
        <Link href="/organizer/events/new" className="zv-btn-primary">
          New event
        </Link>
      </div>

      {(!events || events.length === 0) && (
        <div className="zv-card p-16 text-center">
          <p className="text-neutral-400">You haven&apos;t created any events yet.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {events?.map((event) => (
          <Link key={event.id} href={`/organizer/events/${event.id}`} className="zv-card zv-card-hover block overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-yellow-100 via-yellow-50 to-white relative">
              {event.cover_image_url && (
                <Image
                  src={event.cover_image_url}
                  alt={event.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
              )}
              <span
                className={`absolute top-3 right-3 zv-badge ${
                  event.status === "published"
                    ? "bg-emerald-500 text-white"
                    : event.status === "draft"
                    ? "bg-white/90 text-neutral-600"
                    : "bg-red-500 text-white"
                }`}
              >
                {event.status}
              </span>
            </div>
            <div className="p-5 flex items-start gap-3">
              {event.logo_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.logo_image_url}
                  alt={`${event.title} logo`}
                  className="h-10 w-10 rounded-xl object-cover ring-1 ring-neutral-200/70 shadow-sm shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-neutral-900">{event.title}</p>
                <p className="text-sm text-neutral-400 mt-0.5">
                  {new Date(event.starts_at).toLocaleDateString()} · {event.city}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

import type { EventRow } from "@/lib/types";
import { getCurrentOrganizer } from "@/lib/organizer";
import NoOrganizerNotice from "@/components/no-organizer-notice";
import AddStaffForm from "./add-staff-form";
import RemoveStaffButton from "./remove-staff-button";

export default async function OrganizerStaffPage() {
  const { supabase, organizer } = await getCurrentOrganizer("/organizer/staff");
  if (!organizer) return <NoOrganizerNotice title="Door staff" />;

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("organizer_id", organizer.id)
    .returns<EventRow[]>();

  const { data: staff } = await supabase
    .from("event_staff")
    .select("id, event_id, profiles(email, full_name)")
    .eq("organizer_id", organizer.id);

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Door staff</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Staff open a link on their phone browser, no app needed, and scan tickets at the door.
        </p>
      </div>

      <div className="zv-card p-6">
        <AddStaffForm events={events ?? []} />
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-3">Current staff</h2>
        {(!staff || staff.length === 0) ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">No staff added yet.</p>
          </div>
        ) : (
          <div className="zv-card divide-y divide-neutral-100 overflow-hidden">
            {staff.map((s) => {
              const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
              const event = events?.find((e) => e.id === s.event_id);
              return (
                <div key={s.id} className="flex items-center justify-between px-5 py-3.5 text-sm gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-800">{profile?.full_name ?? profile?.email}</p>
                    <p className="text-neutral-400">{profile?.email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-neutral-500">{event ? event.title : "All events"}</span>
                    <RemoveStaffButton staffId={s.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Removes a door-staff assignment. RLS's `event_staff_owner_all` policy
// already scopes deletes to rows the calling organizer owns, so this is a
// plain client-side delete — no dedicated API route needed.
export default function RemoveStaffButton({ staffId }: { staffId: string }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (!confirm("Remove this person's scanner access?")) return;
    setRemoving(true);
    const { error } = await createClient().from("event_staff").delete().eq("id", staffId);
    setRemoving(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={removing}
      aria-label="Remove staff"
      className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-40 p-1 -m-1"
    >
      {removing ? (
        <span className="text-xs">Removing…</span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Direct client-side update, gated by the organizers_admin_all RLS policy —
// same pattern as the delete-post-button style admin/organizer controls
// elsewhere in the app, no dedicated API route needed since this is a plain
// RLS-scoped write with nothing external to call.
export default function VerifyOrganizerButton({
  organizerId,
  isVerified,
}: {
  organizerId: string;
  isVerified: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const { error } = await createClient()
      .from("organizers")
      .update({ is_verified: !isVerified })
      .eq("id", organizerId);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`zv-badge transition-colors disabled:opacity-40 ${
        isVerified ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
      }`}
    >
      {isVerified ? "Remove verification" : "Mark verified"}
    </button>
  );
}

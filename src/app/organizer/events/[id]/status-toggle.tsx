"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventStatus } from "@/lib/types";

export default function StatusToggle({ eventId, status }: { eventId: string; status: EventStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const next = status === "published" ? "draft" : "published";
    await createClient().from("events").update({ status: next }).eq("id", eventId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={toggle} disabled={loading} className="zv-btn-secondary shrink-0">
      {status === "published" ? "Unpublish" : "Publish"}
    </button>
  );
}

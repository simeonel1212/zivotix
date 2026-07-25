"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CoverImageUpload from "@/components/cover-image-upload";

export default function CoverEditor({ eventId, initialUrl }: { eventId: string; initialUrl: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);

  async function save(newUrl: string) {
    setUrl(newUrl);
    await createClient().from("events").update({ cover_image_url: newUrl }).eq("id", eventId);
    router.refresh();
  }

  return <CoverImageUpload value={url} onChange={save} />;
}

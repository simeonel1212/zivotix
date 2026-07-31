"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CoverImageUpload from "@/components/cover-image-upload";
import { measureAspect } from "@/lib/image-aspect";

export default function CoverEditor({ eventId, initialUrl }: { eventId: string; initialUrl: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);

  async function save(newUrl: string) {
    setUrl(newUrl);
    // Measured here, in the browser, because this is the only place the real
    // pixel dimensions are cheaply available — the server would have to
    // download and decode the file to learn the same thing. Null is fine; the
    // event page falls back to a portrait frame.
    const aspect = await measureAspect(newUrl);
    await createClient()
      .from("events")
      .update({ cover_image_url: newUrl, cover_aspect: aspect })
      .eq("id", eventId);
    router.refresh();
  }

  return <CoverImageUpload value={url} onChange={save} />;
}

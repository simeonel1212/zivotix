"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GalleryUpload from "@/components/gallery-upload";

export default function GalleryEditor({ eventId, initialUrls }: { eventId: string; initialUrls: string[] }) {
  const router = useRouter();
  const [urls, setUrls] = useState(initialUrls);

  async function save(newUrls: string[]) {
    setUrls(newUrls);
    await createClient().from("events").update({ gallery_image_urls: newUrls }).eq("id", eventId);
    router.refresh();
  }

  return <GalleryUpload value={urls} onChange={save} />;
}

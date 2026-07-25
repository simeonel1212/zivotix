"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoImageUpload from "@/components/logo-image-upload";

export default function LogoEditor({ eventId, initialUrl }: { eventId: string; initialUrl: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);

  async function save(newUrl: string) {
    setUrl(newUrl);
    await createClient().from("events").update({ logo_image_url: newUrl }).eq("id", eventId);
    router.refresh();
  }

  return <LogoImageUpload value={url} onChange={save} />;
}

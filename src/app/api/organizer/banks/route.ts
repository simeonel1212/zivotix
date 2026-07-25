import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listBanks } from "@/lib/paystack";

// Backs the bank dropdown on the organizer settings page. Requires the
// Paystack secret key, so it's fetched server-side and proxied here rather
// than calling Paystack directly from the browser.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const banks = await listBanks();
    return NextResponse.json({ banks });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load banks" }, { status: 500 });
  }
}

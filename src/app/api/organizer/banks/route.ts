import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listBanks } from "@/lib/paystack";

// Backs the bank dropdown on the organizer settings page. Requires the
// Paystack secret key, so it's fetched server-side and proxied here rather
// than calling Paystack directly from the browser.
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Read the country off the organizer record rather than trusting a query
  // param — otherwise anyone signed in could enumerate bank lists for markets
  // they aren't in.
  const { data: organizer } = await supabase
    .from("organizers")
    .select("country")
    .eq("profile_id", user.id)
    .maybeSingle<{ country: string }>();

  try {
    const banks = await listBanks(organizer?.country ?? "NG");
    return NextResponse.json({ banks });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load banks" }, { status: 500 });
  }
}

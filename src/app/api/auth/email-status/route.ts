import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Supabase's signUp() deliberately returns a fake "success" (no error, no
// real email sent) when the email already has a CONFIRMED account — this
// stops attackers from probing which emails are registered. That's correct
// security behavior, but it means our own signup form can't tell a genuine
// new signup apart from this silent no-op, and users get stuck staring at
// a "check your email" screen for a code that was never sent. This route
// runs a server-side lookup (service role, bypasses that obfuscation) so
// the UI can short-circuit with a clear "you already have an account"
// message instead of pretending to send a code.
export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string };
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const service = createServiceClient();
  // listUsers doesn't support filtering by exact email in older SDK versions,
  // so page through — signups are low-volume enough that this is fine.
  let confirmed = false;
  let exists = false;
  let page = 1;
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      exists = true;
      confirmed = !!match.email_confirmed_at;
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  return NextResponse.json({ exists, confirmed });
}

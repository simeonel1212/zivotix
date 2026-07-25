import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountNumber } from "@/lib/paystack";
import type { BankAccount } from "@/lib/types";

// Saves the calling organizer's payout bank account. NG accounts are verified
// against Paystack before saving (catches a mistyped account number before it
// can cause a misdirected transfer later); TH accounts are recorded as-is
// since payouts there are a manual wire, not a Paystack transfer.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: organizer } = await supabase
    .from("organizers")
    .select("id, country")
    .eq("profile_id", user.id)
    .single();
  if (!organizer) return NextResponse.json({ error: "No organizer account found" }, { status: 403 });

  const body = await req.json();

  let bankAccount: BankAccount;

  if (organizer.country === "NG") {
    const { bank_code, bank_name, account_number } = body as {
      bank_code: string;
      bank_name: string;
      account_number: string;
    };
    if (!bank_code || !bank_name || !account_number) {
      return NextResponse.json({ error: "Bank and account number are required" }, { status: 400 });
    }
    try {
      const resolved = await resolveAccountNumber(account_number, bank_code);
      bankAccount = {
        bank_name,
        bank_code,
        account_number: resolved.account_number,
        account_name: resolved.account_name,
      };
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Couldn't verify that account number" },
        { status: 400 }
      );
    }
  } else {
    const { bank_name, swift, account_number, account_name } = body as {
      bank_name: string;
      swift: string;
      account_number: string;
      account_name: string;
    };
    if (!bank_name || !account_number || !account_name) {
      return NextResponse.json({ error: "Bank, account number, and account name are required" }, { status: 400 });
    }
    bankAccount = { bank_name, swift, account_number, account_name };
  }

  const { error } = await supabase
    .from("organizers")
    .update({ bank_account: bankAccount })
    .eq("id", organizer.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, bank_account: bankAccount });
}

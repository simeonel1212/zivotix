"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Organizer } from "@/lib/types";
import { payoutMethod } from "@/lib/countries";

export default function BankAccountForm({ organizer }: { organizer: Organizer }) {
  const router = useRouter();
  // Paystack settles into NG, GH, ZA and KE — those get a bank dropdown and
  // account-name verification. Everywhere else collects SWIFT wire details.
  const isNG = payoutMethod(organizer.country) === "paystack";
  const saved = organizer.bank_account;

  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [banksLoading, setBanksLoading] = useState(isNG);
  const [bankCode, setBankCode] = useState(saved?.bank_code ?? "");
  const [bankName, setBankName] = useState(saved?.bank_name ?? "");
  const [accountNumber, setAccountNumber] = useState(saved?.account_number ?? "");
  const [accountName, setAccountName] = useState(saved?.account_name ?? "");
  const [swift, setSwift] = useState(saved?.swift ?? "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNow, setSavedNow] = useState<typeof saved>(null);

  useEffect(() => {
    if (!isNG) return;
    fetch("/api/organizer/banks")
      .then((res) => res.json())
      .then((data) => {
        if (data.banks) setBanks(data.banks);
      })
      .finally(() => setBanksLoading(false));
  }, [isNG]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSavedNow(null);

    const body = isNG
      ? { bank_code: bankCode, bank_name: bankName, account_number: accountNumber }
      : { bank_name: bankName, swift, account_number: accountNumber, account_name: accountName };

    const res = await fetch("/api/organizer/bank-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }
    setSavedNow(data.bank_account);
    if (isNG) setAccountName(data.bank_account.account_name);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="zv-card p-6 space-y-5">
      {isNG ? (
        <>
          <div className="space-y-1.5">
            <label className="zv-label">Bank</label>
            <select
              required
              value={bankCode}
              onChange={(e) => {
                setBankCode(e.target.value);
                setBankName(e.target.options[e.target.selectedIndex].text);
              }}
              className="zv-input"
              disabled={banksLoading}
            >
              <option value="">{banksLoading ? "Loading banks…" : "Select your bank"}</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="zv-label">Account number</label>
            <input
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="zv-input"
              placeholder="0123456789"
            />
          </div>

          {accountName && (
            <p className="text-sm text-neutral-400">
              Verified account name: <span className="font-medium text-neutral-100">{accountName}</span>
            </p>
          )}
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="zv-label">Bank name</label>
            <input
              required
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="zv-input"
              placeholder="Kasikornbank"
            />
          </div>
          <div className="space-y-1.5">
            <label className="zv-label">SWIFT / BIC code</label>
            <input value={swift} onChange={(e) => setSwift(e.target.value)} className="zv-input" placeholder="KASITHBK" />
          </div>
          <div className="space-y-1.5">
            <label className="zv-label">Account number</label>
            <input
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="zv-input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="zv-label">Account name</label>
            <input
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="zv-input"
            />
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {savedNow && <p className="text-sm text-emerald-400">Bank details saved.</p>}

      <button type="submit" disabled={loading} className="zv-btn-primary disabled:opacity-40">
        {loading ? "Saving…" : "Save bank details"}
      </button>
    </form>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { countryFlag, countryLabel } from "@/lib/countries";

// Country selector for the events list.
//
// Options are derived from the events actually on sale rather than from a
// fixed list — an empty "Japan" option that always returns nothing is worse
// than no option at all. "Global" is the default and stays first, because most
// people browsing want to see everything.
export default function CountryFilter({ countries }: { countries: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("country") ?? "";

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("country", value);
    else next.delete("country");
    router.push(`/events${next.toString() ? `?${next}` : ""}`);
  }

  // One country on the platform means the control is decoration. Hide it until
  // there's a genuine choice to make.
  if (countries.length < 2) return null;

  return (
    <label className="relative inline-flex items-center shrink-0">
      <span className="sr-only">Filter by country</span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="zv-input appearance-none w-auto pr-10 py-2.5 text-sm font-medium cursor-pointer"
      >
        <option value="">🌍 Global</option>
        {countries.map((c) => (
          <option key={c} value={c}>
            {countryFlag(c)} {countryLabel(c)}
          </option>
        ))}
      </select>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 text-neutral-500"
      >
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

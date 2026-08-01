import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import DashboardSidebar from "@/components/dashboard-sidebar";

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/organizer/dashboard");

  const { data: organizer } = await supabase
    .from("organizers")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const links = [
    { href: "/organizer/dashboard", label: "Dashboard", icon: "home" },
    { href: "/organizer/analytics", label: "Analytics", icon: "chart" },
    { href: "/organizer/events", label: "My events", icon: "ticket" },
    { href: "/organizer/events/new", label: "New event", icon: "plus" },
    { href: "/scan", label: "Scan tickets", icon: "scan" },
    { href: "/scanner-app", label: "Get the app", icon: "download" },
    { href: "/organizer/staff", label: "Door staff", icon: "users" },
    { href: "/organizer/community", label: "Community", icon: "megaphone" },
    { href: "/organizer/memberships", label: "Memberships", icon: "star" },
    { href: "/organizer/merch", label: "Merch", icon: "bag" },
    { href: "/organizer/settings", label: "Payout details", icon: "card" },
    ...(profile?.role === "admin" ? [{ href: "/admin/payouts", label: "Platform admin", icon: "shield" }] : []),
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-[var(--background)]">
      <DashboardSidebar
        brandTitle={organizer?.business_name ?? "Organizer"}
        brandSubtitle={`${organizer?.country ?? ""} · payouts in ${organizer?.payout_currency ?? ""}`}
        links={links}
        footer={<SignOutButton />}
      />
      <div className="flex-1 p-6 sm:p-10">{children}</div>
    </div>
  );
}

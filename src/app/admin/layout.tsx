import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import DashboardSidebar from "@/components/dashboard-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/payouts");

  // This admin may also personally own an organizer (e.g. the platform's
  // own events, or a dual-role test account) — if so, surface a link over
  // to their organizer panel since it's otherwise unreachable from here.
  const { data: ownOrganizer } = await supabase
    .from("organizers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  const links = [
    { href: "/admin/payouts", label: "Weekly payouts", icon: "cash" },
    { href: "/admin/organizers", label: "Organizers", icon: "building" },
    ...(ownOrganizer ? [{ href: "/organizer/dashboard", label: "My events (organizer view)", icon: "ticket" }] : []),
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-[var(--background)]">
      <DashboardSidebar brandTitle="Platform admin" links={links} footer={<SignOutButton />} />
      <div className="flex-1 p-6 sm:p-10">{children}</div>
    </div>
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Route protection by role:
//   /organizer/*  -> role 'organizer' or 'admin'
//   /admin/*      -> role 'admin'
//   /scan/*       -> role 'door_staff', 'organizer', or 'admin'
// Everything else (event browsing, checkout, login) is public.
export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const needsAuth =
    path.startsWith("/organizer") || path.startsWith("/admin") || path.startsWith("/scan");

  if (!needsAuth) return response;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  const allowed =
    (path.startsWith("/organizer") && (role === "organizer" || role === "admin")) ||
    (path.startsWith("/admin") && role === "admin") ||
    (path.startsWith("/scan") && (role === "door_staff" || role === "organizer" || role === "admin"));

  if (!allowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/organizer/:path*", "/admin/:path*", "/scan/:path*"],
};

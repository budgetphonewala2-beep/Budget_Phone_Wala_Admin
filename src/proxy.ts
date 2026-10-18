import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/auth/callback", "/privacy", "/terms", "/delete-account", "/open-app"];

// Refreshes the Supabase session cookie and keeps signed-out visitors on /login.
// This is a convenience gate only: authorization is enforced by RLS and has_permission() in the database.
export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (all) => {
        all.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        all.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const isPublic = PUBLIC.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!data.user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

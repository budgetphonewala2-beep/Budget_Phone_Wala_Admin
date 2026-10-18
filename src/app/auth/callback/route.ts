import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// OAuth / email-link landing route. Exchanges the one-time code for a session cookie.
// Allowed in Supabase Auth > URL Configuration: http://localhost:3000/** (and the production admin origin).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  // only same-site relative paths, never an open redirect
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(dest, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}

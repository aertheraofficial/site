import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseConfigured = Boolean(supabaseUrl?.trim() && supabaseAnonKey?.trim());

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!supabaseConfigured) {
    // Supabase not set up yet — block /account (except login/register)
    const { pathname } = request.nextUrl;
    if (
      pathname.startsWith("/account") &&
      !pathname.startsWith("/account/login") &&
      !pathname.startsWith("/account/register")
    ) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/account/login";
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh session so it doesn't expire mid-visit
  await supabase.auth.getUser();

  // Protect /account — redirect to login if not authenticated
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/account") &&
    !pathname.startsWith("/account/login") &&
    !pathname.startsWith("/account/register")
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/account/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets|admin|api/admin).*)",
  ],
};

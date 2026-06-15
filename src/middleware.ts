import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { APP_URLS } from "~/constants/app-urls";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === APP_URLS.LOGIN ||
    pathname === APP_URLS.REGISTER ||
    pathname === APP_URLS.FORGOT_PASSWORD ||
    pathname === APP_URLS.RESET_PASSWORD ||
    pathname.startsWith(APP_URLS.AUTH_PREFIX);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = APP_URLS.LOGIN;
    return NextResponse.redirect(url);
  }

  if (user && (pathname === APP_URLS.LOGIN || pathname === APP_URLS.REGISTER)) {
    const url = request.nextUrl.clone();
    url.pathname = APP_URLS.DASHBOARD;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

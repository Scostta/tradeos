import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { APP_URLS } from "~/constants/app-urls";
import { ACTIVE_MODULE_COOKIE, MODULE_HOME, parseModule } from "~/helpers/active-module";

// Proxy de Next 16 (antes middleware): sesión de Supabase, rutas públicas y
// redirección de "/" al último módulo. Corre siempre en Node.js.
export async function proxy(request: NextRequest) {
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

  // Las rutas de los módulos (/dashboard…, /invest, /money) son privadas por
  // no estar aquí. "/" sin sesión va a /login; con sesión, al home del último
  // módulo visitado (cookie active_module), igual que tras el login.
  const isPublic =
    pathname === APP_URLS.LOGIN ||
    pathname === APP_URLS.REGISTER ||
    pathname === APP_URLS.FORGOT_PASSWORD ||
    pathname === APP_URLS.RESET_PASSWORD ||
    pathname.startsWith(APP_URLS.AUTH_PREFIX) ||
    pathname.startsWith(APP_URLS.SHARE_PREFIX) ||
    pathname.startsWith(APP_URLS.INGEST_PREFIX) ||
    pathname === APP_URLS.INVEST_NOTIFY;

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = APP_URLS.LOGIN;
    return NextResponse.redirect(url);
  }

  if (user && (pathname === APP_URLS.HOME || pathname === APP_URLS.LOGIN || pathname === APP_URLS.REGISTER)) {
    const url = request.nextUrl.clone();
    url.pathname = MODULE_HOME[parseModule(request.cookies.get(ACTIVE_MODULE_COOKIE)?.value) ?? "trading"];
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Exclude framework assets and the public PWA resources (manifest, service
    // worker, generated icons, offline page). These must be reachable without a
    // session — the browser fetches the manifest/icons without credentials, so
    // letting the proxy redirect them to /login breaks installability.
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|offline\\.html|apple-icon|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

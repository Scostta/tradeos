import { APP_URLS } from "~/constants/app-urls"

// TradeOS son tres módulos con login, diseño y despliegue comunes. El módulo
// de una ruta se deriva del pathname; las rutas compartidas (/settings) no
// pertenecen a ninguno y muestran el último módulo visitado.
export type AppModule = "trading" | "invest" | "money"

export const APP_MODULES: readonly AppModule[] = ["trading", "invest", "money"]

export const MODULE_HOME: Record<AppModule, string> = {
  trading: APP_URLS.DASHBOARD,
  invest:  APP_URLS.INVEST,
  money:   APP_URLS.MONEY,
}

// Último módulo visitado, en cookie para que también lo lea el servidor: el
// middleware manda "/" y el login a su home, y el layout lo usa en las rutas
// compartidas.
export const ACTIVE_MODULE_COOKIE = "active_module"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const SHARED_PREFIXES = [APP_URLS.SETTINGS]

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Módulo dueño de la ruta, o null si es compartida. */
export function getRouteModule(pathname: string): AppModule | null {
  if (isUnder(pathname, APP_URLS.INVEST_PREFIX)) return "invest"
  if (isUnder(pathname, APP_URLS.MONEY_PREFIX)) return "money"
  if (SHARED_PREFIXES.some(prefix => isUnder(pathname, prefix))) return null
  return "trading"
}

/** Módulo a mostrar: el de la ruta, o el último visitado en rutas compartidas. */
export function getActiveModule(pathname: string, last: AppModule = "trading"): AppModule {
  return getRouteModule(pathname) ?? last
}

/** Valor de la cookie → módulo, o null si no es uno válido. */
export function parseModule(value: string | null | undefined): AppModule | null {
  return APP_MODULES.find(m => m === value) ?? null
}

/** Guarda el último módulo (solo en el navegador). */
export function rememberModule(module: AppModule): void {
  document.cookie = `${ACTIVE_MODULE_COOKIE}=${module}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
}

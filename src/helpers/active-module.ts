import { APP_URLS } from "~/constants/app-urls"

// TradeOS son tres módulos con login, diseño y despliegue comunes. El módulo
// activo se deriva solo del pathname; las rutas compartidas (/settings) y las
// de Trading caen en "trading".
export type AppModule = "trading" | "invest" | "money"

export const APP_MODULES: readonly AppModule[] = ["trading", "invest", "money"]

export const MODULE_HOME: Record<AppModule, string> = {
  trading: APP_URLS.DASHBOARD,
  invest:  APP_URLS.INVEST,
  money:   APP_URLS.MONEY,
}

// Último módulo visitado: solo para que "/" redirija a su home.
export const ACTIVE_MODULE_STORAGE_KEY = "active_module"

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function getActiveModule(pathname: string): AppModule {
  if (isUnder(pathname, APP_URLS.INVEST_PREFIX)) return "invest"
  if (isUnder(pathname, APP_URLS.MONEY_PREFIX)) return "money"
  return "trading"
}

/** Valor guardado en localStorage → módulo, o null si no es uno válido. */
export function parseModule(value: string | null): AppModule | null {
  return APP_MODULES.find(m => m === value) ?? null
}

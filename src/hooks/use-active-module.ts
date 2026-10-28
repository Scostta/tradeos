"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { getRouteModule, rememberModule } from "~/helpers/active-module"
import type { AppModule } from "~/helpers/active-module"

/**
 * Módulo activo del shell. En una ruta de módulo es ese; en una compartida
 * (/settings) es el último visitado: el de la cookie al cargar (`initial`, lo
 * lee el layout) y después el de la última ruta de módulo de esta sesión.
 */
export function useActiveModule(initial: AppModule): AppModule {
  const routeModule = getRouteModule(usePathname())
  const [last, setLast] = useState<AppModule>(initial)

  // Estado derivado del render anterior (no un efecto): el layout no se vuelve
  // a renderizar al navegar, así que `initial` no se actualiza solo.
  if (routeModule && routeModule !== last) setLast(routeModule)

  useEffect(() => {
    if (routeModule) rememberModule(routeModule)
  }, [routeModule])

  return routeModule ?? last
}

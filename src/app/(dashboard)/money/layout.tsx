import type { ReactElement, ReactNode } from "react"
import { getExpenseCategoryUsage, getFinanceCategories, getFinanceSettings } from "~/services/queries/finance"
import { MoneyBottomBar } from "./components/money-bottom-bar.client"

// Rutas de Money. Añade la barra inferior de móvil (§5.7 M1) una vez dado de
// alta Money; el `h-full` de cada página mide lo que queda encima de ella.
export default async function MoneyLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  const settings = await getFinanceSettings()
  const ready = settings.success && settings.data != null
  const [categories, usage] = ready
    ? await Promise.all([getFinanceCategories(), getExpenseCategoryUsage(new Date().toISOString().slice(0, 10))])
    : [null, null]

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      {categories?.success && (
        <MoneyBottomBar categories={categories.data} usage={usage?.success ? usage.data : []} />
      )}
    </>
  )
}

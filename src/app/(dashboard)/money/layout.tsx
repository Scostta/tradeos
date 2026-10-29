import type { ReactElement, ReactNode } from "react"
import { getExpenseCategoryUsage, getFinanceCategories, getFinanceSettings } from "~/services/queries/finance"
import { CashSheetProvider } from "./components/cash-sheet.client"
import { MoneyBottomBar } from "./components/money-bottom-bar.client"

// Rutas de Money. Una vez dado de alta Money añade el alta de efectivo (§5.7
// M2, hoja en móvil y modal en escritorio) y la barra inferior de móvil (M1);
// el `h-full` de cada página mide lo que queda encima de ella.
export default async function MoneyLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  const settings = await getFinanceSettings()
  const ready = settings.success && settings.data != null
  const [categories, usage] = ready
    ? await Promise.all([getFinanceCategories(), getExpenseCategoryUsage(new Date().toISOString().slice(0, 10))])
    : [null, null]

  if (!categories?.success) return <div className="flex-1 min-h-0 flex flex-col">{children}</div>
  return (
    <CashSheetProvider categories={categories.data} usage={usage?.success ? usage.data : []}>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      <MoneyBottomBar />
    </CashSheetProvider>
  )
}

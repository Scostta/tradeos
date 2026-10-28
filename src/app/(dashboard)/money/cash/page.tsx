import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import { getExpenseCategoryUsage, getFinanceCategories, getFinanceSettings } from "~/services/queries/finance"
import { MoneyOnboarding } from "../components/money-onboarding.client"
import { CashPage } from "./components/cash-page.client"

// §5.7 M2 como página (enlace directo). En móvil lo normal es el "+" de la
// barra inferior, que abre el mismo formulario como hoja.
export default async function MoneyCashPage(): Promise<ReactElement> {
  const settingsResult = await getFinanceSettings()
  if (settingsResult.success && !settingsResult.data) {
    return <div className="flex flex-col h-full"><MoneyOnboarding /></div>
  }
  const today = new Date().toISOString().slice(0, 10)
  const [categoriesResult, usageResult] = await Promise.all([getFinanceCategories(), getExpenseCategoryUsage(today)])
  if (!settingsResult.success || !categoriesResult.success) {
    return <div className="page-pad"><div className="card p-4 text-sm text-loss">{MONEY.ERRORS.UNKNOWN}</div></div>
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto page-pad flex justify-center">
      <div className="card p-5 w-full self-start" style={{ maxWidth: 440 }}>
        <CashPage categories={categoriesResult.data} usage={usageResult.success ? usageResult.data : []} today={today} />
      </div>
    </div>
  )
}

import type { ReactElement, ReactNode } from "react"
import {
  getCategoryUsage,
  getFinanceAccounts,
  getFinanceCategories,
  getFinanceSettings,
  getImportedThrough,
} from "~/services/queries/finance"
import { CashSheetProvider } from "./components/cash-sheet.client"
import { MoneyBottomBar } from "./components/money-bottom-bar.client"
import { MoneySidebarFooter } from "./components/money-sidebar-footer.client"

// Rutas de Money. Una vez dado de alta Money añade el alta manual (§5.7
// M2, hoja en móvil y modal en escritorio), la barra inferior de móvil (M1) y
// el pie del sidebar (§5); el `h-full` de cada página mide lo que queda encima
// de la barra.
export default async function MoneyLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  const settings = await getFinanceSettings()
  const ready = settings.success && settings.data != null
  const [categories, usage, accounts, importedThrough] = ready
    ? await Promise.all([
      getFinanceCategories(),
      getCategoryUsage(new Date().toISOString().slice(0, 10)),
      getFinanceAccounts(),
      getImportedThrough(),
    ])
    : [null, null, null, null]

  if (!categories?.success) return <div className="flex-1 min-h-0 flex flex-col">{children}</div>

  const defaultId = settings.success ? settings.data?.defaultAccount ?? null : null
  const account = accounts?.success ? accounts.data.find(a => a.id === defaultId) : undefined
  return (
    <CashSheetProvider
      categories={categories.data} usage={usage?.success ? usage.data : []}
      accounts={accounts?.success ? accounts.data : []} defaultAccountId={defaultId}
    >
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      <MoneyBottomBar />
      <MoneySidebarFooter
        account={account ? `${account.name}${account.ibanLast4 ? ` ES•• ${account.ibanLast4}` : ""}` : null}
        importedThrough={importedThrough?.success ? importedThrough.data : null}
      />
    </CashSheetProvider>
  )
}

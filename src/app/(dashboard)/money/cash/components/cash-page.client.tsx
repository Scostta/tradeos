"use client"

import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import { APP_URLS } from "~/constants/app-urls"
import type { FinanceAccount, FinanceCategory } from "~/types/finance"
import { CashForm } from "../../components/cash-form.client"

// Al guardar o cancelar se vuelve al Overview.
export function CashPage({ categories, usage, accounts, defaultAccountId, today }: {
  categories:       FinanceCategory[]
  usage:            string[]
  accounts:         FinanceAccount[]
  defaultAccountId: string | null
  today:            string
}): ReactElement {
  const router = useRouter()
  const back = () => router.push(APP_URLS.MONEY)
  return (
    <CashForm
      categories={categories} usage={usage} accounts={accounts} defaultAccountId={defaultAccountId}
      today={today} onClose={back} onSaved={back}
    />
  )
}

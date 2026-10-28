"use client"

import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import { APP_URLS } from "~/constants/app-urls"
import type { FinanceCategory } from "~/types/finance"
import { CashForm } from "../../components/cash-form.client"

// Al guardar o cancelar se vuelve al Overview.
export function CashPage({ categories, usage, today }: { categories: FinanceCategory[]; usage: string[]; today: string }): ReactElement {
  const router = useRouter()
  const back = () => router.push(APP_URLS.MONEY)
  return <CashForm categories={categories} usage={usage} today={today} onClose={back} onSaved={back} />
}

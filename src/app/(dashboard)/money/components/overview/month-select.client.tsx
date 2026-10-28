"use client"

import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import { APP_URLS } from "~/constants/app-urls"
import { INPUT_CLS } from "~/lib/ui/form"

function label(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
}

/** Mes del Overview (?month=). El mes en curso no lleva parámetro. */
export function MonthSelect({ months, value, current }: { months: string[]; value: string; current: string }): ReactElement {
  const router = useRouter()
  return (
    <select
      value={value}
      aria-label="Month"
      onChange={e => router.push(e.target.value === current ? APP_URLS.MONEY : `${APP_URLS.MONEY}?month=${e.target.value}`)}
      className={INPUT_CLS}
      style={{ width: 170 }}
    >
      {months.map(m => <option key={m} value={m}>{label(m)}</option>)}
    </select>
  )
}

"use client"

import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import { APP_URLS } from "~/constants/app-urls"
import { MONEY } from "~/constants/copies/money"
import { INPUT_CLS } from "~/lib/ui/form"

/** Año de /money/year (?year=). El año en curso no lleva parámetro. */
export function YearSelect({ years, value, current }: { years: number[]; value: number; current: number }): ReactElement {
  const router = useRouter()
  return (
    <select
      value={value}
      aria-label={MONEY.YEAR.YEAR_LABEL}
      onChange={e => {
        const y = Number(e.target.value)
        router.push(y === current ? APP_URLS.MONEY_YEAR : `${APP_URLS.MONEY_YEAR}?year=${y}`)
      }}
      className={INPUT_CLS}
      style={{ width: 110 }}
    >
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}

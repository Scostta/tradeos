"use client"

import type { ReactElement } from "react"
import Link, { useLinkStatus } from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { Spinner } from "./spinner"

function Pending(): ReactElement | null {
  const { pending } = useLinkStatus()
  return pending ? <span className="text-accent"><Spinner size={11} /></span> : null
}

// Abre la página de detalle del ticker (/invest/[ticker]) con un spinner mientras carga.
export function TickerLink({ ticker }: { ticker: string }): ReactElement {
  return (
    <Link
      href={APP_URLS.INVEST_TICKER(ticker)}
      className="inline-flex items-center gap-1.5 mono text-sm font-semibold text-text hover:text-accent"
    >
      {ticker}
      <Pending />
    </Link>
  )
}

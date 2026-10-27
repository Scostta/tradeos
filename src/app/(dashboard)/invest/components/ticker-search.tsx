import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import type { ScreenResult } from "~/types/invest"
import { TickerDetail } from "./ticker-detail"
import { TickerSearchForm } from "./ticker-search-form.client"
import { fmtDay } from "./invest-format"

type Props = {
  query:     string | null
  runDate:   string
  benchmark: string
  result:    ScreenResult | null
}

export function TickerSearch({ query, runDate, benchmark, result }: Props): ReactElement {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3.5">
        <div className="md:mr-auto">
          <div className="text-md font-semibold text-text">{INVEST.SCREEN.SEARCH_TITLE}</div>
          <div className="text-sm text-text-mute mt-0.5">{INVEST.SCREEN.SEARCH_SUBTITLE}</div>
        </div>
        {/* key: un ticker nuevo en la URL (clic en la tabla) resetea el campo */}
        <TickerSearchForm key={query ?? ""} initial={query ?? ""} />
      </div>

      {query && (
        <div className="border-t border-border">
          {result ? (
            <TickerDetail result={result} benchmark={benchmark} showDetailsLink />
          ) : (
            <div className="px-4 py-6 text-sm text-text-mute">
              {INVEST.SCREEN.SEARCH_NOT_FOUND
                .replace("{ticker}", query)
                .replace("{date}", fmtDay(runDate))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

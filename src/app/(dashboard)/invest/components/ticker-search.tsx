import type { ReactElement } from "react"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import type { ScreenResult } from "~/types/invest"
import { TickerDetail } from "./ticker-detail"
import { fmtDay } from "./invest-format"

type Props = {
  query:   string | null
  runDate: string
  result:  ScreenResult | null
}

// Formulario GET (?tab=screen&q=TICKER): funciona sin JS y deja la URL compartible.
export function TickerSearch({ query, runDate, result }: Props): ReactElement {
  return (
    <div className="card p-0 overflow-hidden">
      <form
        action={APP_URLS.INVEST}
        method="get"
        className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 border-b border-border"
      >
        <input type="hidden" name="tab" value="screen" />
        <span className="label-caps md:mr-auto">{INVEST.SCREEN.SEARCH_TITLE}</span>
        <div className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder={INVEST.SCREEN.SEARCH_PLACEHOLDER}
            autoComplete="off"
            spellCheck={false}
            className="mono bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full md:w-56 outline-none focus:border-border-hi uppercase"
          />
          <button type="submit" className="btn-ghost shrink-0">{INVEST.SCREEN.SEARCH_CTA}</button>
        </div>
      </form>

      {query && (
        result ? (
          <TickerDetail result={result} />
        ) : (
          <div className="px-4 py-6 text-sm text-text-mute">
            {INVEST.SCREEN.SEARCH_NOT_FOUND
              .replace("{ticker}", query)
              .replace("{date}", fmtDay(runDate))}
          </div>
        )
      )}
    </div>
  )
}

"use client"

import { useRouter, useSearchParams } from "next/navigation"
import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"
import { PAGE_SIZE } from "~/types/trade-filters"

type Props = {
  page:       number
  pageCount:  number
  totalCount: number
}

function buildPageList(page: number, pageCount: number): (number | "...")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }
  const pages: (number | "...")[] = [1]
  if (page > 3) pages.push("...")
  for (let p = Math.max(2, page - 1); p <= Math.min(pageCount - 1, page + 1); p++) {
    pages.push(p)
  }
  if (page < pageCount - 2) pages.push("...")
  pages.push(pageCount)
  return pages
}

const NAV_BTN_BASE: React.CSSProperties = {
  height:       28,
  padding:      "0 10px",
  background:   "transparent",
  border:       "1px solid var(--color-border)",
  borderRadius: 5,
  fontFamily:   "inherit",
  fontSize:     12,
}

export function TradesPagination(props: Props): ReactElement {
  const { page, pageCount, totalCount } = props
  const router       = useRouter()
  const searchParams = useSearchParams()

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to   = Math.min(page * PAGE_SIZE, totalCount)

  const P = TRADES.LIST.PAGINATION

  function goTo(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p === 1) {
      params.delete("page")
    } else {
      params.set("page", String(p))
    }
    router.push(`?${params.toString()}`)
  }

  const pageList = buildPageList(page, pageCount)

  const showingLabel = totalCount === 0
    ? P.NO_TRADES
    : `${P.SHOWING} ${from}–${to} ${P.OF} ${totalCount} ${P.TRADES_LABEL}`

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-t border-border text-xs shrink-0"
      style={{ background: "var(--color-bg)" }}
    >
      <span className="mono text-text-mute">{showingLabel}</span>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            style={{
              ...NAV_BTN_BASE,
              color:   page <= 1 ? "var(--color-text-mute)" : "var(--color-text-dim)",
              cursor:  page <= 1 ? "default" : "pointer",
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            {P.PREV}
          </button>

          {pageList.map((item, i) =>
            item === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className="mono text-text-mute"
                style={{ padding: "0 4px" }}
              >
                ...
              </span>
            ) : (
              <button
                key={item}
                onClick={() => goTo(item)}
                style={{
                  height:       28,
                  minWidth:     28,
                  padding:      "0 6px",
                  background:   item === page ? "var(--color-surface-2)" : "transparent",
                  border:       `1px solid ${item === page ? "var(--color-border-hi)" : "var(--color-border)"}`,
                  borderRadius: 5,
                  color:        item === page ? "var(--color-text)" : "var(--color-text-dim)",
                  fontFamily:   "inherit",
                  fontSize:     12,
                  cursor:       "pointer",
                }}
              >
                {item}
              </button>
            ),
          )}

          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= pageCount}
            style={{
              ...NAV_BTN_BASE,
              color:   page >= pageCount ? "var(--color-text-mute)" : "var(--color-text-dim)",
              cursor:  page >= pageCount ? "default" : "pointer",
              opacity: page >= pageCount ? 0.5 : 1,
            }}
          >
            {P.NEXT}
          </button>
        </div>
      )}
    </div>
  )
}

import type { ReactElement, ReactNode } from "react"

type Props = {
  filters?: ReactNode
  actions:  ReactNode
}

export function FilterBar({ filters, actions }: Props): ReactElement {
  // Single consistent layout across pages: one row, filters (if any) on the left
  // and the range selector pinned right — identical on mobile and desktop so the
  // range control sits in the same place on /trades, /dashboard and /reports.
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
      {filters && (
        <div className="flex flex-wrap items-center gap-2">
          {filters}
        </div>
      )}
      <div className="flex ml-auto">
        {actions}
      </div>
    </div>
  )
}

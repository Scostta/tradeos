import type { ReactElement, ReactNode } from "react"

type Props = {
  filters?: ReactNode
  actions:  ReactNode
}

export function FilterBar({ filters, actions }: Props): ReactElement {
  // With filters present (trades), keep everything on one row even on mobile so
  // the range selector sits next to the Filters launcher. Without filters
  // (dashboard/reports), preserve the centered range selector on mobile.
  if (filters) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {filters}
        </div>
        <div className="flex ml-auto">
          {actions}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
      <div className="flex justify-center md:ml-auto">
        {actions}
      </div>
    </div>
  )
}

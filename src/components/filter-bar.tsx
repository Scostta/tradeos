import type { ReactElement, ReactNode } from "react"

type Props = {
  filters?: ReactNode
  actions:  ReactNode
}

export function FilterBar({ filters, actions }: Props): ReactElement {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
      {filters ? (
        <div className="flex flex-wrap items-center gap-2">
          {filters}
        </div>
      ) : null}
      <div className="flex justify-center md:ml-auto">
        {actions}
      </div>
    </div>
  )
}

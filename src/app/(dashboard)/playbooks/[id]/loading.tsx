import type { ReactElement } from "react"

export default function PlaybookDetailLoading(): ReactElement {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="h-5 w-48 rounded bg-surface-2 animate-pulse" />
        <div className="ml-auto flex items-center gap-2">
          <div className="h-[30px] w-14 rounded-sm bg-surface-2 animate-pulse" />
          <div className="h-[30px] w-24 rounded-sm bg-surface-2 animate-pulse" />
        </div>
      </header>

      <div className="flex-1 overflow-auto page-pad flex flex-col gap-4">
        <div className="card p-4 h-24 animate-pulse" />
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="card flex-1 h-44 animate-pulse" />
          <div className="card flex-1 h-44 animate-pulse" />
        </div>
        <div className="card h-28 animate-pulse" />
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="card flex-1 h-64 animate-pulse" />
          <div className="card flex-1 h-64 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

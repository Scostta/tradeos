import type { ReactElement } from "react"

export default function ReportsLoading(): ReactElement {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <header className="flex flex-col md:flex-row md:items-center gap-3 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <div className="h-5 w-24 rounded bg-surface-2 animate-pulse mb-1" />
          <div className="h-3.5 w-40 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="md:ml-auto h-8 w-40 rounded bg-surface-2 animate-pulse" />
      </header>

      {/* Filter bar skeleton */}
      <div className="flex items-center justify-end px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
        <div className="h-7 w-72 rounded bg-surface-2 animate-pulse" />
      </div>

      {/* Tab strip skeleton */}
      <div className="flex items-center gap-2 px-7 py-2.5 border-b border-border shrink-0">
        <div className="h-8 w-28 rounded bg-surface-2 animate-pulse" />
        <div className="h-8 w-24 rounded bg-surface-2 animate-pulse" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto p-7">
        <div className="flex flex-col gap-4 animate-pulse">
          {/* Two chart cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 h-80">
              <div className="h-4 w-40 rounded bg-surface-2 mb-3" />
              <div className="flex-1 h-64 rounded bg-surface-2" />
            </div>
            <div className="card p-4 h-80">
              <div className="h-4 w-40 rounded bg-surface-2 mb-3" />
              <div className="flex-1 h-64 rounded bg-surface-2" />
            </div>
          </div>

          {/* Summary stats grid */}
          <div className="card p-0">
            <div className="h-10 border-b border-border px-4 flex items-center">
              <div className="h-3 w-20 rounded bg-surface-2" />
            </div>
            <div className="grid grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4"
                  style={{
                    borderRight:  (i % 4 !== 3) ? "1px solid var(--color-border)" : "none",
                    borderBottom: (i < 8) ? "1px solid var(--color-border)" : "none",
                  }}
                >
                  <div className="h-2.5 w-24 rounded bg-surface-2 mb-3" />
                  <div className="h-5 w-20 rounded bg-surface-2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

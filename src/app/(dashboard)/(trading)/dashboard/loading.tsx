export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="flex flex-col gap-1.5">
          <div className="h-5 w-28 rounded bg-surface-2 animate-pulse" />
          <div className="h-3 w-48 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="flex-1" />
        <div className="h-8 w-40 md:w-64 rounded bg-surface-2 animate-pulse" />
      </div>

      <div className="flex-1 overflow-auto page-pad flex flex-col gap-4">
        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 min-h-24 animate-pulse">
              <div className="h-2.5 w-16 rounded bg-surface-2 mb-3" />
              <div className="h-8 w-24 rounded bg-surface-2" />
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="card animate-pulse flex-1" style={{ height: 320 }} />
          <div className="card animate-pulse w-full lg:w-80 shrink-0" style={{ height: 320 }} />
        </div>

        {/* Trades table */}
        <div className="card p-0 animate-pulse">
          <div className="px-4 py-3 border-b border-border">
            <div className="h-2.5 w-28 rounded bg-surface-2" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-border">
              <div className="h-3 w-10 rounded bg-surface-2" />
              <div className="h-3 w-32 rounded bg-surface-2" />
              <div className="h-3 w-12 rounded bg-surface-2" />
              <div className="h-3 w-10 rounded bg-surface-2" />
              <div className="ml-auto h-3 w-16 rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

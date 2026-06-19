export default function TradesLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="flex flex-col gap-1.5">
          <div className="h-5 w-16 rounded bg-surface-2 animate-pulse" />
          <div className="h-3 w-40 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 rounded bg-surface-2 animate-pulse" />
          <div className="hidden sm:block h-8 w-28 rounded bg-surface-2 animate-pulse" />
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
        <div className="h-7 w-24 rounded bg-surface-2 animate-pulse" />
        <div className="hidden sm:block h-7 w-24 rounded bg-surface-2 animate-pulse" />
        <div className="hidden sm:block h-7 w-24 rounded bg-surface-2 animate-pulse" />
        <div className="ml-auto h-7 w-48 rounded bg-surface-2 animate-pulse" />
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-7 py-5">
        <div className="card p-0 overflow-hidden animate-pulse">
          <div className="flex px-3 py-2.5 border-b border-border gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-2.5 w-12 rounded bg-surface-2" />
            ))}
          </div>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="flex items-center px-3 py-2.5 border-b border-border gap-4">
              <div className="h-3 w-8 rounded bg-surface-2" />
              <div className="h-3 w-28 rounded bg-surface-2" />
              <div className="h-3 w-10 rounded bg-surface-2" />
              <div className="h-5 w-12 rounded bg-surface-2" />
              <div className="h-3 w-6 rounded bg-surface-2 ml-auto" />
              <div className="h-3 w-16 rounded bg-surface-2" />
              <div className="h-3 w-16 rounded bg-surface-2" />
              <div className="h-3 w-14 rounded bg-surface-2" />
              <div className="h-3 w-12 rounded bg-surface-2" />
              <div className="h-3 w-14 rounded bg-surface-2" />
              <div className="h-3 w-20 rounded bg-surface-2" />
              <div className="h-3 w-8 rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
        <div className="h-3 w-36 rounded bg-surface-2 animate-pulse" />
        <div className="flex items-center gap-1">
          <div className="h-7 w-12 rounded bg-surface-2 animate-pulse" />
          <div className="h-7 w-7 rounded bg-surface-2 animate-pulse" />
          <div className="h-7 w-7 rounded bg-surface-2 animate-pulse" />
          <div className="h-7 w-7 rounded bg-surface-2 animate-pulse" />
          <div className="h-7 w-12 rounded bg-surface-2 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

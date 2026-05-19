export default function StrategiesLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="flex flex-col gap-1.5">
          <div className="h-5 w-28 rounded bg-surface-2 animate-pulse" />
          <div className="h-3 w-36 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="flex-1" />
        <div className="h-8 w-32 rounded bg-surface-2 animate-pulse" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 p-7">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="card animate-pulse"
            style={{ minHeight: 192 }}
          />
        ))}
      </div>
    </div>
  );
}

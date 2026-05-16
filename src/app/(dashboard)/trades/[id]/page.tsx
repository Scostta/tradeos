import { COMMON } from "~/constants/copies/common";
import { TRADES } from "~/constants/copies/trades";

export default async function TradeViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Trade #{id.padStart(4, "0")}
          </h1>
          <div className="mono text-sm text-text-mute mt-0.5">{TRADES.VIEW.SUBTITLE}</div>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center text-text-mute text-md">
        {COMMON.COMING_SOON}
      </div>
    </div>
  );
}

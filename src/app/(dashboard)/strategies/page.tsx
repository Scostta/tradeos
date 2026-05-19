import type { ReactElement } from "react";
import { STRATEGIES } from "~/constants/copies/strategies";
import { getStrategiesWithStats } from "~/services/queries/strategies";
import { StrategiesGrid } from "./components/strategies-grid";
import { NewStrategyButton } from "./components/new-strategy-button.client";

export default async function StrategiesPage(): Promise<ReactElement> {
  const result = await getStrategiesWithStats();

  const strategies   = result.success ? result.data : [];
  const activeCount  = strategies.filter((s) => s.active).length;
  const total        = strategies.length;
  const hasStrategies = total > 0;

  const subtitle = hasStrategies
    ? `${activeCount} active · ${total} total`
    : STRATEGIES.SUBTITLE_FALLBACK;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{STRATEGIES.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{subtitle}</div>
        </div>

        {hasStrategies && (
          <div className="ml-auto">
            <NewStrategyButton />
          </div>
        )}
      </header>

      <div className="flex-1 overflow-auto">
        {result.success ? (
          <StrategiesGrid strategies={result.data} />
        ) : (
          <div className="p-7">
            <div className="card p-4 text-sm text-loss">{STRATEGIES.ERROR.LOAD_FAILED}</div>
          </div>
        )}
      </div>
    </div>
  );
}

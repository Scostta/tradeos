import type { ReactElement } from "react";
import type { StrategyWithStats } from "~/types/strategy";
import { StrategyCard } from "./strategy-card.client";
import { StrategiesEmptyState } from "./strategies-empty-state";
import { NewStrategyCard } from "./new-strategy-card.client";

type Props = { strategies: StrategyWithStats[] };

export function StrategiesGrid({ strategies }: Props): ReactElement {
  if (strategies.length === 0) {
    return <StrategiesEmptyState />;
  }

  const sorted = [...strategies].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 p-7">
      {sorted.map((strategy) => (
        <StrategyCard key={strategy.id} strategy={strategy} />
      ))}
      <NewStrategyCard />
    </div>
  );
}

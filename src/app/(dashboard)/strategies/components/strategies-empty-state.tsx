import type { ReactElement } from "react";
import { STRATEGIES } from "~/constants/copies/strategies";
import { NewStrategyButton } from "./new-strategy-button.client";

export function StrategiesEmptyState(): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-md font-medium text-text">{STRATEGIES.EMPTY.HEADLINE}</p>
        <p className="text-sm text-text-mute max-w-sm">{STRATEGIES.EMPTY.BODY}</p>
      </div>
      <NewStrategyButton label={STRATEGIES.EMPTY.CTA} />
    </div>
  );
}

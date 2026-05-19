"use client";

import { STRATEGIES } from "~/constants/copies/strategies";

export default function StrategiesError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-4">
      <div className="text-md font-semibold text-text">{STRATEGIES.ERROR.TITLE}</div>
      <div className="text-sm text-text-mute">{STRATEGIES.ERROR.MESSAGE}</div>
      <button onClick={reset} className="btn-accent">
        {STRATEGIES.ERROR.RETRY}
      </button>
    </div>
  );
}

"use client";

import type { ReactElement } from "react";
import { STRATEGIES } from "~/constants/copies/strategies";
import { PlusIcon } from "~/lib/ui/icons/plus-icon";
import { StrategyEditor } from "./strategy-editor.client";

export function NewStrategyCard(): ReactElement {
  return (
    <StrategyEditor
      mode="create"
      renderTrigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="card border-dashed bg-transparent w-full cursor-pointer flex flex-col items-center justify-center gap-3"
          style={{ minHeight: 192 }}
        >
          <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center text-text-mute">
            <PlusIcon />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-md font-medium text-text">{STRATEGIES.NEW_CARD.TITLE}</span>
            <span className="text-sm text-text-mute">{STRATEGIES.NEW_CARD.BODY}</span>
          </div>
        </button>
      )}
    />
  );
}

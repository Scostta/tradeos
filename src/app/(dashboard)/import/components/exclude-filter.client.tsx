"use client";

import { useState } from "react";
import type { ReactElement } from "react";
import { IMPORT } from "~/constants/copies/import";
import { Button } from "~/lib/ui/button";

const INPUT_CLS =
  "bg-surface-2 border border-border rounded-sm px-2.5 py-1.5 text-sm text-text mono w-20 outline-none focus:border-border-hi";

type Props = {
  /** Cuántas filas caerían bajo el umbral actual. */
  matchCount: number;
  /** Cuántas filas están excluidas ahora mismo. */
  excludedCount: number;
  threshold: number;
  onThresholdChange: (value: number) => void;
  onApply: () => void;
  onKeepAll: () => void;
  disabled?: boolean;
};

export function ExcludeFilter(props: Props): ReactElement {
  const {
    matchCount,
    excludedCount,
    threshold,
    onThresholdChange,
    onApply,
    onKeepAll,
    disabled = false,
  } = props;

  // Buffer de texto: permite estados intermedios ("", "0.") mientras se escribe.
  const [draft, setDraft] = useState<string>(String(threshold));

  function handleDraft(value: string) {
    setDraft(value);
    const parsed = Number(value);
    if (value !== "" && Number.isFinite(parsed) && parsed >= 0) {
      onThresholdChange(parsed);
    }
  }

  return (
    <div className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="label-caps">{IMPORT.FILTER.TITLE}</span>
        <p className="text-xxs text-text-mute">{IMPORT.FILTER.HINT}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-text-dim">
          <span className="mono whitespace-nowrap">{IMPORT.FILTER.THRESHOLD}</span>
          <span className="flex items-center gap-1">
            <span className="text-text-mute mono">$</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={draft}
              onChange={(e) => handleDraft(e.target.value)}
              disabled={disabled}
              className={INPUT_CLS}
            />
          </span>
        </label>

        {excludedCount > 0 && (
          <Button variant="ghost" onClick={onKeepAll} disabled={disabled}>
            {IMPORT.FILTER.KEEP_ALL}
          </Button>
        )}

        <Button
          variant="ghost"
          onClick={onApply}
          disabled={disabled || matchCount === 0}
        >
          {matchCount === 0
            ? IMPORT.FILTER.APPLY_EMPTY
            : IMPORT.FILTER.APPLY.replace("{count}", String(matchCount))}
        </Button>
      </div>
    </div>
  );
}

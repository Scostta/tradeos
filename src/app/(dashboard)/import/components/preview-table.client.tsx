"use client";

import type { ReactElement } from "react";
import type { PreviewRow } from "~/types";
import { cn } from "~/utils/cn";
import { IMPORT } from "~/constants/copies/import";

type Props = {
  rows: PreviewRow[];
  /** Marca/desmarca una fila (índice dentro de `rows`). Excluida = sin marcar. */
  onToggleRow: (index: number, keep: boolean) => void;
  /** Marca/desmarca todas las filas visibles. */
  onToggleAll: (keep: boolean) => void;
  disabled?: boolean;
};

function formatEntryTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month:   "short",
    day:     "numeric",
    hour:    "2-digit",
    minute:  "2-digit",
    hour12:  false,
  });
}

function formatNetPnl(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

const BADGES = {
  new: {
    label: IMPORT.PREVIEW.STATUS_NEW,
    cls:   "text-profit bg-profit/10 border-profit/30",
  },
  dup: {
    label: IMPORT.PREVIEW.STATUS_DUP,
    cls:   "text-text-mute bg-surface-2 border-border",
  },
  skipped: {
    label: IMPORT.PREVIEW.STATUS_SKIPPED,
    cls:   "text-loss bg-loss/10 border-loss/30",
  },
} as const;

export function PreviewTable(props: Props): ReactElement {
  const { rows, onToggleRow, onToggleAll, disabled = false } = props;

  const keptCount = rows.filter((r) => !r.excluded).length;
  const allKept   = rows.length > 0 && keptCount === rows.length;

  const headers = [
    { key: "keep",       label: IMPORT.PREVIEW.TABLE_HEADERS.KEEP,        align: "left"  },
    { key: "status",     label: IMPORT.PREVIEW.TABLE_HEADERS.STATUS,      align: "left"  },
    { key: "time",       label: IMPORT.PREVIEW.TABLE_HEADERS.TIME,        align: "left"  },
    { key: "instrument", label: IMPORT.PREVIEW.TABLE_HEADERS.INSTRUMENT,  align: "left"  },
    { key: "dir",        label: IMPORT.PREVIEW.TABLE_HEADERS.DIR,         align: "left"  },
    { key: "qty",        label: IMPORT.PREVIEW.TABLE_HEADERS.QTY,         align: "right" },
    { key: "entry",      label: IMPORT.PREVIEW.TABLE_HEADERS.ENTRY,       align: "right" },
    { key: "exit",       label: IMPORT.PREVIEW.TABLE_HEADERS.EXIT,        align: "right" },
    { key: "netpnl",     label: IMPORT.PREVIEW.TABLE_HEADERS.NET_PNL,     align: "right" },
  ] as const;

  return (
    <div className="overflow-y-auto max-h-96">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-surface z-10">
          <tr>
            {headers.map((h) => (
              <th
                key={h.key}
                className={cn(
                  "label-caps px-3 py-2.5 border-b border-border",
                  h.align === "right" ? "text-right" : "text-left"
                )}
              >
                {h.key === "keep" ? (
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allKept}
                      disabled={disabled}
                      onChange={(e) => onToggleAll(e.target.checked)}
                      className="accent-accent cursor-pointer disabled:cursor-not-allowed"
                      aria-label={IMPORT.PREVIEW.TABLE_HEADERS.KEEP}
                    />
                    {h.label}
                  </span>
                ) : (
                  h.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const badge = BADGES[row.status];

            return (
              <tr
                key={`${row.accountName}-${row.tradeNumber}-${i}`}
                className={cn(
                  "border-b border-border hover:bg-surface-2 transition-colors",
                  row.status === "dup" && !row.excluded && "opacity-60",
                  row.excluded && "opacity-40"
                )}
              >
                {/* Keep / exclude */}
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={!row.excluded}
                    disabled={disabled}
                    onChange={(e) => onToggleRow(i, e.target.checked)}
                    title={IMPORT.PREVIEW.KEEP_TITLE}
                    className="accent-accent cursor-pointer disabled:cursor-not-allowed"
                    aria-label={`${IMPORT.PREVIEW.TABLE_HEADERS.KEEP} #${row.tradeNumber}`}
                  />
                </td>

                {/* Status */}
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "text-xs mono tracking-wider border rounded-sm px-2 py-0.5",
                      badge.cls
                    )}
                  >
                    {badge.label}
                  </span>
                </td>

                {/* Time */}
                <td
                  className={cn(
                    "px-3 py-2.5 mono text-sm text-text-dim whitespace-nowrap",
                    row.excluded && "line-through"
                  )}
                >
                  {formatEntryTime(row.entryTime)}
                </td>

                {/* Instrument */}
                <td
                  className={cn(
                    "px-3 py-2.5 mono text-sm text-text font-semibold",
                    row.excluded && "line-through"
                  )}
                >
                  {row.instrument}
                </td>

                {/* Direction */}
                <td className="px-3 py-2.5">
                  {row.direction === "long" ? (
                    <span className="text-long tracking-wider text-xs mono font-semibold">
                      {IMPORT.PREVIEW.DIR_LONG}
                    </span>
                  ) : (
                    <span className="text-short tracking-wider text-xs mono font-semibold">
                      {IMPORT.PREVIEW.DIR_SHORT}
                    </span>
                  )}
                </td>

                {/* Qty */}
                <td className="px-3 py-2.5 mono text-sm text-text text-right">
                  {row.contracts}
                </td>

                {/* Entry */}
                <td className="px-3 py-2.5 mono text-sm text-text text-right">
                  {row.entryPrice.toFixed(2)}
                </td>

                {/* Exit */}
                <td className="px-3 py-2.5 mono text-sm text-text text-right">
                  {row.exitPrice.toFixed(2)}
                </td>

                {/* Net P&L */}
                <td
                  className={cn(
                    "px-3 py-2.5 mono text-sm text-right",
                    row.excluded
                      ? "text-text-mute line-through"
                      : row.netPnl >= 0
                        ? "text-profit"
                        : "text-loss"
                  )}
                >
                  {formatNetPnl(row.netPnl)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

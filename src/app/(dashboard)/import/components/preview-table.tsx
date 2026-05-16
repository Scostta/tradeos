import type { ReactElement } from "react";
import type { PreviewRow } from "~/types";
import { cn } from "~/utils/cn";
import { IMPORT } from "~/constants/copies/import";

type Props = {
  rows: PreviewRow[];
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

export function PreviewTable(props: Props): ReactElement {
  const { rows } = props;

  const headers = [
    { key: "status",     label: IMPORT.PREVIEW.TABLE_HEADERS.STATUS,     align: "left"  },
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
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                "border-b border-border hover:bg-surface-2 transition-colors",
                row.status === "dup" && "opacity-60"
              )}
            >
              {/* Status */}
              <td className="px-3 py-2.5">
                {row.status === "new" ? (
                  <span className="text-xs mono tracking-wider text-profit bg-profit/10 border border-profit/30 rounded-sm px-2 py-0.5">
                    {IMPORT.PREVIEW.STATUS_NEW}
                  </span>
                ) : (
                  <span className="text-xs mono tracking-wider text-text-mute bg-surface-2 border border-border rounded-sm px-2 py-0.5">
                    {IMPORT.PREVIEW.STATUS_DUP}
                  </span>
                )}
              </td>

              {/* Time */}
              <td className="px-3 py-2.5 mono text-sm text-text-dim whitespace-nowrap">
                {formatEntryTime(row.entryTime)}
              </td>

              {/* Instrument */}
              <td className="px-3 py-2.5 mono text-sm text-text font-semibold">
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
                  row.netPnl >= 0 ? "text-profit" : "text-loss"
                )}
              >
                {formatNetPnl(row.netPnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

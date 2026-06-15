"use client"

import { useState, useMemo } from "react"
import type { ReactElement } from "react"
import type { ReportRow } from "~/types/reports"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency, formatPct } from "~/helpers/format"

type SortKey = keyof ReportRow
type SortDir = 1 | -1

type SortState = {
  key: SortKey
  dir: SortDir
}

type Col = {
  key:   SortKey
  label: string
  align: "left" | "right"
}

type Props = {
  firstCol: string
  rows:     ReportRow[]
}

const COLS: Col[] = [
  { key: "label",   label: "",                                         align: "left"  },
  { key: "winRate", label: REPORTS.REPORT_DETAIL.TABLE.WIN_RATE,       align: "right" },
  { key: "pnl",     label: REPORTS.REPORT_DETAIL.TABLE.NET_PNL,        align: "right" },
  { key: "trades",  label: REPORTS.REPORT_DETAIL.TABLE.TRADE_COUNT,    align: "right" },
  { key: "avgVol",  label: REPORTS.REPORT_DETAIL.TABLE.AVG_VOLUME,     align: "right" },
  { key: "avgWin",  label: REPORTS.REPORT_DETAIL.TABLE.AVG_WIN,        align: "right" },
  { key: "avgLoss", label: REPORTS.REPORT_DETAIL.TABLE.AVG_LOSS,       align: "right" },
]

export function SummaryTable(props: Props): ReactElement {
  const { firstCol, rows } = props
  const [sort, setSort] = useState<SortState>({ key: "pnl", dir: -1 })

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * sort.dir
      }
      return ((av as number ?? 0) - (bv as number ?? 0)) * sort.dir
    })
    return copy
  }, [rows, sort])

  function handleSort(key: SortKey) {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === -1 ? 1 : -1 }
        : { key, dir: -1 }
    )
  }

  const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

  const cols: Col[] = COLS.map(c =>
    c.key === "label" ? { ...c, label: firstCol } : c
  )

  return (
    <div className="card" style={{ padding: 0 }}>
      {/* Table header row */}
      <div
        style={{
          padding:        "12px 16px",
          borderBottom:   "1px solid var(--color-border)",
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
        }}
      >
        <div
          style={{
            fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
            color: "var(--color-text-mute)", textTransform: "uppercase",
          }}
        >
          {REPORTS.REPORT_DETAIL.SUMMARY_LABEL}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {cols.map(col => {
                const active = sort.key === col.key
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding:       "10px 16px",
                      fontSize:      9,
                      fontWeight:    500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color:         active ? "var(--color-text)" : "var(--color-text-mute)",
                      borderBottom:  "1px solid var(--color-border)",
                      textAlign:     col.align,
                      cursor:        "pointer",
                      whiteSpace:    "nowrap",
                      userSelect:    "none",
                    }}
                  >
                    <span
                      style={{
                        display:       "inline-flex",
                        alignItems:    "center",
                        gap:           4,
                        flexDirection: col.align === "right" ? "row-reverse" : "row",
                      }}
                    >
                      {col.label}
                      <span
                        style={{
                          opacity: active ? 1 : 0,
                          color:   "var(--color-accent)",
                          fontSize: 8,
                        }}
                      >
                        {active && sort.dir === -1 ? "▼" : "▲"}
                      </span>
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                style={{ height: 44 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
              >
                {/* Label */}
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)" }}>
                  <span style={{ fontSize: 12.5, color: "var(--color-text)", fontWeight: 500 }}>
                    {row.label}
                  </span>
                </td>

                {/* Win % with inline bar */}
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                    <span style={{ fontFamily: monoFont, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                      {(row.winRate * 100).toFixed(1)}%
                    </span>
                    <div
                      style={{
                        width:        40,
                        height:       4,
                        background:   "var(--color-border)",
                        borderRadius: 2,
                        overflow:     "hidden",
                      }}
                    >
                      <div
                        style={{
                          width:      `${row.winRate * 100}%`,
                          height:     "100%",
                          background: row.winRate >= 0.5 ? "var(--color-accent)" : "var(--color-loss)",
                        }}
                      />
                    </div>
                  </div>
                </td>

                {/* Net P&L */}
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                  <span
                    style={{
                      fontFamily:         monoFont,
                      fontSize:           12,
                      fontWeight:         600,
                      fontVariantNumeric: "tabular-nums",
                      color:              row.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                    }}
                  >
                    {formatCurrency(row.pnl, { sign: true, decimals: 2 })}
                  </span>
                </td>

                {/* Trade count */}
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                  <span style={{ fontFamily: monoFont, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                    {row.trades}
                  </span>
                </td>

                {/* Avg volume */}
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                  <span
                    style={{
                      fontFamily:         monoFont,
                      fontSize:           12,
                      fontVariantNumeric: "tabular-nums",
                      color:              "var(--color-text-mute)",
                    }}
                  >
                    {row.avgVol.toFixed(1)}
                  </span>
                </td>

                {/* Avg win */}
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                  <span
                    style={{
                      fontFamily:         monoFont,
                      fontSize:           12,
                      fontVariantNumeric: "tabular-nums",
                      color:              "var(--color-profit)",
                    }}
                  >
                    {formatCurrency(row.avgWin, { sign: false, decimals: 2 })}
                  </span>
                </td>

                {/* Avg loss */}
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                  <span
                    style={{
                      fontFamily:         monoFont,
                      fontSize:           12,
                      fontVariantNumeric: "tabular-nums",
                      color:              "var(--color-loss)",
                    }}
                  >
                    {formatCurrency(row.avgLoss, { sign: true, decimals: 2 })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

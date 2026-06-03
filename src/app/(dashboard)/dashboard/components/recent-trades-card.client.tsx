"use client"

import type { ReactElement } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Trade } from "~/types/trade"
import { DASHBOARD } from "~/constants/copies/dashboard"
import { APP_URLS } from "~/constants/app-urls"
import { formatCurrency, formatDateTime } from "~/helpers/format"

type Props = { trades: Trade[] }

export function RecentTradesCard({ trades }: Props): ReactElement {
  const router = useRouter()

  if (trades.length === 0) {
    return (
      <div className="card p-0 flex flex-col">
        <div className="flex justify-between items-center px-4 py-3 border-b border-border">
          <div className="label-caps">{DASHBOARD.RECENT.LABEL}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
          <div className="text-md font-medium text-text">{DASHBOARD.EMPTY.TITLE}</div>
          <div className="text-sm text-text-mute text-center max-w-64">{DASHBOARD.EMPTY.MESSAGE}</div>
          <Link
            href={APP_URLS.IMPORT}
            className="btn-accent mt-1"
          >
            {DASHBOARD.EMPTY.CTA}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-0 flex flex-col">
      <div className="flex justify-between items-center px-4 py-3 border-b border-border">
        <div className="label-caps">{DASHBOARD.RECENT.LABEL}</div>
        <Link
          href={APP_URLS.TRADES}
          className="text-sm text-text-dim hover:text-text transition-colors"
        >
          {DASHBOARD.RECENT.VIEW_ALL}
        </Link>
      </div>

      <div className="overflow-x-auto">
      <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {[
              DASHBOARD.RECENT.HEADERS.NUMBER,
              DASHBOARD.RECENT.HEADERS.TIME,
              DASHBOARD.RECENT.HEADERS.INSTRUMENT,
              DASHBOARD.RECENT.HEADERS.DIR,
              DASHBOARD.RECENT.HEADERS.QTY,
              DASHBOARD.RECENT.HEADERS.NET_PNL,
            ].map((h, i) => (
              <th
                key={h}
                className="label-caps px-3 py-2.5 border-b border-border"
                style={{ textAlign: i === 5 ? "right" : "left" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map(t => {
            const isLong = t.direction === "long"
            return (
              <tr
                key={t.id}
                onClick={() => router.push(`${APP_URLS.TRADES}/${t.id}`)}
                className="cursor-pointer border-b border-border transition-colors hover:bg-surface-2"
              >
                <td className="px-3 py-2.5">
                  <span className="mono text-sm text-text-mute">
                    #{(t.tradeNumber ?? 0).toString().padStart(4, "0")}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="mono text-sm text-text-dim">{formatDateTime(t.entryTime)}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="mono text-sm font-semibold text-text">{t.instrument}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="mono text-xs font-semibold"
                    style={{
                      color:      isLong ? "var(--color-long)"  : "var(--color-short)",
                      background: isLong ? "var(--color-long)18" : "var(--color-short)18",
                      border:     `1px solid ${isLong ? "var(--color-long)40" : "var(--color-short)40"}`,
                      display: "inline-flex", alignItems: "center",
                      padding: "0 6px", height: 16, borderRadius: 3,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {isLong ? DASHBOARD.RECENT.DIR_LONG : DASHBOARD.RECENT.DIR_SHORT}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="mono text-sm">{t.contracts}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span
                    className="mono text-sm font-semibold"
                    style={{ color: t.netPnl > 0 ? "var(--color-profit)" : t.netPnl < 0 ? "var(--color-loss)" : "var(--color-text-dim)" }}
                  >
                    {formatCurrency(t.netPnl)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}

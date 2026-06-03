import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"
import type { Trade } from "~/types/trade"
import { TradesTableRow } from "./trades-table-row"

type Props = {
  trades:     Trade[]
  strategies: { id: string; name: string }[]
}

const HEADERS = [
  { label: TRADES.LIST.HEADERS.NUMBER,     align: "left"  },
  { label: TRADES.LIST.HEADERS.DATE,       align: "left"  },
  { label: TRADES.LIST.HEADERS.INSTRUMENT, align: "left"  },
  { label: TRADES.LIST.HEADERS.DIRECTION,  align: "left"  },
  { label: TRADES.LIST.HEADERS.QTY,        align: "right" },
  { label: TRADES.LIST.HEADERS.ENTRY,      align: "right" },
  { label: TRADES.LIST.HEADERS.EXIT,       align: "right" },
  { label: TRADES.LIST.HEADERS.PNL_GROSS,  align: "right" },
  { label: TRADES.LIST.HEADERS.COMM,       align: "right" },
  { label: TRADES.LIST.HEADERS.NET_PNL,    align: "right" },
  { label: TRADES.LIST.HEADERS.STRATEGY,   align: "left"  },
  { label: TRADES.LIST.HEADERS.HOLD,       align: "right" },
] as const

export function TradesTable(props: Props): ReactElement {
  const { trades, strategies } = props

  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
      <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {HEADERS.map(h => (
              <th
                key={h.label}
                className="label-caps px-3 py-2.5 border-b border-border cursor-pointer"
                style={{ textAlign: h.align }}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.length === 0 ? (
            <tr>
              <td
                colSpan={12}
                className="py-16 text-text-mute text-sm text-center"
              >
                {TRADES.LIST.EMPTY}
              </td>
            </tr>
          ) : (
            trades.map(trade => (
              <TradesTableRow
                key={trade.id}
                trade={trade}
                strategies={strategies}
              />
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}

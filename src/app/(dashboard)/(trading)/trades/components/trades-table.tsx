import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"
import type { Trade } from "~/types/trade"
import type { Playbook } from "~/types/playbook"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import { gradeForTrade } from "~/lib/calculations/trade-grade"
import { TradesTableRow } from "./trades-table-row"

type Props = {
  trades:     Trade[]
  playbooks: Pick<Playbook, "id" | "name" | "rules">[]
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
  { label: TRADES.LIST.HEADERS.PLAYBOOK,   align: "left"  },
  { label: TRADES.LIST.HEADERS.GRADE,      align: "left"  },
  { label: TRADES.LIST.HEADERS.HOLD,       align: "right" },
] as const

export function TradesTable(props: Props): ReactElement {
  const { trades, playbooks } = props
  const rulesByPlaybook = new Map(playbooks.map(p => [p.id, parsePlaybookRules(p.rules)] as const))

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
                colSpan={HEADERS.length}
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
                playbooks={playbooks}
                grade={gradeForTrade(trade, rulesByPlaybook)}
              />
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}

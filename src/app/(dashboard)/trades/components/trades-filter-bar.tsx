import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"
import type { TradeFilters } from "~/types/trade-filters"
import { FilterBar } from "~/components/filter-bar"
import { FilterPill } from "~/components/filter-pill.client"
import { RangeSelector } from "~/components/range-selector.client"

const RANGE_OPTIONS = [
  { id: "today", label: TRADES.LIST.RANGE.DAY   },
  { id: "week",  label: TRADES.LIST.RANGE.WEEK  },
  { id: "month", label: TRADES.LIST.RANGE.MONTH },
  { id: "ytd",   label: TRADES.LIST.RANGE.YEAR  },
  { id: "all",   label: TRADES.LIST.RANGE.ALL   },
] as const

type Props = {
  filters:     TradeFilters
  instruments: string[]
  strategies:  { id: string; name: string }[]
}

export function TradesFilterBar(props: Props): ReactElement {
  const { filters, instruments, strategies } = props

  const instrumentOptions = [
    { value: null as string | null, label: TRADES.LIST.FILTERS.ALL },
    ...instruments.map(i => ({ value: i, label: i })),
  ]

  const directionOptions = [
    { value: null as string | null,  label: TRADES.LIST.FILTERS.ALL   },
    { value: "long"  as string,      label: TRADES.LIST.FILTERS.LONG  },
    { value: "short" as string,      label: TRADES.LIST.FILTERS.SHORT },
  ]

  const strategyOptions = [
    { value: null as string | null, label: TRADES.LIST.FILTERS.ALL },
    ...strategies.map(s => ({ value: s.id, label: s.name })),
  ]

  return (
    <FilterBar
      filters={
        <>
          <FilterPill
            label={TRADES.LIST.FILTERS.INSTRUMENT}
            paramKey="instrument"
            value={filters.instrument}
            options={instrumentOptions}
          />
          <FilterPill
            label={TRADES.LIST.FILTERS.DIRECTION}
            paramKey="direction"
            value={filters.direction}
            options={directionOptions}
          />
          <FilterPill
            label={TRADES.LIST.FILTERS.STRATEGY}
            paramKey="strategy"
            value={filters.strategyId}
            options={strategyOptions}
          />
        </>
      }
      actions={<RangeSelector value={filters.range} options={RANGE_OPTIONS} />}
    />
  )
}

import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"
import { MISTAKE_PRESETS } from "~/constants/trade-mistakes"
import type { TradeFilters } from "~/types/trade-filters"
import { FilterBar } from "~/components/filter-bar"
import { FilterPill } from "~/components/filter-pill.client"
import { RangeSelector } from "~/components/range-selector.client"
import { PnlRangeFilter } from "./pnl-range-filter.client"
import { ClearFiltersButton } from "./clear-filters-button.client"

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
  tags:        string[]
  playbooks:  { id: string; name: string }[]
}

const ALL = { value: null as string | null, label: TRADES.LIST.FILTERS.ALL }

export function TradesFilterBar(props: Props): ReactElement {
  const { filters, instruments, tags, playbooks } = props

  const instrumentOptions = [ALL, ...instruments.map(i => ({ value: i, label: i }))]
  const playbookOptions   = [ALL, ...playbooks.map(s => ({ value: s.id, label: s.name }))]
  const tagOptions        = [ALL, ...tags.map(t => ({ value: t, label: t }))]

  const directionOptions = [
    ALL,
    { value: "long"  as string, label: TRADES.LIST.FILTERS.LONG  },
    { value: "short" as string, label: TRADES.LIST.FILTERS.SHORT },
  ]

  const outcomeOptions = [
    ALL,
    { value: "win"  as string, label: TRADES.LIST.FILTERS.WIN  },
    { value: "loss" as string, label: TRADES.LIST.FILTERS.LOSS },
    { value: "be"   as string, label: TRADES.LIST.FILTERS.BE   },
  ]

  const mistakeOptions = [
    ALL,
    { value: "clean" as string, label: TRADES.LIST.FILTERS.CLEAN },
    { value: "any"   as string, label: TRADES.LIST.FILTERS.ANY_MISTAKE },
    ...MISTAKE_PRESETS.map(m => ({ value: m as string, label: m })),
  ]

  const hasActiveFilters = Boolean(
    filters.instrument || filters.direction || filters.outcome || filters.playbookId ||
    filters.mistake || filters.tag || filters.pnlMin !== null || filters.pnlMax !== null ||
    filters.range !== "all",
  )

  return (
    <FilterBar
      filters={
        <>
          <FilterPill label={TRADES.LIST.FILTERS.INSTRUMENT} paramKey="instrument" value={filters.instrument} options={instrumentOptions} />
          <FilterPill label={TRADES.LIST.FILTERS.DIRECTION}  paramKey="direction"  value={filters.direction}  options={directionOptions} />
          <FilterPill label={TRADES.LIST.FILTERS.OUTCOME}    paramKey="outcome"    value={filters.outcome}    options={outcomeOptions} />
          <FilterPill label={TRADES.LIST.FILTERS.PLAYBOOK}   paramKey="playbook"   value={filters.playbookId} options={playbookOptions} />
          <FilterPill label={TRADES.LIST.FILTERS.MISTAKES}   paramKey="mistake"    value={filters.mistake}    options={mistakeOptions} />
          {tags.length > 0 && (
            <FilterPill label={TRADES.LIST.FILTERS.TAG} paramKey="tag" value={filters.tag} options={tagOptions} />
          )}
          <PnlRangeFilter min={filters.pnlMin} max={filters.pnlMax} />
          {hasActiveFilters && <ClearFiltersButton />}
        </>
      }
      actions={<RangeSelector value={filters.range} options={RANGE_OPTIONS} />}
    />
  )
}

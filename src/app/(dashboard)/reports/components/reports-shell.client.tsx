"use client"

import { useState } from "react"
import type { ReactElement } from "react"
import type { ReportsData } from "~/types/reports"
import { REPORTS } from "~/constants/copies/reports"
import { PerformanceTab } from "./performance-tab"
import { OverviewTab } from "./overview-tab"
import { CompareTab } from "./compare-tab.client"
import { RMultiplesTab } from "./r-multiples-tab"
import { ReportDetail } from "./report-detail.client"
import type { ReportKey } from "./report-detail.client"

type ActiveTab = "performance" | "overview" | "reports" | "compare" | "rmultiples"

type ReportMenuItem = {
  key:   ReportKey
  label: string
}

const REPORT_MENU: ReportMenuItem[] = [
  { key: "dayTime",    label: REPORTS.REPORT_MENU.DAY_TIME    },
  { key: "symbols",    label: REPORTS.REPORT_MENU.SYMBOLS     },
  { key: "playbooks", label: REPORTS.REPORT_MENU.PLAYBOOKS  },
  { key: "winsLosses", label: REPORTS.REPORT_MENU.WINS_LOSSES },
]

// Module-scope map for O(1) label lookup — avoids repeated find() on renders
const REPORT_LABEL = new Map<ReportKey, string>(
  REPORT_MENU.map(m => [m.key, m.label])
)

type Props = {
  data:      ReportsData
  accountId: string | null
}

export function ReportsShell({ data, accountId }: Props): ReactElement {
  const [tab,       setTab]      = useState<ActiveTab>("performance")
  const [reportKey, setReportKey]= useState<ReportKey>("dayTime")
  const [menuOpen,  setMenuOpen] = useState(false)

  const reportsLabel = tab === "reports"
    ? `${REPORTS.TABS.REPORTS} · ${REPORT_LABEL.get(reportKey) ?? ""}`
    : REPORTS.TABS.REPORTS

  function selectReport(key: ReportKey) {
    setReportKey(key)
    setTab("reports")
    setMenuOpen(false)
  }

  // dayTime needs two breakdowns for its two subtabs (Days + Months)
  const breakdownsForKey = (key: ReportKey) =>
    key === "dayTime"
      ? [data.dayTime, data.months]
      : [data[key]]

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Tab strip */}
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          4,
          padding:      "10px 28px",
          borderBottom: "1px solid var(--color-border)",
          position:     "relative",
          flexShrink:   0,
        }}
      >
        {/* Performance tab */}
        <TabButton
          id="performance"
          label={REPORTS.TABS.PERFORMANCE}
          active={tab === "performance"}
          onClick={() => setTab("performance")}
          badge
        />

        {/* Overview tab */}
        <TabButton
          id="overview"
          label={REPORTS.TABS.OVERVIEW}
          active={tab === "overview"}
          onClick={() => setTab("overview")}
        />

        {/* Reports▾ dropdown tab */}
        <div style={{ position: "relative" }}>
          <TabButton
            id="reports"
            label={reportsLabel}
            active={tab === "reports"}
            onClick={() => setMenuOpen(o => !o)}
            dropdown
            badge={tab === "reports"}
          />

          {menuOpen && (
            <>
              {/* Click-away overlay */}
              <div
                style={{ position: "fixed", inset: 0, zIndex: 20 }}
                onClick={() => setMenuOpen(false)}
              />
              {/* Dropdown menu */}
              <div
                style={{
                  position:     "absolute",
                  top:          "100%",
                  left:         0,
                  marginTop:    4,
                  background:   "var(--color-surface)",
                  border:       "1px solid var(--color-border-hi)",
                  borderRadius: 8,
                  padding:      5,
                  minWidth:     200,
                  zIndex:       30,
                  boxShadow:    "0 16px 44px rgba(0,0,0,.55)",
                }}
              >
                {REPORT_MENU.map(m => {
                  const isActive = tab === "reports" && reportKey === m.key
                  return (
                    <button
                      key={m.key}
                      onClick={() => selectReport(m.key)}
                      style={{
                        display:      "block",
                        width:        "100%",
                        textAlign:    "left",
                        padding:      "8px 12px",
                        borderRadius: 5,
                        border:       "none",
                        cursor:       "pointer",
                        background:   isActive ? "var(--color-surface-2)" : "transparent",
                        color:        isActive ? "var(--color-text)" : "var(--color-text-mute)",
                        fontFamily:   "inherit",
                        fontSize:     13,
                        fontWeight:   500,
                      }}
                    >
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Compare tab */}
        <TabButton
          id="compare"
          label={REPORTS.TABS.COMPARE}
          active={tab === "compare"}
          onClick={() => setTab("compare")}
        />

        {/* R-Multiples tab */}
        <TabButton
          id="rmultiples"
          label={REPORTS.TABS.R_MULTIPLES}
          active={tab === "rmultiples"}
          onClick={() => setTab("rmultiples")}
          badge
        />
      </div>

      {/* Tab content */}
      <div
        style={{
          flex:     1,
          overflow: "auto",
          padding:  28,
        }}
      >
        {tab === "performance" && (
          <PerformanceTab
            summary={data.performanceSummary}
            cumPoints={data.cumPoints}
            avgWinLoss={data.avgWinLoss}
          />
        )}

        {tab === "overview" && (
          <OverviewTab data={data.overview} />
        )}

        {tab === "compare" && (
          <CompareTab initial={data.compare} accountId={accountId} />
        )}

        {tab === "rmultiples" && (
          <RMultiplesTab rStats={data.rStats} />
        )}

        {tab === "reports" && (
          // key={reportKey} resets subtab state without useEffect — per CLAUDE.md key-reset pattern
          <ReportDetail
            key={reportKey}
            reportKey={reportKey}
            breakdowns={breakdownsForKey(reportKey)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Internal TabButton ────────────────────────────────────────────────────────

type TabButtonProps = {
  id:        string
  label:     string
  active:    boolean
  onClick:   () => void
  badge?:    boolean
  dropdown?: boolean
}

function TabButton(props: TabButtonProps): ReactElement {
  const { label, active, onClick, badge, dropdown } = props

  return (
    <button
      onClick={onClick}
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          7,
        padding:      "7px 12px",
        borderRadius: 6,
        border:       "none",
        background:   active ? "var(--color-surface-2)" : "transparent",
        color:        active ? "var(--color-text)" : "var(--color-text-mute)",
        fontFamily:   "inherit",
        fontSize:     13,
        fontWeight:   active ? 600 : 500,
        cursor:       "pointer",
        whiteSpace:   "nowrap",
      }}
    >
      {label}
      {badge && (
        <span
          style={{
            fontSize:      8,
            fontWeight:    700,
            letterSpacing: "0.08em",
            color:         "#0a0a0f",
            background:    "var(--color-accent)",
            padding:       "2px 5px",
            borderRadius:  3,
          }}
        >
          NEW
        </span>
      )}
      {dropdown && (
        <svg
          width="10" height="10"
          viewBox="0 0 12 12" fill="none"
          stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--color-text-mute)" }}
        >
          <polyline points="3 4.5 6 7.5 9 4.5" />
        </svg>
      )}
    </button>
  )
}

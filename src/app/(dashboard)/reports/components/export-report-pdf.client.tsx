"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { REPORTS } from "~/constants/copies/reports"
import { formatCurrency, formatPct, formatCompactCurrency, formatDurationMs } from "~/helpers/format"
import { Toast } from "~/lib/ui/toast"
import type { ReportsData, ReportRow } from "~/types/reports"

type Props = {
  accountName: string
  rangeLabel:  string
  data:        ReportsData
}

// ── Palette (RGB) ─────────────────────────────────────────────────────────────
const DARK   = [14, 17, 23] as const
const ACCENT = [163, 230, 53] as const
const WHITE  = [255, 255, 255] as const
const MUTE   = [148, 163, 184] as const
const INK    = [17, 24, 39] as const
const SUBT   = [107, 114, 128] as const
const CARD   = [246, 247, 249] as const
const ZEBRA  = [250, 250, 251] as const
const BORDER = [228, 230, 235] as const
const GREEN  = [22, 163, 74] as const
const RED     = [220, 38, 38] as const
const FILL_G  = [222, 244, 229] as const
const FILL_R  = [250, 228, 228] as const

type Stat = { label: string; value: string; tone?: "pos" | "neg" }
type Col  = { title: string; w: number; align?: "left" | "right"; pnl?: boolean }

// Sign-based tone from a formatCurrency string ("+$…" / "−$…" / "$0").
const toneOf = (s: string): "pos" | "neg" | undefined =>
  s.startsWith("+") ? "pos" : s.startsWith("−") || s.startsWith("-") ? "neg" : undefined

export function ExportReportPdf({ accountName, rangeLabel, data }: Props): ReactElement {
  const [error, setError]  = useState(false)
  const [isPending, start] = useTransition()

  function handleExport() {
    setError(false)
    start(async () => {
      try {
        const { jsPDF } = await import("jspdf")
        const doc = new jsPDF({ unit: "mm", format: "a4" })

        const W = 210, M = 16
        const contentW = W - M * 2
        const BOTTOM   = 276
        const dateStr  = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
        const colorOf  = (t?: "pos" | "neg") => (t === "pos" ? GREEN : t === "neg" ? RED : INK)
        // The standard PDF font lacks the Unicode minus (U+2212) that formatCurrency
        // emits — swap it for an ASCII hyphen so negatives render cleanly.
        const clean = (s: string) => s.replace(/−/g, "-")

        let y = 0

        function footer() {
          doc.setDrawColor(...BORDER); doc.setLineWidth(0.3); doc.line(M, 283, W - M, 283)
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...SUBT)
          doc.text(REPORTS.PDF.FOOTER, M, 289)
          doc.text(`${accountName} · ${rangeLabel}`, W - M, 289, { align: "right" })
        }

        function newPage() { footer(); doc.addPage(); y = M + 4 }
        function ensure(space: number) { if (y + space > BOTTOM) newPage() }

        function sectionTitle(label: string) {
          y += 7  // breathing room above each section
          ensure(14)
          doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK)
          doc.text(label, M, y); y += 2.5
          doc.setDrawColor(...ACCENT); doc.setLineWidth(0.7); doc.line(M, y, M + 16, y)
          y += 6.5
        }

        // ── Header band ───────────────────────────────────────────────────────
        doc.setFillColor(...DARK); doc.rect(0, 0, W, 34, "F")
        doc.setFillColor(...ACCENT); doc.roundedRect(M, 11, 8, 8, 1.5, 1.5, "F")
        doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(12)
        doc.text("T", M + 4, 16.8, { align: "center" })
        doc.setTextColor(...WHITE); doc.setFontSize(14); doc.text("TradeOS", M + 11, 16.3)
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTE)
        doc.text(REPORTS.PDF.TITLE.toUpperCase(), M + 11, 21.5)
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...WHITE)
        doc.text(accountName, W - M, 13.8, { align: "right" })
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTE)
        doc.text(`${rangeLabel}  ·  ${REPORTS.PDF.GENERATED} ${dateStr}`, W - M, 19.5, { align: "right" })

        y = 46

        // ── Hero KPIs ───────────────────────────────────────────────────────────
        const ps = data.performanceSummary
        const ov = data.overview.stats
        const hero: Stat[] = [
          { label: "Net P&L",       value: formatCurrency(ps.netPnl),  tone: ps.netPnl >= 0 ? "pos" : "neg" },
          { label: "Win rate",      value: formatPct(ps.winRate) },
          { label: "Profit factor", value: ps.profitFactor.toFixed(2) },
        ]
        {
          const gap = 5, hw = (contentW - gap * 2) / 3, hh = 24
          hero.forEach((k, i) => {
            const x = M + i * (hw + gap)
            doc.setFillColor(...CARD); doc.roundedRect(x, y, hw, hh, 2, 2, "F")
            doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...SUBT)
            doc.text(k.label.toUpperCase(), x + 5, y + 8)
            doc.setFont("helvetica", "bold"); doc.setFontSize(i === 0 ? 21 : 17)
            const c = colorOf(k.tone); doc.setTextColor(c[0], c[1], c[2])
            doc.text(clean(k.value), x + 5, y + 18)
          })
          y += hh + 8
        }

        // ── Equity curve ──────────────────────────────────────────────────────
        sectionTitle(REPORTS.PDF.EQUITY)
        {
          const equity = data.cumPoints.map(p => p.v)
          const boxH = 70
          doc.setFillColor(...CARD); doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
          doc.roundedRect(M, y, contentW, boxH, 2, 2, "FD")
          if (equity.length >= 2) {
            const min = Math.min(0, ...equity), max = Math.max(0, ...equity), range = max - min || 1
            const pl = 16, pad = 7
            const x0 = M + pl, y0 = y + pad, w = contentW - pl - pad, h = boxH - pad * 2
            const toX = (i: number) => x0 + (i / (equity.length - 1)) * w
            const toY = (v: number) => y0 + h - ((v - min) / range) * h
            const last = equity[equity.length - 1]!
            doc.setFont("helvetica", "normal"); doc.setFontSize(6.5)
            for (let g = 0; g <= 3; g++) {
              const gv = max - (range * g) / 3, gy = toY(gv)
              doc.setDrawColor(...BORDER); doc.setLineWidth(0.15); doc.line(x0, gy, x0 + w, gy)
              doc.setTextColor(...SUBT); doc.text(clean(formatCompactCurrency(gv)), M + pl - 2, gy + 1.4, { align: "right" })
            }
            const zeroY = toY(0)
            const fill = last >= 0 ? FILL_G : FILL_R
            doc.setFillColor(fill[0], fill[1], fill[2])
            for (let i = 1; i < equity.length; i++) {
              const xa = toX(i - 1), ya = toY(equity[i - 1]!), xb = toX(i), yb = toY(equity[i]!)
              doc.triangle(xa, zeroY, xa, ya, xb, yb, "F"); doc.triangle(xa, zeroY, xb, yb, xb, zeroY, "F")
            }
            doc.setDrawColor(...SUBT); doc.setLineWidth(0.2); doc.line(x0, zeroY, x0 + w, zeroY)
            const lc = last >= 0 ? GREEN : RED
            doc.setDrawColor(lc[0], lc[1], lc[2]); doc.setLineWidth(0.7)
            for (let i = 1; i < equity.length; i++) doc.line(toX(i - 1), toY(equity[i - 1]!), toX(i), toY(equity[i]!))
          }
          y += boxH + 8
        }

        // ── Stat-grid helper (proper implementation) ──────────────────────────
        function grid(items: Stat[], cols: number) {
          const gap = 4
          const cw  = (contentW - gap * (cols - 1)) / cols
          const ch  = 14
          const rows = Math.ceil(items.length / cols)
          for (let r = 0; r < rows; r++) {
            ensure(ch + gap)
            for (let c = 0; c < cols; c++) {
              const idx = r * cols + c
              if (idx >= items.length) break
              const s = items[idx]!
              const x = M + c * (cw + gap)
              doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
              doc.roundedRect(x, y, cw, ch, 1.5, 1.5, "S")
              doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); doc.setTextColor(...SUBT)
              doc.text(s.label.toUpperCase(), x + 3.5, y + 5)
              doc.setFont("helvetica", "bold"); doc.setFontSize(11)
              const col = colorOf(s.tone); doc.setTextColor(col[0], col[1], col[2])
              doc.text(clean(s.value), x + 3.5, y + 11)
            }
            y += ch + gap
          }
          y += 4
        }

        // ── Table helper ──────────────────────────────────────────────────────
        function tableHeader(cols: Col[]) {
          doc.setFillColor(...CARD); doc.rect(M, y, contentW, 7, "F")
          doc.setFont("helvetica", "bold"); doc.setFontSize(7.2); doc.setTextColor(...SUBT)
          let cx = M
          for (const c of cols) {
            const tx = c.align === "right" ? cx + c.w - 2 : cx + 2
            doc.text(c.title.toUpperCase(), tx, y + 4.8, { align: c.align ?? "left" })
            cx += c.w
          }
          y += 7
        }
        function table(cols: Col[], rows: string[][]) {
          ensure(7 + 6.5)
          tableHeader(cols)
          doc.setFontSize(8)
          rows.forEach((r, ri) => {
            if (y + 6.5 > BOTTOM) { newPage(); tableHeader(cols); doc.setFontSize(8) }
            if (ri % 2 === 1) { doc.setFillColor(...ZEBRA); doc.rect(M, y, contentW, 6.5, "F") }
            let cx = M
            cols.forEach((c, ci) => {
              const v = r[ci] ?? ""
              const col = c.pnl ? colorOf(toneOf(v)) : INK
              doc.setFont("helvetica", c.pnl ? "bold" : "normal")
              doc.setTextColor(col[0], col[1], col[2])
              const tx = c.align === "right" ? cx + c.w - 2 : cx + 2
              doc.text(clean(v), tx, y + 4.4, { align: c.align ?? "left" })
              cx += c.w
            })
            y += 6.5
          })
          y += 6
        }

        // Breakdown table (Category / Trades / Win% / Net / Avg W / Avg L)
        const breakdownCols: Col[] = [
          { title: "Category", w: 50 },
          { title: "Trades",   w: 22, align: "right" },
          { title: "Win %",    w: 24, align: "right" },
          { title: "Net P&L",  w: 30, align: "right", pnl: true },
          { title: "Avg win",  w: 26, align: "right", pnl: true },
          { title: "Avg loss", w: 26, align: "right", pnl: true },
        ]
        const breakdownRow = (r: ReportRow): string[] => [
          r.label,
          String(r.trades),
          formatPct(r.winRate),
          formatCurrency(r.pnl),
          formatCurrency(r.avgWin),
          formatCurrency(r.avgLoss),
        ]
        function breakdownSection(title: string, rows: ReportRow[]) {
          if (rows.length === 0) return
          sectionTitle(title)
          table(breakdownCols, rows.map(breakdownRow))
        }

        // ── All-time stats grid ───────────────────────────────────────────────
        sectionTitle("Statistics")
        grid([
          { label: "Total trades",    value: String(ov.totalTrades) },
          { label: "Winning trades",  value: String(ov.winningTrades) },
          { label: "Losing trades",   value: String(ov.losingTrades) },
          { label: "Expectancy",      value: formatCurrency(ps.tradeExpectancy), tone: ps.tradeExpectancy >= 0 ? "pos" : "neg" },
          { label: "Avg trade P&L",   value: formatCurrency(ov.avgTradePnl), tone: ov.avgTradePnl >= 0 ? "pos" : "neg" },
          { label: "Avg hold time",   value: formatDurationMs(ov.avgHoldAllMs) },
          { label: "Trading days",    value: String(ov.tradingDays) },
          { label: "Win / loss days", value: `${ov.winningDays} / ${ov.losingDays}` },
          { label: "Avg daily P&L",   value: formatCurrency(ps.avgDailyNetPnl), tone: ps.avgDailyNetPnl >= 0 ? "pos" : "neg" },
          { label: "Avg win day",     value: formatCurrency(ov.avgWinningDayPnl), tone: "pos" },
          { label: "Avg loss day",    value: formatCurrency(ov.avgLosingDayPnl), tone: "neg" },
          { label: "Max drawdown",    value: formatCurrency(ov.maxDrawdown), tone: ov.maxDrawdown < 0 ? "neg" : undefined },
          { label: "Largest win",     value: formatCurrency(ov.largestProfit), tone: "pos" },
          { label: "Largest loss",    value: formatCurrency(ov.largestLoss), tone: "neg" },
          { label: "Max consec W / L",value: `${ov.maxConsecWins} / ${ov.maxConsecLosses}` },
          { label: "Commissions",     value: formatCurrency(ov.totalCommissions), tone: "neg" },
        ], 4)

        // ── Breakdown tables ──────────────────────────────────────────────────
        breakdownSection("By day of week", data.dayTime.rows)
        breakdownSection("By instrument", data.symbols.rows)
        breakdownSection("By playbook", data.playbooks.rows)
        breakdownSection("By month", data.months.rows)

        // ── R-multiples ───────────────────────────────────────────────────────
        if (data.rStats.coverage.withR > 0) {
          const r = data.rStats
          sectionTitle("R-multiples")
          grid([
            { label: "Expectancy (R)", value: `${r.expectancy >= 0 ? "+" : ""}${r.expectancy.toFixed(2)}R`, tone: r.expectancy >= 0 ? "pos" : "neg" },
            { label: "SQN",            value: r.sqn.toFixed(2) },
            { label: "Win rate",       value: formatPct(r.winRate) },
            { label: "Total R",        value: `${r.totalR >= 0 ? "+" : ""}${r.totalR.toFixed(1)}R`, tone: r.totalR >= 0 ? "pos" : "neg" },
            { label: "Best R",         value: `+${r.bestR.toFixed(2)}R`, tone: "pos" },
            { label: "Worst R",        value: `${r.worstR.toFixed(2)}R`, tone: "neg" },
            { label: "Avg win R",      value: `+${r.avgRWin.toFixed(2)}R`, tone: "pos" },
            { label: "Coverage",       value: `${r.coverage.withR} / ${r.coverage.total}` },
          ], 4)
        }

        // ── Mistakes ──────────────────────────────────────────────────────────
        if (data.mistakes.length > 0) {
          sectionTitle("Mistakes")
          table(
            [
              { title: "Mistake", w: 70 },
              { title: "Trades",  w: 26, align: "right" },
              { title: "Net P&L", w: 34, align: "right", pnl: true },
              { title: "Avg P&L", w: 26, align: "right", pnl: true },
              { title: "Win %",   w: 22, align: "right" },
            ],
            data.mistakes.map(m => [
              m.label, String(m.trades), formatCurrency(m.netPnl), formatCurrency(m.avgPnl), formatPct(m.winRate),
            ]),
          )
        }

        // ── Compare (this vs last month) ──────────────────────────────────────
        {
          const a = data.compare.a, b = data.compare.b
          sectionTitle(`${a.label} vs ${b.label}`)
          table(
            [
              { title: "Metric", w: 60 },
              { title: a.sub,    w: 59, align: "right" },
              { title: b.sub,    w: 59, align: "right" },
            ],
            [
              ["Net P&L",       formatCurrency(a.net),            formatCurrency(b.net)],
              ["Trades",        String(a.trades),                 String(b.trades)],
              ["Win rate",      formatPct(a.winRate),             formatPct(b.winRate)],
              ["Profit factor", a.profitFactor.toFixed(2),        b.profitFactor.toFixed(2)],
              ["Avg daily P&L", formatCurrency(a.avgDailyNetPnl), formatCurrency(b.avgDailyNetPnl)],
              ["Max drawdown",  formatCurrency(a.maxDrawdown),    formatCurrency(b.maxDrawdown)],
              ["Expectancy",    formatCurrency(a.tradeExpectancy),formatCurrency(b.tradeExpectancy)],
            ],
          )
        }

        footer()
        doc.save(`report-${new Date().toISOString().slice(0, 10)}.pdf`)
      } catch {
        setError(true)
        setTimeout(() => setError(false), 4000)
      }
    })
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant="error" message={REPORTS.EXPORT_ERROR} />
        </div>
      )}
      <button
        type="button"
        onClick={handleExport}
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 h-8 rounded-sm text-base text-text-dim border border-border hover:border-border-hi transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <polyline points="9 15 12 18 15 15" />
        </svg>
        {isPending ? REPORTS.EXPORTING : REPORTS.EXPORT_PDF}
      </button>
    </>
  )
}

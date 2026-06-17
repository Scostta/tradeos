// ── AI Insights aggregation layer ─────────────────────────────────────────────
// Pure: Trade[] in, a compact InsightsInput out. No async, no Supabase, no throws.
// This is the only place that decides WHICH numbers Claude sees — the model
// narrates them but never computes them. Reuses the existing calculation layer
// (metrics / reports / mistakes / r-multiples / playbook-adherence) and adds the
// three behavioral signals that don't exist elsewhere: hour-of-day performance,
// post-loss tilt, and overtrading by daily volume.
//
// Time bucketing uses the trader's timezone (threaded in as `timeZone`, default
// UTC) so hour-of-day / day-of-week / daily signals reflect their local clock.
// All zoned date math goes through ~/helpers/tz.

import { winRate, totalNetPnl, avgWin, avgLoss, profitFactor, maxDrawdown } from "~/lib/calculations/metrics"
import { computeReportBreakdown, byDayOfWeek } from "~/lib/calculations/reports"
import { computeMistakeStats } from "~/lib/calculations/mistakes"
import { zonedDateKey, zonedHour } from "~/helpers/tz"
import type { Trade } from "~/types/trade"
import type { RStats } from "~/types/reports"
import type { PlaybookAdherence } from "~/types/playbook"
import type {
  InsightsInput,
  InsightsOverview,
  HourBucket,
  DowSignal,
  SessionBucket,
  SessionKey,
  StreakSignal,
  VolumeSignal,
  AdherenceSignal,
  RSignal,
} from "~/types/insights"

const round2 = (n: number): number => Math.round(n * 100) / 100
const round4 = (n: number): number => Math.round(n * 10000) / 10000

const TOP_MISTAKES = 5

function byEntryTime(a: Trade, b: Trade): number {
  return new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
}

// ── Overview ──────────────────────────────────────────────────────────────────

function buildOverview(trades: Trade[]): InsightsOverview {
  const wr = winRate(trades)
  const aw = avgWin(trades)
  const al = avgLoss(trades)
  return {
    totalTrades:  trades.length,
    netPnl:       round2(totalNetPnl(trades)),
    winRate:      round4(wr),
    profitFactor: round2(profitFactor(trades)),
    expectancy:   round2(wr * aw + (1 - wr) * al),
    maxDrawdown:  round2(maxDrawdown(trades)),
    avgWin:       round2(aw),
    avgLoss:      round2(al),
  }
}

// ── Hour-of-day ───────────────────────────────────────────────────────────────

/** Win rate and net P&L per local hour, sorted by hour, only hours with trades. */
export function buildHourBuckets(trades: Trade[], timeZone = "UTC"): HourBucket[] {
  const map = new Map<number, Trade[]>()
  for (const t of trades) {
    const hour = zonedHour(t.entryTime, timeZone)
    const bucket = map.get(hour) ?? []
    bucket.push(t)
    map.set(hour, bucket)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, ts]) => ({
      hour,
      trades:  ts.length,
      winRate: round4(winRate(ts)),
      netPnl:  round2(totalNetPnl(ts)),
    }))
}

// ── Day of week (reuses the reports breakdown) ────────────────────────────────

function buildDowSignals(trades: Trade[], timeZone = "UTC"): DowSignal[] {
  return computeReportBreakdown(trades, byDayOfWeek(timeZone)).map(r => ({
    label:   r.label,
    trades:  r.trades,
    winRate: round4(r.winRate),
    netPnl:  round2(r.pnl),
  }))
}

// ── Session (RTH / ETH / overnight) ───────────────────────────────────────────

const SESSION_ORDER: SessionKey[] = ["RTH", "ETH", "overnight", "unspecified"]

function buildSessionBuckets(trades: Trade[]): SessionBucket[] {
  const map = new Map<SessionKey, Trade[]>()
  for (const t of trades) {
    const key: SessionKey = t.session ?? "unspecified"
    const bucket = map.get(key) ?? []
    bucket.push(t)
    map.set(key, bucket)
  }
  return SESSION_ORDER.filter(k => map.has(k)).map(k => {
    const ts = map.get(k)!
    return {
      session: k,
      trades:  ts.length,
      winRate: round4(winRate(ts)),
      netPnl:  round2(totalNetPnl(ts)),
    }
  })
}

// ── Tilt / revenge trading ────────────────────────────────────────────────────

/** Longest run of consecutive losing trades across the (time-sorted) set. */
function maxConsecutiveLosses(sorted: Trade[]): number {
  let max = 0
  let cur = 0
  for (const t of sorted) {
    cur = t.netPnl <= 0 ? cur + 1 : 0
    if (cur > max) max = cur
  }
  return max
}

/**
 * Trades that immediately follow a losing trade in the same account (sorted by
 * entryTime), compared with the baseline of every trade. The gap exposes tilt.
 */
export function buildStreakSignal(trades: Trade[]): StreakSignal {
  const byAccount = new Map<string, Trade[]>()
  for (const t of trades) {
    const bucket = byAccount.get(t.accountId) ?? []
    bucket.push(t)
    byAccount.set(t.accountId, bucket)
  }

  const afterLoss: Trade[] = []
  let maxStreak = 0
  for (const bucket of byAccount.values()) {
    const sorted = [...bucket].sort(byEntryTime)
    maxStreak = Math.max(maxStreak, maxConsecutiveLosses(sorted))
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1]!.netPnl <= 0) afterLoss.push(sorted[i]!)
    }
  }

  const stats = (ts: Trade[]): { trades: number; winRate: number; avgNetPnl: number } => ({
    trades:    ts.length,
    winRate:   round4(winRate(ts)),
    avgNetPnl: round2(ts.length ? totalNetPnl(ts) / ts.length : 0),
  })

  return {
    afterLoss:            stats(afterLoss),
    baseline:             stats(trades),
    maxConsecutiveLosses: maxStreak,
  }
}

// ── Overtrading by daily volume ───────────────────────────────────────────────

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

/**
 * Splits trading days at the median trades-per-day and compares average daily
 * net P&L on busy vs quiet days. Days with count > median are "high volume".
 * Returns zeroed groups when there are fewer than two trading days.
 */
export function buildVolumeSignal(trades: Trade[], timeZone = "UTC"): VolumeSignal {
  const byDay = new Map<string, Trade[]>()
  for (const t of trades) {
    const key = zonedDateKey(t.entryTime, timeZone)
    const bucket = byDay.get(key) ?? []
    bucket.push(t)
    byDay.set(key, bucket)
  }

  const days = [...byDay.values()].map(ts => ({
    count:  ts.length,
    netPnl: totalNetPnl(ts),
  }))

  const empty = { days: 0, avgDailyNetPnl: 0, avgTradesPerDay: 0 }
  if (days.length < 2) {
    return { medianTradesPerDay: days[0]?.count ?? 0, highVolumeDays: empty, lowVolumeDays: empty }
  }

  const med = median(days.map(d => d.count))
  const high = days.filter(d => d.count > med)
  const low  = days.filter(d => d.count <= med)

  const summarize = (group: typeof days): VolumeSignal["highVolumeDays"] => {
    if (group.length === 0) return empty
    const totalPnl    = group.reduce((s, d) => s + d.netPnl, 0)
    const totalTrades = group.reduce((s, d) => s + d.count, 0)
    return {
      days:            group.length,
      avgDailyNetPnl:  round2(totalPnl / group.length),
      avgTradesPerDay: round2(totalTrades / group.length),
    }
  }

  return {
    medianTradesPerDay: med,
    highVolumeDays:     summarize(high),
    lowVolumeDays:      summarize(low),
  }
}

// ── Optional signals derived from extra inputs ────────────────────────────────

function buildRSignal(r: RStats): RSignal | null {
  if (r.coverage.withR === 0) return null
  return {
    expectancy: r.expectancy,
    winRate:    round4(r.winRate),
    sqn:        r.sqn,
    bestR:      r.bestR,
    worstR:     r.worstR,
    coverage:   r.coverage,
  }
}

function buildAdherenceSignal(a: PlaybookAdherence): AdherenceSignal {
  return {
    tracked:         a.tracked,
    followedWinRate: round4(a.followed.winRate),
    followedNetPnl:  round2(a.followed.netPnl),
    brokeWinRate:    round4(a.broke.winRate),
    brokeNetPnl:     round2(a.broke.netPnl),
  }
}

// ── Top-level builder ─────────────────────────────────────────────────────────

/**
 * Builds the full Claude payload from the filtered trades plus two optional
 * pre-computed signals the trade list alone can't produce:
 *   - rStats:    from computeRStats (needs per-account risk fallbacks)
 *   - adherence: from computePortfolioAdherence (needs parsed playbook rules)
 * The caller (server action) wires those; both are omitted gracefully.
 */
export function buildInsightsInput(
  trades: Trade[],
  opts: { rStats?: RStats; adherence?: PlaybookAdherence | null; timeZone?: string } = {},
): InsightsInput {
  const timeZone = opts.timeZone ?? "UTC"
  return {
    overview:    buildOverview(trades),
    byHour:      buildHourBuckets(trades, timeZone),
    byDayOfWeek: buildDowSignals(trades, timeZone),
    bySession:   buildSessionBuckets(trades),
    topMistakes: computeMistakeStats(trades).slice(0, TOP_MISTAKES),
    rMultiples:  opts.rStats ? buildRSignal(opts.rStats) : null,
    adherence:   opts.adherence ? buildAdherenceSignal(opts.adherence) : null,
    streaks:     buildStreakSignal(trades),
    volume:      buildVolumeSignal(trades, timeZone),
  }
}

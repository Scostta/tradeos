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
import { isLoss } from "~/lib/calculations/outcome"
import { computeReportBreakdown, byDayOfWeek } from "~/lib/calculations/reports"
import { computeMistakeStats } from "~/lib/calculations/mistakes"
import { zonedDateKey, zonedHour } from "~/helpers/tz"
import { computeTiltReport } from "~/lib/calculations/tilt"
import type { TiltReport, TiltRow, TiltStats } from "~/lib/calculations/tilt"
import type { BeGroupKey, BeReport } from "~/lib/calculations/be-analysis"
import type { LimitBreach } from "~/lib/calculations/daily-limits"
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
  TiltBucket,
  TiltSignal,
  BreakEvenSignal,
  LimitsSignal,
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
    breakEvenTrades: trades.filter(t => t.breakEven).length,
    netPnl:       round2(totalNetPnl(trades)),
    winRate:      round4(wr),
    profitFactor: round2(profitFactor(trades)),
    expectancy:   round2(trades.length ? totalNetPnl(trades) / trades.length : 0),
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

/** Longest run of consecutive losing trades across the (time-sorted) set. BE trades neither extend nor break it. */
function maxConsecutiveLosses(sorted: Trade[]): number {
  let max = 0
  let cur = 0
  for (const t of sorted) {
    if (t.breakEven) continue
    cur = isLoss(t) ? cur + 1 : 0
    if (cur > max) max = cur
  }
  return max
}

function bucket(s: TiltStats): TiltBucket {
  return { trades: s.trades, winRate: s.winRate, avgNetPnl: s.avgNet, avgR: s.avgR }
}

function rowsToRecord<K extends string>(rows: TiltRow[]): Record<K, TiltBucket> {
  return Object.fromEntries(rows.map(r => [r.key, bucket(r.stats)])) as Record<K, TiltBucket>
}

/**
 * Same numbers as Reports → Tilt (computeTiltReport), plus the longest losing
 * streak per account across the whole history.
 */
export function buildTiltSignal(tilt: TiltReport, trades: Trade[]): TiltSignal {
  const prev = new Map(tilt.previous.map(r => [r.key, bucket(r.stats)]))
  const byAccount = new Map<string, Trade[]>()
  for (const t of trades) byAccount.set(t.accountId, [...(byAccount.get(t.accountId) ?? []), t])
  const maxStreak = Math.max(0, ...[...byAccount.values()].map(ts => maxConsecutiveLosses([...ts].sort(byEntryTime))))

  return {
    baseline: bucket(tilt.all),
    byPreviousTrade: {
      firstOfDay:     prev.get("first")!,
      afterWin:       prev.get("win")!,
      afterLoss:      prev.get("loss")!,
      afterBreakEven: prev.get("be")!,
    },
    afterLoss: {
      reentryWindowMinutes: tilt.windows,
      fastReentry:          bucket(tilt.afterLoss.fast),
      waitedLonger:         bucket(tilt.afterLoss.slow),
      sizedUp:              bucket(tilt.afterLoss.sizeUp),
      sameOrSmallerSize:    bucket(tilt.afterLoss.sameSize),
    },
    byLossStreakBefore:   rowsToRecord<"0" | "1" | "2" | "3+">(tilt.streak),
    byTradeNumberOfDay:   rowsToRecord<"1" | "2" | "3" | "4+">(tilt.tradeNumber),
    maxConsecutiveLosses: maxStreak,
  }
}

// ── Break-even ────────────────────────────────────────────────────────────────

const BE_MIN_GROUP_TRADES = 5
const BE_TOP_GROUPS = 5

/** Same numbers as Reports → Break-even (computeBeReport). Null without BE trades. */
export function buildBreakEvenSignal(be: BeReport): BreakEvenSignal | null {
  if (be.stats.total === 0) return null
  const reached = (level: number): number => be.stats.reached.find(r => r.level === level)?.count ?? 0

  const groups = (Object.entries(be.groups) as [BeGroupKey, BeReport["groups"][BeGroupKey]][])
    .flatMap(([dimension, rows]) => rows
      .filter(r => r.trades >= BE_MIN_GROUP_TRADES && r.rate > be.rate)
      .map(r => ({ dimension, label: r.label ?? "no playbook", trades: r.trades, breakEvenTrades: r.be, rate: r.rate })))
    .sort((a, b) => b.rate - a.rate || b.trades - a.trades)
    .slice(0, BE_TOP_GROUPS)

  return {
    trades:          be.stats.total,
    rate:            be.rate,
    netPnl:          be.netPnl,
    commissions:     be.commission,
    thresholdPoints: be.source.threshold,
    markedByHand:    { asBreakEven: be.source.forcedBe, asNotBreakEven: be.source.forcedNotBe },
    ifThreshold:     be.source.whatIf.map(w => ({ points: w.points, breakEvenTrades: w.be })),
    mfe: {
      measured:      be.stats.measured,
      avgR:          be.stats.avgMfeR,
      reachedHalfR:  reached(0.5),
      reached1R:     reached(1),
      reached2R:     reached(2),
      givenBackAt1R: be.stats.missedAt1R,
    },
    mae: {
      measured:      be.mae.measured,
      avgR:          be.mae.avgMaeR,
      nearStop:      be.mae.nearStop,
      barelyAgainst: be.mae.neverAtRisk,
    },
    highestRateGroups: groups,
  }
}

// ── Daily limits ──────────────────────────────────────────────────────────────

/** Counts of trades opened after a personal daily limit. Null when no account has limits. */
export function buildLimitsSignal(breaches: Map<string, LimitBreach[]> | null): LimitsSignal | null {
  if (breaches == null) return null
  const count = (b: LimitBreach): number => [...breaches.values()].filter(list => list.includes(b)).length
  return {
    tradesWithBreach: breaches.size,
    byType: {
      maxTrades:            count("trades"),
      maxDailyLoss:         count("loss"),
      lossStreak:           count("streak"),
      fastReentryAfterLoss: count("revenge"),
      sizedUpAfterLoss:     count("sizeUp"),
    },
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
 * Builds the full Claude payload from the filtered trades plus optional
 * pre-computed signals the trade list alone can't produce:
 *   - rStats:    from computeRStats (needs per-account risk fallbacks)
 *   - adherence: from computePortfolioAdherence (needs parsed playbook rules)
 *   - tilt:      from computeTiltReport (needs risk and per-account re-entry windows)
 *   - beReport:  from computeBeReport (needs risk, playbook names and the BE threshold)
 *   - breaches:  from limitBreaches (needs account limits); null = no limits set
 * The caller (insights query) wires those; missing ones are omitted gracefully.
 */
export function buildInsightsInput(
  trades: Trade[],
  opts: {
    rStats?:    RStats
    adherence?: PlaybookAdherence | null
    tilt?:      TiltReport
    beReport?:  BeReport
    breaches?:  Map<string, LimitBreach[]> | null
    timeZone?:  string
  } = {},
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
    tilt:        buildTiltSignal(opts.tilt ?? computeTiltReport({ trades, timeZone }), trades),
    breakEven:   opts.beReport ? buildBreakEvenSignal(opts.beReport) : null,
    limits:      buildLimitsSignal(opts.breaches ?? null),
    volume:      buildVolumeSignal(trades, timeZone),
  }
}

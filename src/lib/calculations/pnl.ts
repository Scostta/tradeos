// USD value of a 1.00 price-point move per contract, by clean instrument symbol.
// Used to auto-suggest gross P&L on manual trade entry; the user can override
// (odd fills, instruments not listed here) and the server never trusts this.
const POINT_VALUE: Record<string, number> = {
  NQ:  20,   MNQ: 2,
  ES:  50,   MES: 5,
  RTY: 50,   M2K: 5,
  YM:  5,    MYM: 0.5,
  CL:  1000, MCL: 100,
  GC:  100,  MGC: 10,
  SI:  5000,
  ZB:  1000, ZN: 1000,
}

export const KNOWN_INSTRUMENTS = Object.keys(POINT_VALUE)

export function pointValue(instrument: string): number | null {
  const symbol = instrument.trim().split(" ")[0]?.toUpperCase() ?? ""
  return POINT_VALUE[symbol] ?? null
}

export function computeGrossPnl(args: {
  instrument: string
  direction:  "long" | "short"
  entryPrice: number
  exitPrice:  number
  contracts:  number
}): number | null {
  const pv = pointValue(args.instrument)
  if (pv == null) return null
  if (![args.entryPrice, args.exitPrice, args.contracts].every(Number.isFinite)) return null
  if (args.contracts <= 0) return null

  const move = args.direction === "long"
    ? args.exitPrice - args.entryPrice
    : args.entryPrice - args.exitPrice

  return +(move * pv * args.contracts).toFixed(2)
}

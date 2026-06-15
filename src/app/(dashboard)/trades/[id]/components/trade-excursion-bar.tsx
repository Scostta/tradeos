import type { ReactElement } from "react"
import { formatCurrency } from "~/helpers/format"
import type { Trade } from "~/types/trade"

export function TradeExcursionBar({ trade }: { trade: Trade }): ReactElement | null {
  const mae = trade.mae ?? 0
  const mfe = trade.mfe ?? 0
  const net = trade.netPnl

  if (mae === 0 && mfe === 0) return null

  const range    = Math.max(Math.abs(mae), Math.abs(mfe), Math.abs(net), 1)
  const maeW     = (Math.abs(mae) / range) * 50
  const mfeW     = (Math.abs(mfe) / range) * 50
  const netW     = (Math.abs(net) / range) * 50
  const isProfit = net >= 0

  // Edge insight — only meaningful calculations, capped at 100% for winners
  const capturedPct = (isProfit && mfe > 0)
    ? Math.min(100, Math.round((net / mfe) * 100))
    : null
  const heatPct = (isProfit && mfe > 0 && mae > 0)
    ? Math.round((mae / mfe) * 100)
    : null

  return (
    <div className="card p-5">
      <div className="label-caps mb-4">EXCURSION · MAE / MFE</div>

      <div style={{ position: "relative", height: 70 }}>
        {/* Horizontal axis */}
        <div
          style={{
            position: "absolute", inset: "0 0 auto 0",
            top: 34, height: 1,
            background: "var(--color-border)",
          }}
        />
        {/* Center tick */}
        <div
          style={{
            position: "absolute", left: "50%", top: 30,
            width: 1, height: 10,
            background: "var(--color-border-hi)",
          }}
        />

        {/* MAE bar — left of center, red */}
        {mae !== 0 && (
          <div
            style={{
              position: "absolute", top: 14, height: 22,
              right: "50%", width: `${maeW}%`,
              background: "var(--color-loss)", opacity: 0.55,
              borderRadius: "3px 0 0 3px",
            }}
          >
            <div
              className="mono"
              style={{
                position: "absolute", top: -18, right: 0,
                fontSize: 10, color: "var(--color-loss)",
                whiteSpace: "nowrap",
              }}
            >
              MAE {formatCurrency(mae, { sign: false, decimals: 0 })}
            </div>
          </div>
        )}

        {/* MFE bar — right of center, green */}
        {mfe !== 0 && (
          <div
            style={{
              position: "absolute", top: 14, height: 22,
              left: "50%", width: `${mfeW}%`,
              background: "var(--color-profit)", opacity: 0.55,
              borderRadius: "0 3px 3px 0",
            }}
          >
            <div
              className="mono"
              style={{
                position: "absolute", top: -18, left: 0,
                fontSize: 10, color: "var(--color-profit)",
                whiteSpace: "nowrap",
              }}
            >
              MFE {formatCurrency(mfe, { sign: false, decimals: 0 })}
            </div>
          </div>
        )}

        {/* Net result marker — solid bar on top */}
        <div
          style={{
            position: "absolute", top: 14, height: 22,
            ...(isProfit ? { left: "50%" } : { right: "50%" }),
            width: `${netW}%`,
            background: isProfit ? "var(--color-profit)" : "var(--color-loss)",
            border: `1px solid ${isProfit ? "var(--color-profit)" : "var(--color-loss)"}`,
            borderRadius: isProfit ? "0 3px 3px 0" : "3px 0 0 3px",
          }}
        />

        {/* Net label */}
        <div
          className="mono"
          style={{
            position: "absolute", top: 42,
            ...(isProfit
              ? { left: `calc(50% + ${netW}%)`, transform: "translateX(-100%)" }
              : { right: `calc(50% + ${netW}%)`, transform: "translateX(100%)" }
            ),
            fontSize: 10,
            color: isProfit ? "var(--color-profit)" : "var(--color-loss)",
            paddingTop: 4,
            whiteSpace: "nowrap",
          }}
        >
          NET {formatCurrency(net, { sign: false, decimals: 0 })}
        </div>
      </div>

      {/* Edge insight */}
      <div className="mt-4 px-3 py-2.5 bg-surface-2 rounded-sm text-sm text-text-dim leading-relaxed">
        {isProfit && capturedPct !== null ? (
          <>
            <span className="text-accent font-medium">Edge:</span>{" "}
            You captured{" "}
            <span className="mono text-profit">{capturedPct}%</span>{" "}
            of the best move
            {heatPct !== null && (
              <> and gave back{" "}
                <span className="mono text-loss">{heatPct}%</span>{" "}
                in heat before exit
              </>
            )}.
          </>
        ) : mfe > 0 ? (
          <>
            <span className="text-loss font-medium">Loss:</span>{" "}
            Price moved{" "}
            <span className="mono text-profit">{formatCurrency(mfe, { sign: false, decimals: 0 })}</span>{" "}
            in your favor before reversing —{" "}
            max heat{" "}
            <span className="mono text-loss">{formatCurrency(mae, { sign: false, decimals: 0 })}</span>
            {mae > 0 && mfe > 0 && (
              <>, {Math.round((mae / mfe) * 100)}% of MFE</>
            )}.
          </>
        ) : (
          <>
            <span className="text-loss font-medium">Loss:</span>{" "}
            Price moved straight against you — max heat{" "}
            <span className="mono text-loss">{formatCurrency(mae, { sign: false, decimals: 0 })}</span>.
          </>
        )}
      </div>
    </div>
  )
}

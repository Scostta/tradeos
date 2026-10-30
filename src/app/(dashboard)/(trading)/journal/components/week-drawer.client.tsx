"use client"

import type { ReactElement, ReactNode } from "react"
import { JOURNAL } from "~/constants/copies/journal"
import { formatCurrency, formatPct } from "~/helpers/format"
import type { WeekRecap } from "~/lib/calculations/week-recap"
import { Button } from "~/lib/ui/button"
import { XIcon } from "~/lib/ui/icons/x-icon"
import { cn } from "~/utils/cn"

const W = JOURNAL.WEEK

function dayLabel(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric" }): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" })
}

const pnlCls = (n: number) => (n > 0 ? "text-profit" : n < 0 ? "text-loss" : "text-text-dim")

function Section({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <span className="label-caps">{label}</span>
      {children}
    </div>
  )
}

function moodColor(mood: number): string {
  return JOURNAL.MOODS.find(m => m.v === mood)?.color ?? "var(--color-text-mute)"
}

// Resumen de una fila del calendario (domingo → sábado): cifras de la semana,
// días con su diario, errores, playbooks, límites y BE. Solo lectura.
export function WeekDrawer({ recap, onClose }: { recap: WeekRecap; onClose: () => void }): ReactElement {
  const delta = recap.prevNetPnl != null ? recap.netPnl - recap.prevNetPnl : null
  const breachTotal = recap.breaches.total
  const limitParts = [
    recap.breaches.trades > 0 && W.LIMIT_TRADES.replace("{n}", String(recap.breaches.trades)),
    recap.breaches.loss > 0 && W.LIMIT_LOSS.replace("{n}", String(recap.breaches.loss)),
    recap.breaches.streak > 0 && W.LIMIT_STREAK.replace("{n}", String(recap.breaches.streak)),
    recap.breaches.revenge > 0 && W.LIMIT_REVENGE.replace("{n}", String(recap.breaches.revenge)),
    recap.breaches.sizeUp > 0 && W.LIMIT_SIZE_UP.replace("{n}", String(recap.breaches.sizeUp)),
  ].filter(Boolean)

  return (
    <>
      <style>{`
        @keyframes drawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .week-drawer { width: 100%; }
        @media (min-width: 768px) { .week-drawer { width: 460px; } }
      `}</style>

      <div className="fixed inset-0 z-30" onClick={onClose} />

      <aside
        className="week-drawer fixed top-0 right-0 h-full z-40 flex flex-col bg-surface overflow-hidden"
        style={{ borderLeft: "1px solid var(--color-border)", boxShadow: "-8px 0 32px rgba(0,0,0,0.4)", animation: "drawerSlideIn .25s cubic-bezier(.2,.7,.3,1)" }}
      >
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div>
            <div className="label-caps tracking-widest">{W.TITLE}</div>
            <div className="mono text-2xl font-semibold text-text tracking-tight mt-0.5">
              {dayLabel(recap.from, { month: "short", day: "numeric" })} – {dayLabel(recap.to, { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
          <Button variant="icon" onClick={onClose} className="shrink-0 mt-0.5"><XIcon /></Button>
        </div>

        {recap.trades === 0 && recap.days.length === 0 ? (
          <div className="p-4 text-sm text-text-mute">{W.EMPTY}</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5 p-3 border-b border-border">
              <div>
                <div className="label-caps mb-1">{W.NET}</div>
                <div className={cn("mono text-xl font-semibold", pnlCls(recap.netPnl))}>{formatCurrency(recap.netPnl, { decimals: 0 })}</div>
                {delta != null && (
                  <div className="mono text-xxs text-text-mute mt-0.5">
                    {W.VS_PREV.replace("{amount}", formatCurrency(delta, { decimals: 0 }))}
                  </div>
                )}
              </div>
              <div>
                <div className="label-caps mb-1">{W.TRADES}</div>
                <div className="mono text-xl font-semibold text-text">{recap.trades}</div>
                <div className="mono text-xxs text-text-mute mt-0.5">
                  {recap.wins}W · {recap.losses}L{recap.breakEven > 0 && ` · ${recap.breakEven}BE`}
                </div>
              </div>
              <div>
                <div className="label-caps mb-1">{W.WIN_RATE}</div>
                <div className="mono text-xl font-semibold text-accent">{recap.trades > 0 ? formatPct(recap.winRate, 0) : "—"}</div>
                <div className="mono text-xxs text-text-mute mt-0.5">PF {recap.trades > 0 ? recap.profitFactor.toFixed(2) : "—"}</div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex flex-col gap-5">
              {(breachTotal > 0 || recap.beReached1R > 0 || recap.reviewed.done < recap.reviewed.total) && (
                <div className="flex flex-col gap-1.5">
                  {breachTotal > 0 && (
                    <div className="text-sm text-loss">{W.LIMITS.replace("{n}", String(breachTotal))} <span className="text-text-mute">({limitParts.join(" · ")})</span></div>
                  )}
                  {recap.beReached1R > 0 && <div className="text-sm text-short">{W.BE_1R.replace("{n}", String(recap.beReached1R))}</div>}
                  {recap.reviewed.done < recap.reviewed.total && (
                    <div className="text-sm text-text-dim">{W.REVIEWED.replace("{done}", String(recap.reviewed.done)).replace("{total}", String(recap.reviewed.total))}</div>
                  )}
                </div>
              )}

              <Section label={W.DAYS}>
                <div className="flex flex-col gap-1">
                  {recap.days.map(d => (
                    <div key={d.date} className="bg-surface-2 rounded-sm px-2.5 py-2 flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="mono text-text-dim" style={{ width: 56 }}>{dayLabel(d.date)}</span>
                        {d.mood != null && <span className="size-2 rounded-full shrink-0" style={{ background: moodColor(d.mood) }} title={JOURNAL.MOODS.find(m => m.v === d.mood)?.label} />}
                        {d.followedPlan != null && (
                          <span className={cn("text-xxs font-semibold uppercase", d.followedPlan ? "text-profit" : "text-loss")}>
                            {d.followedPlan ? W.PLAN_YES : W.PLAN_NO}
                          </span>
                        )}
                        <span className="mono text-xs text-text-mute ml-auto">{d.trades > 0 ? `${d.trades} tr` : ""}</span>
                        <span className={cn("mono text-sm font-semibold text-right", pnlCls(d.net))} style={{ width: 72 }}>
                          {d.trades > 0 ? formatCurrency(d.net, { decimals: 0 }) : "—"}
                        </span>
                      </div>
                      {d.notes && <p className="text-xs text-text-dim whitespace-pre-line">{d.notes}</p>}
                    </div>
                  ))}
                </div>
              </Section>

              {recap.mistakes.length > 0 && (
                <Section label={W.MISTAKES}>
                  <div className="flex flex-col gap-1">
                    {recap.mistakes.map(m => (
                      <div key={m.label} className="flex items-center gap-2 text-sm">
                        <span className="text-text flex-1 truncate">{m.label}</span>
                        <span className="mono text-xs text-text-mute">{m.trades} tr</span>
                        <span className={cn("mono text-sm text-right", pnlCls(m.netPnl))} style={{ width: 72 }}>{formatCurrency(m.netPnl, { decimals: 0 })}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {recap.playbooks.length > 0 && (
                <Section label={W.PLAYBOOKS}>
                  <div className="flex flex-col gap-1">
                    {recap.playbooks.map(p => (
                      <div key={p.name ?? "none"} className="flex items-center gap-2 text-sm">
                        <span className={cn("flex-1 truncate", p.name ? "text-text" : "text-text-mute")}>{p.name ?? W.NO_PLAYBOOK}</span>
                        <span className="mono text-xs text-text-mute">{p.trades} tr</span>
                        <span className={cn("mono text-sm text-right", pnlCls(p.netPnl))} style={{ width: 72 }}>{formatCurrency(p.netPnl, { decimals: 0 })}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  )
}

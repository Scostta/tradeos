import type { ReactElement } from "react"
import Link from "next/link"
import { DASHBOARD } from "~/constants/copies/dashboard"
import { COMMON } from "~/constants/copies/common"
import { APP_URLS } from "~/constants/app-urls"
import { cn } from "~/utils/cn"

type Step = {
  title:    string
  desc:     string
  cta:      string
  href:     string
  done:     boolean
  primary?: boolean
}

const O = DASHBOARD.ONBOARDING

function CheckIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function Onboarding({ playbookDone, prefsDone }: { playbookDone: boolean; prefsDone: boolean }): ReactElement {
  const steps: Step[] = [
    { title: O.STEPS.IMPORT_TITLE,   desc: O.STEPS.IMPORT_DESC,   cta: O.STEPS.IMPORT_CTA,   href: APP_URLS.IMPORT,    done: false,        primary: true },
    { title: O.STEPS.PLAYBOOK_TITLE, desc: O.STEPS.PLAYBOOK_DESC, cta: O.STEPS.PLAYBOOK_CTA, href: APP_URLS.PLAYBOOKS, done: playbookDone },
    { title: O.STEPS.PREFS_TITLE,    desc: O.STEPS.PREFS_DESC,    cta: O.STEPS.PREFS_CTA,    href: APP_URLS.SETTINGS,  done: prefsDone },
  ]

  return (
    <div className="flex-1 overflow-auto page-pad flex justify-center">
      <div className="w-full max-w-2xl flex flex-col gap-6 py-6">

        {/* Welcome header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-lg mono font-semibold text-2xl text-bg"
            style={{ background: "var(--color-accent)", boxShadow: "0 0 24px var(--accent-glow)" }}
          >
            {COMMON.BRAND.LOGO}
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-text">{O.WELCOME}</h2>
            <p className="text-sm text-text-mute mt-1">{O.SUBTITLE}</p>
          </div>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className={cn(
                "card p-4 flex items-start gap-4",
                step.done && "opacity-70",
              )}
            >
              {/* Status badge */}
              <div
                className={cn(
                  "shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mt-0.5",
                  step.done
                    ? "bg-profit/15 text-profit"
                    : "bg-surface-2 text-text border border-border",
                )}
              >
                {step.done ? <CheckIcon /> : i + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-md font-medium text-text">{step.title}</span>
                  {step.done && <span className="label-caps text-profit">{O.DONE}</span>}
                </div>
                <p className="text-sm text-text-mute mt-0.5">{step.desc}</p>
              </div>

              {/* CTA */}
              <Link
                href={step.href}
                className={cn(
                  "shrink-0 self-center text-sm whitespace-nowrap rounded-md px-3 py-2 transition-colors",
                  step.primary
                    ? "btn-accent"
                    : "border border-border text-text-dim hover:border-border-hi hover:text-text",
                )}
              >
                {step.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { SettingsIcon } from "~/lib/ui/icons/settings-icon"
import type { InvestSettings } from "~/types/invest"
import { Modal } from "./modal.client"
import { SettingsForm } from "./settings-form.client"

export function SettingsButton({ settings, started }: { settings: InvestSettings; started: boolean }): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost inline-flex items-center gap-2">
        <SettingsIcon />
        {INVEST.SETTINGS.OPEN_CTA}
      </button>
      {open && (
        <Modal title={INVEST.SETTINGS.TITLE} onClose={() => setOpen(false)}>
          <SettingsForm settings={settings} started={started} onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </Modal>
      )}
    </>
  )
}

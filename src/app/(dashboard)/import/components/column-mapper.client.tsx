"use client"

import { useState } from "react"
import type { ReactElement } from "react"
import { CANONICAL_IMPORT_FIELDS } from "~/types/import"
import type { ColumnMapping, CsvInspection } from "~/types/import"
import { IMPORT } from "~/constants/copies/import"
import { Button } from "~/lib/ui/button"

const SELECT_CLS = "bg-surface-2 border border-border rounded-sm px-2.5 py-1.5 text-sm text-text w-full outline-none focus:border-border-hi"

type Props = {
  inspection:     CsvInspection
  initialMapping: ColumnMapping
  onCancel:       () => void
  onContinue:     (mapping: ColumnMapping, accountFallback: string) => void
}

export function ColumnMapper({ inspection, initialMapping, onCancel, onContinue }: Props): ReactElement {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping)
  const [account, setAccount] = useState("")
  const [error, setError]     = useState<string | null>(null)

  function setField(key: string, value: string) {
    setMapping((m) => ({ ...m, [key]: value === "" ? undefined : value }))
    setError(null)
  }

  function handleContinue() {
    const missing = CANONICAL_IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key])
    if (missing.length > 0) return setError(IMPORT.MAPPING.ERR_REQUIRED)
    if (!mapping.account && account.trim() === "") return setError(IMPORT.MAPPING.ERR_ACCOUNT)
    onContinue(mapping, account)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-text">{IMPORT.MAPPING.TITLE}</h2>
        <p className="text-sm text-text-mute mt-1">{IMPORT.MAPPING.SUBTITLE}</p>
      </div>

      {/* Field → column mapping */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CANONICAL_IMPORT_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label className="label-caps flex items-center gap-1.5">
              {f.label}
              {f.required && <span className="text-xxs text-accent normal-case tracking-normal">· {IMPORT.MAPPING.REQUIRED}</span>}
            </label>
            <select
              value={mapping[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">{IMPORT.MAPPING.NONE}</option>
              {inspection.headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Account fallback */}
      <div className="card p-4 flex flex-col gap-1.5">
        <label className="label-caps">{IMPORT.MAPPING.ACCOUNT_DEFAULT}</label>
        <input
          type="text"
          value={account}
          onChange={(e) => { setAccount(e.target.value); setError(null) }}
          placeholder={IMPORT.MAPPING.ACCOUNT_PLACEHOLDER}
          className={SELECT_CLS}
        />
        <p className="text-xxs text-text-mute">{IMPORT.MAPPING.ACCOUNT_HINT}</p>
      </div>

      {/* Sample preview */}
      {inspection.sampleRows.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border label-caps">{IMPORT.MAPPING.SAMPLE}</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {inspection.headers.map((h) => (
                    <th key={h} className="label-caps px-3 py-2 text-left whitespace-nowrap font-normal text-text-mute">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspection.sampleRows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {inspection.headers.map((_, c) => (
                      <td key={c} className="px-3 py-1.5 mono text-xs text-text-dim whitespace-nowrap">{row[c] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-loss">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>{IMPORT.MAPPING.CANCEL}</Button>
        <Button variant="accent" onClick={handleContinue}>{IMPORT.MAPPING.CONTINUE}</Button>
      </div>
    </div>
  )
}

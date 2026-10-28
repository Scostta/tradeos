"use client"

import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import { FINANCE_FIELDS, mappingIsComplete } from "~/lib/finance/parsers/generic"
import type { CsvInspection, FinanceField, FinanceMapping } from "~/lib/finance/parsers/generic"
import { INPUT_CLS } from "~/lib/ui/form"

const I = MONEY.IMPORT

type Props = {
  inspection: CsvInspection
  mapping:    FinanceMapping
  onChange:   (m: FinanceMapping) => void
  onContinue: () => void
  onCancel:   () => void
}

// §3.2.2: formato desconocido → el usuario dice qué columna es cada campo,
// viendo 5 filas de muestra. Nada se importa con un mapeo incompleto.
export function ColumnMapper({ inspection, mapping, onChange, onContinue, onCancel }: Props): ReactElement {
  function set(field: FinanceField, value: string) {
    const next = { ...mapping }
    if (value === "") delete next[field]
    else next[field] = Number(value)
    onChange(next)
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border">
        <div className="text-md font-semibold text-text">{I.MAPPING_TITLE}</div>
        <p className="text-sm text-text-mute mt-0.5">{I.MAPPING_HINT}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-4 py-4">
        {FINANCE_FIELDS.map(({ key }) => (
          <label key={key} className="flex flex-col gap-1.5">
            <span className="label-caps">{I.FIELDS[key]}</span>
            <select value={mapping[key] ?? ""} onChange={e => set(key, e.target.value)} className={INPUT_CLS}>
              <option value="">{I.MAPPING_NONE}</option>
              {inspection.headers.map((h, i) => <option key={i} value={i}>{h || `#${i + 1}`}</option>)}
            </select>
          </label>
        ))}
      </div>

      <div className="overflow-x-auto border-t border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {inspection.headers.map((h, i) => (
                <th key={i} className="label-caps px-3 py-2 border-b border-border text-left whitespace-nowrap">{h || `#${i + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inspection.sampleRows.map((row, r) => (
              <tr key={r} className="border-b border-border last:border-0">
                {inspection.headers.map((_, i) => (
                  <td key={i} className="px-3 py-2 mono text-xs text-text-dim whitespace-nowrap">{row[i] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        <button type="button" onClick={onCancel} className="btn-ghost">{I.CANCEL}</button>
        <button
          type="button" onClick={onContinue} disabled={!mappingIsComplete(mapping)}
          className="btn-accent disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {I.CONTINUE}
        </button>
      </div>
    </div>
  )
}

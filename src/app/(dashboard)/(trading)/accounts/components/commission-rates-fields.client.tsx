"use client";

import { useState } from "react";
import type { ReactElement } from "react";
import { ACCOUNTS } from "~/constants/copies/accounts";

const C = ACCOUNTS.EDITOR.COMMISSIONS;
const INPUT = "bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi";

// Tarifa ida y vuelta por contrato de cada instrumento de la cuenta. Vacío =
// sin tarifa (los trades sin comisión del bróker se quedan a 0).
export function CommissionRatesFields({ rates, onChange }: {
  rates:    Record<string, string>      // instrumento → importe tecleado
  onChange: (next: Record<string, string>) => void
}): ReactElement {
  const [adding, setAdding] = useState("");
  const instruments = Object.keys(rates).sort();

  function add() {
    const symbol = adding.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(symbol) || symbol in rates) return;
    onChange({ ...rates, [symbol]: "" });
    setAdding("");
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-mute">{C.HINT}</p>
      {instruments.length === 0 && <p className="text-sm text-text-mute">{C.EMPTY}</p>}
      {instruments.map((symbol) => (
        <div key={symbol} className="grid grid-cols-2 items-center gap-3">
          <label htmlFor={`rate-${symbol}`} className="mono text-sm font-semibold text-text">{symbol}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-mute">$</span>
            <input
              id={`rate-${symbol}`}
              type="number" min="0" step="0.01" inputMode="decimal"
              value={rates[symbol]}
              onChange={(e) => onChange({ ...rates, [symbol]: e.target.value })}
              placeholder={C.NO_RATE}
              className={`${INPUT} mono text-right`}
            />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={C.ADD_PLACEHOLDER}
          aria-label={C.ADD_PLACEHOLDER}
          className={`${INPUT} mono uppercase`}
        />
        <button type="button" onClick={add} className="btn-ghost shrink-0">{C.ADD}</button>
      </div>
    </div>
  );
}

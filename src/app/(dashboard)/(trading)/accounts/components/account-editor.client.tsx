"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { ReactElement } from "react";
import type { AccountWithStats, AccountType, PropPhase, DrawdownType } from "~/types/account";
import { updateAccount, setAccountActive } from "~/actions/accounts";
import { ACCOUNTS } from "~/constants/copies/accounts";
import { PROP_FIRM } from "~/constants/copies/prop-firm";
import { PROP_FIRM_PRESETS, PROP_FIRM_PRESET_FIRMS } from "~/constants/prop-firm-presets";
import type { PropFirmPreset } from "~/constants/prop-firm-presets";
import { cn } from "~/utils/cn";
import { Button } from "~/lib/ui/button";
import { Toast } from "~/lib/ui/toast";
import type { ToastVariant } from "~/lib/ui/toast";
import { XIcon } from "~/lib/ui/icons/x-icon";

const COLOR_PRESETS = [
  "#3b82f6",
  "#a3e635",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#9ca3af",
] as const;

const ACCOUNT_TYPES: AccountType[] = ["real", "funded", "demo", "paper"];
const PROP_PHASES: PropPhase[] = ["evaluation", "funded", "payout"];
const DRAWDOWN_TYPES: DrawdownType[] = ["trailing_intraday", "trailing_eod", "static"];

const numOrNull = (v: string): number | null => (v.trim() !== "" ? parseFloat(v) : null);
const intOrNull = (v: string): number | null => (v.trim() !== "" ? parseInt(v, 10) : null);

type ToastState = { message: string; variant: ToastVariant };

type Props = {
  account:        AccountWithStats;
  renderTrigger?: (open: () => void) => ReactElement;
};

export function AccountEditor({ account, renderTrigger }: Props): ReactElement {
  const [isOpen, setIsOpen]               = useState(false);
  const [editorTab, setEditorTab]         = useState<"general" | "prop">("general");
  const [broker, setBroker]               = useState(account.broker ?? "");
  const [accountType, setAccountType]     = useState<AccountType>(account.accountType);
  const [initialBalance, setInitialBalance] = useState<string>(
    account.initialBalance != null ? String(account.initialBalance) : ""
  );
  const [color, setColor]                 = useState(account.color);
  const [notes, setNotes]                 = useState(account.notes ?? "");
  const [propPhase, setPropPhase]         = useState<string>(account.propPhase ?? "");
  const [drawdownType, setDrawdownType]   = useState<string>(account.drawdownType ?? "");
  const [drawdownAmount, setDrawdownAmount] = useState<string>(account.drawdownAmount != null ? String(account.drawdownAmount) : "");
  const [drawdownLockAt, setDrawdownLockAt] = useState<string>(account.drawdownLockAt != null ? String(account.drawdownLockAt) : "");
  const [dailyLossLimit, setDailyLossLimit] = useState<string>(account.dailyLossLimit != null ? String(account.dailyLossLimit) : "");
  const [profitTarget, setProfitTarget]   = useState<string>(account.profitTarget != null ? String(account.profitTarget) : "");
  const [minTradingDays, setMinTradingDays] = useState<string>(account.minTradingDays != null ? String(account.minTradingDays) : "");
  const [riskPerTrade, setRiskPerTrade]   = useState<string>(account.riskPerTrade != null ? String(account.riskPerTrade) : "");
  const [presetId, setPresetId]           = useState<string>("");
  const [archiveArmed, setArchiveArmed]   = useState(false);
  const [toast, setToast]                 = useState<ToastState | null>(null);
  const [isPending, startTransition]      = useTransition();

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 4000);
  }

  function openModal() {
    setBroker(account.broker ?? "");
    setAccountType(account.accountType);
    setInitialBalance(account.initialBalance != null ? String(account.initialBalance) : "");
    setColor(account.color);
    setNotes(account.notes ?? "");
    setPropPhase(account.propPhase ?? "");
    setDrawdownType(account.drawdownType ?? "");
    setDrawdownAmount(account.drawdownAmount != null ? String(account.drawdownAmount) : "");
    setDrawdownLockAt(account.drawdownLockAt != null ? String(account.drawdownLockAt) : "");
    setDailyLossLimit(account.dailyLossLimit != null ? String(account.dailyLossLimit) : "");
    setProfitTarget(account.profitTarget != null ? String(account.profitTarget) : "");
    setMinTradingDays(account.minTradingDays != null ? String(account.minTradingDays) : "");
    setRiskPerTrade(account.riskPerTrade != null ? String(account.riskPerTrade) : "");
    setPresetId("");
    setArchiveArmed(false);
    setEditorTab("general");
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setArchiveArmed(false);
  }

  function applyPreset(preset: PropFirmPreset) {
    setInitialBalance(String(preset.initialBalance));
    setPropPhase(preset.propPhase);
    setDrawdownType(preset.drawdownType);
    setDrawdownAmount(String(preset.drawdownAmount));
    setDrawdownLockAt(preset.drawdownLockAt != null ? String(preset.drawdownLockAt) : "");
    setDailyLossLimit(preset.dailyLossLimit != null ? String(preset.dailyLossLimit) : "");
    setProfitTarget(preset.profitTarget != null ? String(preset.profitTarget) : "");
    setMinTradingDays(preset.minTradingDays != null ? String(preset.minTradingDays) : "");
    // Only fill the broker if the user hasn't set one — don't clobber their input.
    setBroker((current) => (current.trim() === "" ? preset.firm : current));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateAccount({
        id:             account.id,
        broker:         broker.trim() || null,
        accountType,
        initialBalance: initialBalance !== "" ? parseFloat(initialBalance) : null,
        color,
        notes:          notes.trim() || null,
        propPhase:      (propPhase || null) as PropPhase | null,
        drawdownType:   (drawdownType || null) as DrawdownType | null,
        drawdownAmount: numOrNull(drawdownAmount),
        drawdownLockAt: numOrNull(drawdownLockAt),
        dailyLossLimit: numOrNull(dailyLossLimit),
        profitTarget:   numOrNull(profitTarget),
        minTradingDays: intOrNull(minTradingDays),
        riskPerTrade:   numOrNull(riskPerTrade),
      });

      if (result.success) {
        showToast(ACCOUNTS.TOAST.SAVE_SUCCESS, "success");
        closeModal();
      } else {
        showToast(result.error, "error");
      }
    });
  }

  function handleArchiveClick() {
    if (!archiveArmed) {
      setArchiveArmed(true);
      return;
    }
    startTransition(async () => {
      const result = await setAccountActive({ id: account.id, active: false });
      if (result.success) {
        showToast(ACCOUNTS.TOAST.ARCHIVED, "success");
        closeModal();
      } else {
        showToast(result.error, "error");
      }
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const result = await setAccountActive({ id: account.id, active: true });
      if (result.success) {
        showToast(ACCOUNTS.TOAST.RESTORED, "success");
        closeModal();
      } else {
        showToast(result.error, "error");
      }
    });
  }

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      {renderTrigger ? renderTrigger(openModal) : (
        <Button variant="ghost" onClick={openModal}>
          {ACCOUNTS.EDITOR.EDIT_CTA}
        </Button>
      )}

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
          onClick={closeModal}
        >
          <div
            className="card border-border-hi max-w-[90vw] max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5"
            style={{ width: 480, boxShadow: "0 20px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text">{account.name}</h2>
                <span className="label-caps mt-0.5 block">{ACCOUNTS.EDITOR.NAME_CAPTION}</span>
              </div>
              <Button variant="icon" onClick={closeModal} className="shrink-0">
                <XIcon />
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-0.5 rounded-sm bg-surface-2 border border-border">
              {(["general", "prop"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEditorTab(t)}
                  className={cn(
                    "flex-1 text-xs py-1.5 rounded-sm transition-colors cursor-pointer",
                    editorTab === t ? "bg-surface text-text" : "text-text-mute hover:text-text-dim"
                  )}
                >
                  {t === "general" ? ACCOUNTS.EDITOR.TAB_GENERAL : ACCOUNTS.EDITOR.TAB_PROP}
                </button>
              ))}
            </div>

            {editorTab === "general" && (
            <>
            {/* Broker */}
            <div className="flex flex-col gap-1.5">
              <label className="label-caps">{ACCOUNTS.EDITOR.BROKER_LABEL}</label>
              <input
                type="text"
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                placeholder="e.g. NinjaTrader Brokerage"
                className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
              />
            </div>

            {/* Account type */}
            <div className="flex flex-col gap-1.5">
              <label className="label-caps">{ACCOUNTS.EDITOR.TYPE_LABEL}</label>
              <div className="grid grid-cols-4 gap-1.5">
                {ACCOUNT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAccountType(type)}
                    className={cn(
                      "text-xs py-2 rounded-sm border transition-colors",
                      accountType === type
                        ? "border-accent text-text bg-surface-2"
                        : "border-border text-text-mute hover:border-border-hi"
                    )}
                  >
                    {ACCOUNTS.TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Initial balance */}
            <div className="flex flex-col gap-1.5">
              <label className="label-caps">{ACCOUNTS.EDITOR.BALANCE_LABEL}</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-mute text-base">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="0.00"
                  className="bg-surface-2 border border-border rounded-sm pl-7 pr-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                />
              </div>
            </div>

            {/* Color */}
            <div className="flex flex-col gap-1.5">
              <label className="label-caps">{ACCOUNTS.EDITOR.COLOR_LABEL}</label>
              <div className="flex items-center gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    style={{ background: preset }}
                    className={cn(
                      "w-7 h-7 rounded-sm transition-all",
                      color === preset
                        ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                        : "hover:scale-110"
                    )}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-7 h-7 rounded-sm cursor-pointer bg-surface-2 border border-border"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="label-caps">{ACCOUNTS.EDITOR.NOTES_LABEL}</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes…"
                className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi resize-vertical"
              />
            </div>
            </>
            )}

            {editorTab === "prop" && (
            <div className="flex flex-col gap-3">

              {/* Preset loader */}
              <div className="flex flex-col gap-1.5">
                <label className="label-caps">{PROP_FIRM.PRESET_LABEL}</label>
                <select
                  value={presetId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPresetId(id);
                    const preset = PROP_FIRM_PRESETS.find((p) => p.id === id);
                    if (preset) applyPreset(preset);
                  }}
                  className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                >
                  <option value="">{PROP_FIRM.PRESET_NONE}</option>
                  {PROP_FIRM_PRESET_FIRMS.map((firm) => (
                    <optgroup key={firm} label={firm}>
                      {PROP_FIRM_PRESETS.filter((p) => p.firm === firm).map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-xxs text-text-mute">{PROP_FIRM.PRESET_HINT}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="label-caps">{PROP_FIRM.PHASE}</label>
                  <select
                    value={propPhase}
                    onChange={(e) => setPropPhase(e.target.value)}
                    className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                  >
                    <option value="">{PROP_FIRM.PHASE_NONE}</option>
                    {PROP_PHASES.map((p) => (
                      <option key={p} value={p}>{PROP_FIRM.PHASE_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="label-caps">{PROP_FIRM.DRAWDOWN_TYPE}</label>
                  <select
                    value={drawdownType}
                    onChange={(e) => setDrawdownType(e.target.value)}
                    className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                  >
                    <option value="">{PROP_FIRM.DRAWDOWN_NONE}</option>
                    {DRAWDOWN_TYPES.map((d) => (
                      <option key={d} value={d}>{PROP_FIRM.DRAWDOWN_TYPE_LABELS[d]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="label-caps">{PROP_FIRM.DD_AMOUNT}</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={drawdownAmount}
                    onChange={(e) => setDrawdownAmount(e.target.value)}
                    placeholder="2500"
                    className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="label-caps">{PROP_FIRM.DD_LOCK}</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={drawdownLockAt}
                    onChange={(e) => setDrawdownLockAt(e.target.value)}
                    placeholder="—"
                    className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                  />
                </div>
              </div>
              <p className="text-xxs text-text-mute -mt-1.5">{PROP_FIRM.DD_LOCK_HINT}</p>
              {drawdownType !== "" && initialBalance === "" && (
                <p className="text-xxs text-loss -mt-1.5">{PROP_FIRM.DD_NEEDS_BALANCE}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="label-caps">{PROP_FIRM.DAILY_LOSS}</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={dailyLossLimit}
                    onChange={(e) => setDailyLossLimit(e.target.value)}
                    placeholder="—"
                    className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="label-caps">{PROP_FIRM.PROFIT_TARGET}</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={profitTarget}
                    onChange={(e) => setProfitTarget(e.target.value)}
                    placeholder="—"
                    className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="label-caps">{PROP_FIRM.MIN_DAYS}</label>
                  <input
                    type="number" min="0" step="1"
                    value={minTradingDays}
                    onChange={(e) => setMinTradingDays(e.target.value)}
                    placeholder="—"
                    className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="label-caps">{PROP_FIRM.RISK_PER_TRADE}</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={riskPerTrade}
                    onChange={(e) => setRiskPerTrade(e.target.value)}
                    placeholder="—"
                    className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi"
                  />
                </div>
              </div>
              <p className="text-xxs text-text-mute -mt-1.5">{PROP_FIRM.RISK_HINT}</p>
            </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
              {account.active ? (
                <button
                  type="button"
                  onClick={handleArchiveClick}
                  disabled={isPending}
                  className={cn(
                    "text-xs text-text-mute hover:text-loss transition-colors disabled:opacity-60 cursor-pointer",
                    archiveArmed && "text-loss"
                  )}
                >
                  {archiveArmed ? ACCOUNTS.EDITOR.ARCHIVE_CONFIRM : ACCOUNTS.EDITOR.ARCHIVE}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={isPending}
                  className="text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {ACCOUNTS.EDITOR.RESTORE}
                </button>
              )}

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={closeModal} disabled={isPending}>
                  {ACCOUNTS.EDITOR.CANCEL}
                </Button>
                <Button variant="accent" onClick={handleSave} disabled={isPending} loading={isPending}>
                  {ACCOUNTS.EDITOR.SAVE}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

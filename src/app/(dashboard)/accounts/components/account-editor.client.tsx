"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { ReactElement } from "react";
import type { AccountWithStats, AccountType } from "~/types/account";
import { updateAccount, setAccountActive } from "~/actions/accounts";
import { ACCOUNTS } from "~/constants/copies/accounts";
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

type ToastState = { message: string; variant: ToastVariant };

type Props = { account: AccountWithStats };

export function AccountEditor({ account }: Props): ReactElement {
  const [isOpen, setIsOpen]               = useState(false);
  const [broker, setBroker]               = useState(account.broker ?? "");
  const [accountType, setAccountType]     = useState<AccountType>(account.accountType);
  const [initialBalance, setInitialBalance] = useState<string>(
    account.initialBalance != null ? String(account.initialBalance) : ""
  );
  const [color, setColor]                 = useState(account.color);
  const [notes, setNotes]                 = useState(account.notes ?? "");
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
    setArchiveArmed(false);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setArchiveArmed(false);
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

      <Button variant="ghost" onClick={openModal}>
        {ACCOUNTS.EDITOR.EDIT_CTA}
      </Button>

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
          onClick={closeModal}
        >
          <div
            className="card border-border-hi max-w-[90vw] p-6 flex flex-col gap-5"
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

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
              {account.active ? (
                <button
                  type="button"
                  onClick={handleArchiveClick}
                  disabled={isPending}
                  className={cn(
                    "text-xs text-text-mute hover:text-loss transition-colors disabled:opacity-60",
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
                  className="text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-60"
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

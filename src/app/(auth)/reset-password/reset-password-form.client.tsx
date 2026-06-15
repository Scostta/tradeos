"use client";

import { useActionState } from "react";
import { updatePassword } from "~/actions/auth";
import type { AuthActionState } from "~/actions/auth";
import { COMMON } from "~/constants/copies/common";
import { AUTH } from "~/constants/copies/auth";
import { Button } from "~/lib/ui/button";
import { Toaster } from "~/lib/ui/toaster.client";
import { useToast } from "~/hooks/use-toast";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(updatePassword, null);
  const toast = useToast(state);

  return (
    <>
    <div className="w-full max-w-sm">
      <div className="card p-8 flex flex-col gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md mono font-semibold text-lg text-bg shrink-0"
            style={{ background: "var(--color-accent)", boxShadow: "0 0 16px var(--accent-glow)" }}
          >
            {COMMON.BRAND.LOGO}
          </div>
          <div>
            <div className="font-semibold text-md text-text tracking-mono">{COMMON.BRAND.NAME}</div>
            <div className="mono text-xs text-text-mute">{COMMON.BRAND.TAGLINE}</div>
          </div>
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-xl font-semibold text-text tracking-tight">{AUTH.RESET.TITLE}</h1>
          <p className="text-base text-text-dim mt-1">{AUTH.RESET.SUBTITLE}</p>
        </div>

        {/* Password form */}
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="label-caps">{AUTH.RESET.PASSWORD_LABEL}</label>
            <input
              name="password"
              type="password"
              placeholder={AUTH.RESET.PASSWORD_PLACEHOLDER}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded bg-surface-2 border border-border text-text text-md placeholder:text-text-mute outline-none focus:border-border-hi transition-colors"
            />
          </div>
          <Button
            type="submit"
            variant="accent"
            loading={pending}
            className="w-full py-2.5 text-md mt-1"
          >
            {pending ? AUTH.RESET.LOADING : AUTH.RESET.SUBMIT}
          </Button>
        </form>
      </div>
    </div>
    {toast && <Toaster variant={toast.variant} message={toast.message} />}
    </>
  );
}

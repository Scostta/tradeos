"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "~/actions/auth";
import type { AuthActionState } from "~/actions/auth";
import { COMMON } from "~/constants/copies/common";
import { AUTH } from "~/constants/copies/auth";
import { Button } from "~/lib/ui/button";
import { Toaster } from "~/lib/ui/toaster.client";
import { APP_URLS } from "~/constants/app-urls";
import { useToast } from "~/hooks/use-toast";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(requestPasswordReset, null);
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
          <h1 className="text-xl font-semibold text-text tracking-tight">{AUTH.FORGOT.TITLE}</h1>
          <p className="text-base text-text-dim mt-1">{AUTH.FORGOT.SUBTITLE}</p>
        </div>

        {/* Email form */}
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="label-caps">{AUTH.FORGOT.EMAIL_LABEL}</label>
            <input
              name="email"
              type="email"
              placeholder={AUTH.FORGOT.EMAIL_PLACEHOLDER}
              required
              autoComplete="email"
              className="w-full px-3 py-2 rounded bg-surface-2 border border-border text-text text-md placeholder:text-text-mute outline-none focus:border-border-hi transition-colors"
            />
          </div>
          <Button
            type="submit"
            variant="accent"
            loading={pending}
            className="w-full py-2.5 text-md mt-1"
          >
            {pending ? AUTH.FORGOT.LOADING : AUTH.FORGOT.SUBMIT}
          </Button>
        </form>

        <p className="text-base text-text-mute text-center">
          <Link href={APP_URLS.LOGIN} className="text-text-dim hover:text-text transition-colors">
            {AUTH.FORGOT.BACK}
          </Link>
        </p>
      </div>
    </div>
    {toast && <Toaster variant={toast.variant} message={toast.message} />}
    </>
  );
}

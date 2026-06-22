"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { signUpWithEmail, signInWithGoogle, resendConfirmation } from "~/actions/auth";
import type { AuthActionState } from "~/actions/auth";
import { COMMON } from "~/constants/copies/common";
import { AUTH } from "~/constants/copies/auth";
import { Button } from "~/lib/ui/button";
import { Toaster } from "~/lib/ui/toaster.client";
import { GoogleIcon } from "~/lib/ui/icons/google-icon";
import { BrandMark } from "~/lib/ui/icons/brand-mark";
import { APP_URLS } from "~/constants/app-urls";
import { useToast } from "~/hooks/use-toast";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(signUpWithEmail, null);
  const [resendState, resendAction, resendPending] = useActionState<AuthActionState, FormData>(resendConfirmation, null);
  const [googlePending, startGoogle] = useTransition();
  const [email, setEmail] = useState("");
  const toast = useToast(state);

  const awaitingConfirmation = state?.code === "CHECK_EMAIL";

  return (
    <>
    <div className="w-full max-w-sm">
      <div className="card p-8 flex flex-col gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="rounded-md shrink-0" style={{ boxShadow: "0 0 16px var(--accent-glow)" }}>
            <BrandMark size={32} />
          </div>
          <div>
            <div className="font-semibold text-md text-text tracking-mono">{COMMON.BRAND.NAME}</div>
            <div className="mono text-xs text-text-mute">{COMMON.BRAND.TAGLINE}</div>
          </div>
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-xl font-semibold text-text tracking-tight">{AUTH.REGISTER.TITLE}</h1>
          <p className="text-base text-text-dim mt-1">{AUTH.REGISTER.SUBTITLE}</p>
        </div>

        {/* Email / password form */}
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="label-caps">{AUTH.REGISTER.EMAIL_LABEL}</label>
            <input
              name="email"
              type="email"
              placeholder={AUTH.REGISTER.EMAIL_PLACEHOLDER}
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded bg-surface-2 border border-border text-text text-md placeholder:text-text-mute outline-none focus:border-border-hi transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label-caps">{AUTH.REGISTER.PASSWORD_LABEL}</label>
            <input
              name="password"
              type="password"
              placeholder={AUTH.REGISTER.PASSWORD_PLACEHOLDER}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded bg-surface-2 border border-border text-text text-md placeholder:text-text-mute outline-none focus:border-border-hi transition-colors"
            />
          </div>
          <Button
            type="submit"
            variant="accent"
            loading={pending}
            disabled={googlePending}
            className="w-full py-2.5 text-md mt-1"
          >
            {pending ? AUTH.REGISTER.LOADING : AUTH.REGISTER.SUBMIT}
          </Button>
        </form>

        {/* Resend confirmation — only after a successful sign-up that needs email verification */}
        {awaitingConfirmation && (
          <form action={resendAction} className="text-center">
            <input type="hidden" name="email" value={email} />
            {resendState?.code === "CONFIRMATION_SENT" ? (
              <p className="text-base text-text-mute">{resendState.message}</p>
            ) : (
              <p className="text-base text-text-mute">
                Didn&apos;t get the email?{" "}
                <button
                  type="submit"
                  disabled={resendPending}
                  className="text-text-dim hover:text-text transition-colors disabled:opacity-60"
                >
                  {resendPending ? "Sending…" : "Resend"}
                </button>
              </p>
            )}
          </form>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-mute">{COMMON.OR}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google */}
        <Button
          variant="ghost"
          loading={googlePending}
          disabled={pending}
          onClick={() => startGoogle(async () => { await signInWithGoogle(); })}
          className="w-full py-2.5 text-md flex items-center justify-center gap-2.5"
        >
          <GoogleIcon />
          {googlePending ? AUTH.REGISTER.LOADING : AUTH.REGISTER.GOOGLE}
        </Button>

        <p className="text-base text-text-mute text-center">
          {AUTH.REGISTER.HAS_ACCOUNT}{" "}
          <Link href={APP_URLS.LOGIN} className="text-text-dim hover:text-text transition-colors">
            {AUTH.REGISTER.SIGN_IN}
          </Link>
        </p>
      </div>
    </div>
    {toast && <Toaster variant={toast.variant} message={toast.message} />}
    </>
  );
}

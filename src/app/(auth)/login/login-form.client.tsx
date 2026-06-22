"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { signInWithEmail, signInWithGoogle } from "~/actions/auth";
import type { AuthActionState } from "~/actions/auth";
import { COMMON } from "~/constants/copies/common";
import { AUTH } from "~/constants/copies/auth";
import { Button } from "~/lib/ui/button";
import { Toaster } from "~/lib/ui/toaster.client";
import { GoogleIcon } from "~/lib/ui/icons/google-icon";
import { BrandMark } from "~/lib/ui/icons/brand-mark";
import { APP_URLS } from "~/constants/app-urls";
import { useToast } from "~/hooks/use-toast";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(signInWithEmail, null);
  const [googlePending, startGoogle] = useTransition();
  const toast = useToast(state);

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
          <h1 className="text-xl font-semibold text-text tracking-tight">{AUTH.LOGIN.TITLE}</h1>
          <p className="text-base text-text-dim mt-1">{AUTH.LOGIN.SUBTITLE}</p>
        </div>

        {/* Email / password form */}
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="label-caps">{AUTH.LOGIN.EMAIL_LABEL}</label>
            <input
              name="email"
              type="email"
              placeholder={AUTH.LOGIN.EMAIL_PLACEHOLDER}
              required
              autoComplete="email"
              className="w-full px-3 py-2 rounded bg-surface-2 border border-border text-text text-md placeholder:text-text-mute outline-none focus:border-border-hi transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="label-caps">{AUTH.LOGIN.PASSWORD_LABEL}</label>
              <Link href={APP_URLS.FORGOT_PASSWORD} className="text-xs text-text-mute hover:text-text-dim transition-colors">
                {AUTH.LOGIN.FORGOT}
              </Link>
            </div>
            <input
              name="password"
              type="password"
              placeholder={AUTH.LOGIN.PASSWORD_PLACEHOLDER}
              required
              autoComplete="current-password"
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
            {pending ? AUTH.LOGIN.LOADING : AUTH.LOGIN.SUBMIT}
          </Button>
        </form>

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
          {googlePending ? AUTH.LOGIN.LOADING : AUTH.LOGIN.GOOGLE}
        </Button>

        <p className="text-base text-text-mute text-center">
          {AUTH.LOGIN.NO_ACCOUNT}{" "}
          <Link href={APP_URLS.REGISTER} className="text-text-dim hover:text-text transition-colors">
            {AUTH.LOGIN.CREATE_ONE}
          </Link>
        </p>
      </div>
    </div>
    {toast && <Toaster variant={toast.variant} message={toast.message} />}
    </>
  );
}

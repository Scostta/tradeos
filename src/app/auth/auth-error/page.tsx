import type { ReactElement } from "react";
import Link from "next/link";
import { COMMON } from "~/constants/copies/common";
import { APP_URLS } from "~/constants/app-urls";

export default function AuthErrorPage(): ReactElement {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="card p-8 flex flex-col gap-6">
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

          <div>
            <h1 className="text-xl font-semibold text-text tracking-tight">Authentication failed</h1>
            <p className="text-base text-text-dim mt-1">
              Your link may have expired or already been used. Try signing in again or request a new link.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href={APP_URLS.LOGIN}
              className="w-full py-2.5 text-md text-center rounded text-bg transition-opacity hover:opacity-90"
              style={{ background: "var(--color-accent)" }}
            >
              Back to sign in
            </Link>
            <Link
              href={APP_URLS.FORGOT_PASSWORD}
              className="w-full py-2.5 text-md text-center rounded text-text-dim border border-border hover:border-border-hi transition-colors"
            >
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

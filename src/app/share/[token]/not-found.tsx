import type { ReactElement } from "react"
import Link from "next/link"
import { SHARE } from "~/constants/copies/share"
import { COMMON } from "~/constants/copies/common"
import { APP_URLS } from "~/constants/app-urls"

export default function ShareNotFound(): ReactElement {
  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
      <div className="card p-8 max-w-sm text-center flex flex-col items-center gap-4">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-md mono font-semibold text-xl text-bg"
          style={{ background: "var(--color-accent)", boxShadow: "0 0 16px var(--accent-glow)" }}
        >
          {COMMON.BRAND.LOGO}
        </div>
        <div>
          <div className="text-md font-semibold text-text mb-1">{SHARE.NOT_FOUND_TITLE}</div>
          <div className="text-sm text-text-mute">{SHARE.NOT_FOUND_MSG}</div>
        </div>
        <Link href={APP_URLS.HOME} className="btn-accent text-sm">{SHARE.NOT_FOUND_CTA}</Link>
      </div>
    </div>
  )
}

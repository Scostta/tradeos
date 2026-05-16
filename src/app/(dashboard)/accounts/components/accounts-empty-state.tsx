import type { ReactElement } from "react";
import Link from "next/link";
import { CloudUploadIcon } from "~/lib/ui/icons/cloud-upload-icon";
import { ACCOUNTS } from "~/constants/copies/accounts";
import { APP_URLS } from "~/constants/app-urls";

export function AccountsEmptyState(): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <CloudUploadIcon className="w-10 h-10 text-text-mute" />
      <div className="flex flex-col gap-2">
        <p className="text-md font-medium text-text">{ACCOUNTS.EMPTY.HEADLINE}</p>
        <p className="text-sm text-text-mute max-w-sm">{ACCOUNTS.EMPTY.BODY}</p>
      </div>
      <Link
        href={APP_URLS.IMPORT}
        className="btn-accent inline-block"
      >
        {ACCOUNTS.EMPTY.CTA}
      </Link>
    </div>
  );
}

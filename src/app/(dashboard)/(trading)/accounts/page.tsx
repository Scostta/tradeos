import type { ReactElement } from "react";
import { ACCOUNTS } from "~/constants/copies/accounts";
import { getAccountsWithStats } from "~/services/queries/accounts";
import { AccountsGrid } from "./components/accounts-grid";

export default async function AccountsPage(): Promise<ReactElement> {
  const result = await getAccountsWithStats();

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{ACCOUNTS.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{ACCOUNTS.SUBTITLE}</div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {result.success ? (
          <AccountsGrid accounts={result.data} />
        ) : (
          <div className="p-7">
            <div className="card p-4 text-sm text-loss">{ACCOUNTS.ERROR.LOAD_FAILED}</div>
          </div>
        )}
      </div>
    </div>
  );
}

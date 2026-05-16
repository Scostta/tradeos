import type { ReactElement } from "react";
import type { AccountWithStats } from "~/types/account";
import { AccountCard } from "./account-card";
import { AccountsEmptyState } from "./accounts-empty-state";

type Props = { accounts: AccountWithStats[] };

export function AccountsGrid({ accounts }: Props): ReactElement {
  if (accounts.length === 0) {
    return <AccountsEmptyState />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 p-7">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  );
}

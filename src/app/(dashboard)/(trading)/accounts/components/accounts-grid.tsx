import type { ReactElement } from "react";
import type { AccountWithPropStatus } from "~/types/prop-firm";
import { AccountCard } from "./account-card.client";
import { AccountsEmptyState } from "./accounts-empty-state";

type Props = { accounts: AccountWithPropStatus[] };

export function AccountsGrid({ accounts }: Props): ReactElement {
  if (accounts.length === 0) {
    return <AccountsEmptyState />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 p-4 md:p-7">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  );
}

import type { ReactElement } from "react";
import type { PlaybookWithStats } from "~/types/playbook";
import { PlaybookCard } from "./playbook-card.client";
import { PlaybooksEmptyState } from "./playbooks-empty-state";
import { NewPlaybookCard } from "./new-playbook-card.client";

type Props = { playbooks: PlaybookWithStats[] };

export function PlaybooksGrid({ playbooks }: Props): ReactElement {
  if (playbooks.length === 0) {
    return <PlaybooksEmptyState />;
  }

  const sorted = [...playbooks].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 p-4 md:p-7">
      {sorted.map((playbook) => (
        <PlaybookCard key={playbook.id} playbook={playbook} />
      ))}
      <NewPlaybookCard />
    </div>
  );
}

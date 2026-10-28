import type { ReactElement } from "react";
import { PLAYBOOKS } from "~/constants/copies/playbooks";
import { NewPlaybookButton } from "./new-playbook-button.client";

export function PlaybooksEmptyState(): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-md font-medium text-text">{PLAYBOOKS.EMPTY.HEADLINE}</p>
        <p className="text-sm text-text-mute max-w-sm">{PLAYBOOKS.EMPTY.BODY}</p>
      </div>
      <NewPlaybookButton label={PLAYBOOKS.EMPTY.CTA} />
    </div>
  );
}

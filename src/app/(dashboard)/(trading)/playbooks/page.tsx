import type { ReactElement } from "react";
import { PLAYBOOKS } from "~/constants/copies/playbooks";
import { getPlaybooksWithStats } from "~/services/queries/playbooks";
import { PlaybooksGrid } from "./components/playbooks-grid";
import { NewPlaybookButton } from "./components/new-playbook-button.client";

export default async function PlaybooksPage(): Promise<ReactElement> {
  const result = await getPlaybooksWithStats();

  const playbooks   = result.success ? result.data : [];
  const activeCount  = playbooks.filter((s) => s.active).length;
  const total        = playbooks.length;
  const hasPlaybooks = total > 0;

  const subtitle = hasPlaybooks
    ? `${activeCount} active · ${total} total`
    : PLAYBOOKS.SUBTITLE_FALLBACK;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{PLAYBOOKS.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{subtitle}</div>
        </div>

        {hasPlaybooks && (
          <div className="ml-auto">
            <NewPlaybookButton />
          </div>
        )}
      </header>

      <div className="flex-1 overflow-auto">
        {result.success ? (
          <PlaybooksGrid playbooks={result.data} />
        ) : (
          <div className="p-7">
            <div className="card p-4 text-sm text-loss">{PLAYBOOKS.ERROR.LOAD_FAILED}</div>
          </div>
        )}
      </div>
    </div>
  );
}

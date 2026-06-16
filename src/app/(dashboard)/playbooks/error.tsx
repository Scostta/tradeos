"use client";

import { PLAYBOOKS } from "~/constants/copies/playbooks";

export default function PlaybooksError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-4">
      <div className="text-md font-semibold text-text">{PLAYBOOKS.ERROR.TITLE}</div>
      <div className="text-sm text-text-mute">{PLAYBOOKS.ERROR.MESSAGE}</div>
      <button onClick={reset} className="btn-accent">
        {PLAYBOOKS.ERROR.RETRY}
      </button>
    </div>
  );
}

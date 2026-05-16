import { COMMON } from "~/constants/copies/common";
import { JOURNAL } from "~/constants/copies/journal";

export default function JournalPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{JOURNAL.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{JOURNAL.SUBTITLE}</div>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center text-text-mute text-md">
        {COMMON.COMING_SOON}
      </div>
    </div>
  );
}

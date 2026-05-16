import { COMMON } from "~/constants/copies/common";
import { IMPORT } from "~/constants/copies/import";

export default function ImportPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{IMPORT.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{IMPORT.SUBTITLE}</div>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center text-text-mute text-md">
        {COMMON.COMING_SOON}
      </div>
    </div>
  );
}

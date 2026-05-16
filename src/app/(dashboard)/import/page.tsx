import { IMPORT } from "~/constants/copies/import";
import { ImportFlow } from "~/app/(dashboard)/import/components/import-flow.client";

export default function ImportPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{IMPORT.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">{IMPORT.SUBTITLE}</div>
        </div>
      </header>
      <div className="flex-1 overflow-auto">
        <ImportFlow />
      </div>
    </div>
  );
}

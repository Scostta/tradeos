"use client";

import { useState, useTransition } from "react";
import type { ReactElement } from "react";
import { parseNinjaTraderCsv } from "~/lib/parsers/ninjatrader";
import { findExistingTradeKeys, importTrades } from "~/actions/import";
import type { ParseResult, PreviewRow } from "~/types";
import { IMPORT } from "~/constants/copies/import";
import { cn } from "~/utils/cn";
import { DropZone } from "./drop-zone.client";
import { ImportMetrics } from "./import-metrics";
import { PreviewTable } from "./preview-table";
import { Button } from "~/lib/ui/button";
import { Toast } from "~/lib/ui/toast";
import type { ToastVariant } from "~/lib/ui/toast";

type Phase = "drop" | "preview" | "importing" | "done";

type ToastState = {
  message: string;
  variant: ToastVariant;
};

export function ImportFlow(): ReactElement {
  const [phase, setPhase]               = useState<Phase>("drop");
  const [fileName, setFileName]         = useState<string | null>(null);
  const [parseResult, setParseResult]   = useState<ParseResult | null>(null);
  const [previewRows, setPreviewRows]   = useState<PreviewRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [toast, setToast]               = useState<ToastState | null>(null);
  const [isPending, startTransition]    = useTransition();

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    const result = parseNinjaTraderCsv(text);
    setParseResult(result);

    if (result.rows.length === 0) {
      showToast(IMPORT.TOAST.PARSE_ERROR, "error");
      return;
    }

    const keys = result.rows.map((r) => ({
      tradeNumber: r.tradeNumber,
      accountName: r.accountName,
    }));

    const dupResult = await findExistingTradeKeys(keys);

    const dupSet = dupResult.success
      ? new Set<number>(dupResult.data.map((k) => k.tradeNumber))
      : new Set<number>();

    const rows: PreviewRow[] = result.rows.map((r) => ({
      ...r,
      status: dupSet.has(r.tradeNumber) ? "dup" as const : "new" as const,
    }));

    setPreviewRows(rows);
    setPhase("preview");
  }

  function handleImport() {
    const newRows = previewRows.filter((r) => r.status === "new");

    if (newRows.length === 0) {
      showToast(IMPORT.TOAST.NO_NEW_ROWS, "info");
      return;
    }

    startTransition(async () => {
      setPhase("importing");
      try {
        const result = await importTrades({ rows: newRows });

        if (result.success) {
          setImportedCount(result.data.imported);
          setPhase("done");
          showToast(
            IMPORT.TOAST.IMPORT_SUCCESS.replace("{count}", String(result.data.imported)),
            "success"
          );
        } else {
          setPhase("preview");
          showToast(result.error, "error");
        }
      } catch (err) {
        setPhase("preview");
        showToast(err instanceof Error ? err.message : "Unknown error", "error");
      }
    });
  }

  function handleClear() {
    setPhase("drop");
    setFileName(null);
    setParseResult(null);
    setPreviewRows([]);
    setImportedCount(0);
    setToast(null);
  }

  const newCount      = previewRows.filter((r) => r.status === "new").length;
  const dupCount      = previewRows.filter((r) => r.status === "dup").length;
  const errorCount    = parseResult?.errors.length ?? 0;
  const detectedCount = parseResult?.rows.length ?? 0;

  function getCtaLabel(): string {
    if (phase === "importing") return IMPORT.STATUS.IMPORTING;
    if (phase === "done")      return IMPORT.STATUS.DONE.replace("{count}", String(importedCount));
    return IMPORT.PREVIEW.IMPORT_CTA.replace("{count}", String(newCount));
  }

  const fileMeta = parseResult
    ? IMPORT.PREVIEW.FILE_META
        .replace("{rows}", String(parseResult.rows.length))
        .replace("{format}", parseResult.format)
    : undefined;

  const footerSummary = IMPORT.PREVIEW.FOOTER_SUMMARY
    .replace("{new}", String(newCount))
    .replace("{dup}", String(dupCount));

  return (
    <div className="flex flex-col gap-4 p-7 overflow-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Drop zone — idle or compact */}
      {phase === "drop" ? (
        <DropZone mode="idle" onFile={handleFile} />
      ) : (
        <>
          <DropZone
            mode="compact"
            fileName={fileName ?? undefined}
            fileMeta={fileMeta}
            onClear={handleClear}
          />

          <ImportMetrics
            detected={detectedCount}
            newCount={newCount}
            duplicates={dupCount}
            errors={errorCount}
          />

          {/* Preview card */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <span className="label-caps">
                Preview · {previewRows.length} rows
              </span>
              <span className="text-xs text-text-mute mono">
                {IMPORT.PREVIEW.MAPPING_LABEL} {IMPORT.PREVIEW.MAPPING_VALUE}
              </span>
            </div>
            <PreviewTable rows={previewRows} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 py-2">
            <p className="text-sm text-text-mute">{footerSummary}</p>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={handleClear}
                disabled={phase === "importing"}
              >
                {IMPORT.PREVIEW.CANCEL}
              </Button>
              <Button
                variant="accent"
                onClick={handleImport}
                disabled={
                  phase === "importing" ||
                  phase === "done" ||
                  newCount === 0 ||
                  isPending
                }
                className={cn(phase === "done" && "opacity-80")}
              >
                {getCtaLabel()}
              </Button>
            </div>
          </div>

          {/* Import another file prompt when done */}
          {phase === "done" && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleClear}
                className="text-sm text-accent hover:text-accent/80 underline transition-colors"
              >
                {IMPORT.PREVIEW.IMPORT_ANOTHER}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { ReactElement } from "react";
import { detectKnownFormat } from "~/lib/parsers/registry";
import { inspectCsv, guessMapping, parseWithMapping } from "~/lib/parsers/generic";
import { checkImportKeys, importTrades } from "~/actions/import";
import type { ParseResult, PreviewRow, CsvInspection, ColumnMapping } from "~/types";
import {
  countBreakEven,
  markBreakEven,
  previewRowKey,
  splitImportActions,
  toExclusionKey,
} from "~/helpers/import-exclusions";
import { IMPORT } from "~/constants/copies/import";
import { cn } from "~/utils/cn";
import { DropZone } from "./drop-zone.client";
import { ColumnMapper } from "./column-mapper.client";
import { ExcludeFilter } from "./exclude-filter.client";
import { ImportMetrics } from "./import-metrics";
import { PreviewTable } from "./preview-table.client";
import { ImportErrorsTable } from "./import-errors-table";
import { Button } from "~/lib/ui/button";
import { Toast } from "~/lib/ui/toast";
import type { ToastVariant } from "~/lib/ui/toast";

type Phase = "drop" | "mapping" | "preview" | "importing" | "done";

type ToastState = {
  message: string;
  variant: ToastVariant;
};

/** Umbral por defecto para scratches: |net P&L| ≤ $2 se considera break-even. */
const DEFAULT_BE_THRESHOLD = 2;

export function ImportFlow(): ReactElement {
  const [phase, setPhase]               = useState<Phase>("drop");
  const [fileName, setFileName]         = useState<string | null>(null);
  const [parseResult, setParseResult]   = useState<ParseResult | null>(null);
  const [previewRows, setPreviewRows]   = useState<PreviewRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [threshold, setThreshold]       = useState(DEFAULT_BE_THRESHOLD);
  const [toast, setToast]               = useState<ToastState | null>(null);
  const [isPending, startTransition]    = useTransition();
  // Generic (mapped) import state
  const [rawText, setRawText]           = useState<string>("");
  const [inspection, setInspection]     = useState<CsvInspection | null>(null);
  const [guessed, setGuessed]           = useState<ColumnMapping>({});

  function showToast(message: string, variant: ToastVariant) {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 4000);
  }

  // Shared dedup + preview transition for both the auto-detected and mapped paths.
  async function applyResult(result: ParseResult) {
    setParseResult(result);

    if (result.rows.length === 0) {
      showToast(IMPORT.TOAST.PARSE_ERROR, "error");
      return false;
    }

    const check = await checkImportKeys(result.rows.map(toExclusionKey));
    const dupSet = new Set<string>(
      check.success ? check.data.duplicates.map(previewRowKey) : []
    );
    const excludedSet = new Set<string>(
      check.success ? check.data.excluded.map(previewRowKey) : []
    );

    const rows: PreviewRow[] = result.rows.map((r) => {
      const key = previewRowKey(r);
      const status = excludedSet.has(key)
        ? ("skipped" as const)
        : dupSet.has(key)
          ? ("dup" as const)
          : ("new" as const);

      // Las exclusiones previas llegan ya desmarcadas; el usuario puede revertirlas.
      return { ...r, status, excluded: status === "skipped" };
    });

    setPreviewRows(rows);
    setPhase("preview");
    return true;
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    const text = await file.text();

    const known = detectKnownFormat(text);
    if (known) {
      await applyResult(known);
      return;
    }

    // Unknown broker → let the user map columns.
    const insp = inspectCsv(text);
    if (insp.headers.length === 0) {
      showToast(IMPORT.TOAST.PARSE_ERROR, "error");
      return;
    }
    setRawText(text);
    setInspection(insp);
    setGuessed(guessMapping(insp.headers));
    setPhase("mapping");
  }

  function handleMapping(mapping: ColumnMapping, accountFallback: string) {
    const result = parseWithMapping(rawText, mapping, { accountFallback });
    if (result.rows.length === 0) {
      setParseResult(result);
      showToast(IMPORT.MAPPING.ERR_NO_ROWS, "error");
      return;
    }
    void applyResult(result);
  }

  function toggleRow(index: number, keep: boolean) {
    setPreviewRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, excluded: !keep } : r))
    );
  }

  function toggleAll(keep: boolean) {
    setPreviewRows((rows) => rows.map((r) => ({ ...r, excluded: !keep })));
  }

  /** Desmarca todos los trades cuyo |net P&L| cae bajo el umbral. */
  function applyThreshold() {
    setPreviewRows((rows) => markBreakEven(rows, threshold));
  }

  function handleImport() {
    const { toImport, toExclude, toRestore } = splitImportActions(previewRows);

    if (toImport.length === 0 && toExclude.length === 0) {
      showToast(
        previewRows.some((r) => r.status === "dup" || r.status === "skipped")
          ? IMPORT.TOAST.NOTHING_TO_DO
          : IMPORT.TOAST.NO_NEW_ROWS,
        "info"
      );
      return;
    }

    startTransition(async () => {
      setPhase("importing");
      try {
        const result = await importTrades({
          rows:      toImport,
          exclude:   toExclude.map(toExclusionKey),
          unexclude: toRestore.map(toExclusionKey),
        });

        if (result.success) {
          const { imported, excluded } = result.data;
          setImportedCount(imported);
          setPhase("done");

          // Refleja el nuevo estado de BD en la tabla: lo importado pasa a DUP,
          // lo excluido a SKIPPED.
          setPreviewRows((rows) =>
            rows.map((r) => ({
              ...r,
              status: r.excluded ? "skipped" : r.status === "new" ? "dup" : r.status,
            }))
          );

          const message =
            excluded === 0
              ? IMPORT.TOAST.IMPORT_SUCCESS.replace("{count}", String(imported))
              : imported === 0
                ? IMPORT.TOAST.EXCLUDED_ONLY.replace("{count}", String(excluded))
                : IMPORT.TOAST.IMPORT_MIXED
                    .replace("{count}", String(imported))
                    .replace("{excluded}", String(excluded));

          showToast(message, "success");
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
    setThreshold(DEFAULT_BE_THRESHOLD);
    setToast(null);
    setRawText("");
    setInspection(null);
    setGuessed({});
  }

  const excludedCount = previewRows.filter((r) => r.excluded).length;
  const newCount      = previewRows.filter((r) => !r.excluded && r.status === "new").length;
  const dupCount      = previewRows.filter((r) => !r.excluded && r.status === "dup").length;
  const deleteCount   = previewRows.filter((r) => r.excluded && r.status === "dup").length;
  const matchCount    = countBreakEven(previewRows, threshold);
  const errorCount    = parseResult?.errors.length ?? 0;
  const detectedCount = parseResult?.rows.length ?? 0;

  const pendingExclusions = previewRows.some((r) => r.excluded && r.status !== "skipped");
  const pendingRestores   = previewRows.some((r) => !r.excluded && r.status === "skipped");
  const isBusy            = phase === "importing" || isPending;
  const canSubmit         = newCount > 0 || pendingExclusions || pendingRestores;

  function getCtaLabel(): string {
    if (phase === "importing") return IMPORT.STATUS.IMPORTING;
    if (phase === "done")      return IMPORT.STATUS.DONE.replace("{count}", String(importedCount));
    if (newCount === 0 && pendingExclusions) return IMPORT.PREVIEW.EXCLUDE_CTA;
    return IMPORT.PREVIEW.IMPORT_CTA.replace("{count}", String(newCount));
  }

  const fileMeta = parseResult
    ? IMPORT.PREVIEW.FILE_META
        .replace("{rows}", String(parseResult.rows.length))
        .replace("{format}", parseResult.format)
    : undefined;

  const footerSummary = IMPORT.PREVIEW.FOOTER_SUMMARY
    .replace("{new}", String(newCount))
    .replace("{dup}", String(dupCount))
    .replace("{excluded}", String(excludedCount));

  return (
    <div className="flex flex-col gap-4 p-4 md:p-7 overflow-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Drop zone — idle or compact */}
      {phase === "drop" ? (
        <DropZone mode="idle" onFile={handleFile} />
      ) : phase === "mapping" && inspection ? (
        <>
          <DropZone mode="compact" fileName={fileName ?? undefined} onClear={handleClear} />
          <ColumnMapper
            inspection={inspection}
            initialMapping={guessed}
            onCancel={handleClear}
            onContinue={handleMapping}
          />
        </>
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
            excluded={excludedCount}
            errors={errorCount}
          />

          {/* Break-even filter */}
          <ExcludeFilter
            matchCount={matchCount}
            excludedCount={excludedCount}
            threshold={threshold}
            onThresholdChange={setThreshold}
            onApply={applyThreshold}
            onKeepAll={() => toggleAll(true)}
            disabled={isBusy || phase === "done"}
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
            <PreviewTable
              rows={previewRows}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              disabled={isBusy || phase === "done"}
            />
          </div>

          {/* Errors detail */}
          {parseResult && parseResult.errors.length > 0 && (
            <ImportErrorsTable errors={parseResult.errors} />
          )}

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-2">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-text-mute">{footerSummary}</p>
              {deleteCount > 0 && phase !== "done" && (
                <p className="text-sm text-loss">
                  {IMPORT.PREVIEW.DELETE_WARNING.replace("{count}", String(deleteCount))}
                </p>
              )}
            </div>
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
                disabled={isBusy || phase === "done" || !canSubmit}
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

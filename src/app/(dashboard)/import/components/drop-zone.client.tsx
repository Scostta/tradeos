"use client";

import { useRef, useState } from "react";
import type { DragEvent, ReactElement } from "react";
import { cn } from "~/utils/cn";
import { CloudUploadIcon } from "~/lib/ui/icons/cloud-upload-icon";
import { FileIcon } from "~/lib/ui/icons/file-icon";
import { XIcon } from "~/lib/ui/icons/x-icon";
import { IMPORT } from "~/constants/copies/import";

type Props = {
  mode: "idle" | "compact";
  fileName?: string;
  fileMeta?: string;
  onFile?: (file: File) => void;
  onClear?: () => void;
};

export function DropZone(props: Props): ReactElement {
  const { mode, fileName, fileMeta, onFile, onClear } = props;
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) return;
    onFile?.(file);
  }

  function handleClick() {
    inputRef.current?.click();
  }

  function handleInputChange() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    onFile?.(file);
  }

  if (mode === "compact") {
    return (
      <div className="flex items-center gap-4 px-5 py-3 border border-border rounded-lg bg-surface">
        <FileIcon className="w-5 h-5 text-text-mute shrink-0" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-md font-medium text-text truncate">{fileName}</span>
          <span className="text-sm text-text-mute mono truncate">{fileMeta}</span>
        </div>
        <span className="text-xs text-profit border border-profit/30 bg-profit/10 rounded-sm px-2 py-0.5 mono shrink-0">
          {IMPORT.PREVIEW.PARSED_BADGE}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="p-1 rounded text-text-mute hover:text-text-dim transition-colors shrink-0"
          aria-label="Clear file"
        >
          <XIcon />
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative overflow-hidden cursor-pointer",
        "border-2 border-dashed rounded-lg",
        "py-8 md:py-12 px-4 md:px-8",
        "flex flex-col items-center justify-center gap-4",
        "transition-all duration-200",
        isDragging
          ? "border-accent bg-surface-2"
          : "border-border-hi bg-surface/50 hover:bg-surface hover:border-border-hi"
      )}
    >
      {/* Decorative grid pattern */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.015) 39px, rgba(255,255,255,0.015) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.015) 39px, rgba(255,255,255,0.015) 40px)",
        }}
      />

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleInputChange}
      />

      <CloudUploadIcon
        className={cn(
          "w-12 h-12 transition-colors duration-200",
          isDragging ? "text-accent" : "text-text-mute"
        )}
      />

      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-md font-medium text-text">
          {IMPORT.DROP.HEADLINE}
        </span>
        <span className="text-sm text-text-mute">
          {IMPORT.DROP.SUBTITLE}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 max-w-md">
        {IMPORT.DROP.BROKERS.map((b) => (
          <span key={b} className="label-caps bg-surface-2 rounded-sm border border-border px-2 py-0.5">
            {b}
          </span>
        ))}
        <span className="label-caps rounded-sm border border-accent/40 bg-accent/10 text-accent px-2 py-0.5">
          {IMPORT.DROP.ANY}
        </span>
      </div>

      <span className="text-xxs text-text-mute mono text-center max-w-sm">
        {IMPORT.DROP.HINT}
      </span>
    </div>
  );
}

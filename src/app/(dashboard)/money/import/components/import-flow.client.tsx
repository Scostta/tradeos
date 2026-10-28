"use client"

import { useRef, useState, useTransition } from "react"
import type { DragEvent, ReactElement } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createFinanceAccount, importFinanceTransactions, previewFinanceImport } from "~/actions/finance"
import { APP_URLS } from "~/constants/app-urls"
import { MONEY } from "~/constants/copies/money"
import { guessMapping, inspectCsv, parseWithMapping } from "~/lib/finance/parsers/generic"
import type { CsvInspection, FinanceMapping } from "~/lib/finance/parsers/generic"
import { detectKnownFormat } from "~/lib/finance/parsers/registry"
import { UnrecognizedLayoutError } from "~/lib/finance/parsers/types"
import type { ParseResult } from "~/lib/finance/parsers/types"
import { INPUT_CLS } from "~/lib/ui/form"
import { Spinner } from "~/lib/ui/spinner"
import { Toast } from "~/lib/ui/toast"
import { UploadIcon } from "~/lib/ui/icons/upload-icon"
import type { FinanceAccount, FinanceAccountKind, FinanceCategory, ImportPreview, ImportResult } from "~/types/finance"
import { cn } from "~/utils/cn"
import { moneyErrorMessage } from "../../components/money-errors"
import { ColumnMapper } from "./column-mapper.client"
import { ImportReview } from "./import-review.client"

const I = MONEY.IMPORT
const NEW_ACCOUNT = "__new"
const MAX_BYTES = 5 * 1024 * 1024

type Phase = "upload" | "mapping" | "review" | "done"

/** UTF-8 si es válido; si no, Windows-1252 (CSV antiguos de bancos españoles). */
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder("windows-1252").decode(buf)
  }
}

/** Lo que viaja al servidor: sin el número de línea (solo sirve para los errores). */
function toImportRows(result: ParseResult) {
  return result.rows.map(r => ({ bookedAt: r.bookedAt, conceptRaw: r.conceptRaw, amount: r.amount, balanceAfter: r.balanceAfter }))
}

function Steps({ phase }: { phase: Phase }): ReactElement {
  const steps = [
    { label: I.STEP_UPLOAD, done: phase !== "upload", on: phase === "upload" },
    { label: I.STEP_REVIEW, done: phase === "done", on: phase === "review" || phase === "mapping" },
    { label: I.STEP_CONFIRM, done: phase === "done", on: false },
  ]
  return (
    <div className="flex items-center gap-6">
      {steps.map((s, i) => (
        <div key={s.label} className={cn("flex items-center gap-2 text-sm", s.on ? "text-text font-medium" : "text-text-mute")}>
          <span className={cn(
            "mono inline-flex items-center justify-center size-5 rounded-full text-xs font-semibold border",
            s.done ? "bg-accent border-accent text-bg" : s.on ? "bg-text border-text text-bg" : "bg-surface-2 border-border text-text-mute",
          )}>
            {s.done ? "✓" : i + 1}
          </span>
          {s.label}
        </div>
      ))}
    </div>
  )
}

type Props = {
  accounts:         FinanceAccount[]   // sin la de efectivo
  categories:       FinanceCategory[]
  defaultAccountId: string | null
}

// §3.2 (artboard 06): Upload → Review → Confirm. El parser corre en el
// navegador; la huella, los duplicados y las reglas, en el servidor.
export function ImportFlow({ accounts, categories, defaultAccountId }: Props): ReactElement {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>("upload")
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? NEW_ACCOUNT)
  const [fileName, setFileName] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [inspection, setInspection] = useState<CsvInspection | null>(null)
  const [mapping, setMapping] = useState<FinanceMapping>({})
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [pending, startTransition] = useTransition()

  // Cuenta nueva sin salir del import (§3.2.1).
  const [newName, setNewName] = useState("")
  const [newKind, setNewKind] = useState<Exclude<FinanceAccountKind, "cash">>("checking")

  function fail(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 5000)
  }

  function reset() {
    setPhase("upload"); setFileName(null); setText(null); setInspection(null)
    setMapping({}); setParsed(null); setPreview(null); setResult(null); setProblem(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  function runPreview(result: ParseResult, chosen: string) {
    if (result.rows.length === 0) { setProblem(I.EMPTY_FILE); return }
    // El IBAN del fichero manda: si coincide con una cuenta, se usa esa; si la
    // elegida tiene otros 4 dígitos, no se importa en la cuenta equivocada.
    let target = chosen
    if (result.ibanLast4) {
      const match = accounts.find(a => a.ibanLast4 === result.ibanLast4)
      const current = accounts.find(a => a.id === chosen)
      if (match) target = match.id
      else if (current?.ibanLast4 && current.ibanLast4 !== result.ibanLast4) {
        setProblem(I.WRONG_ACCOUNT.replace("{file}", result.ibanLast4).replace("{account}", current.name).replace("{expected}", current.ibanLast4))
        return
      }
    }
    if (target === NEW_ACCOUNT) return
    setAccountId(target)
    setParsed(result)
    startTransition(async () => {
      const res = await previewFinanceImport({ accountId: target, rows: toImportRows(result) })
      if (res.success) { setPreview(res.data); setPhase("review") }
      else fail(moneyErrorMessage(res.error))
    })
  }

  async function handleFile(file: File) {
    setProblem(null)
    if (accountId === NEW_ACCOUNT) return
    if (file.size > MAX_BYTES) { setProblem(I.EMPTY_FILE); return }
    setFileName(file.name)
    const content = await readText(file)
    setText(content)
    const known = detectKnownFormat(content)
    if (known) {
      try {
        runPreview(known.parse(content), accountId)
      } catch (err) {
        if (err instanceof UnrecognizedLayoutError) setProblem(I.LAYOUT_ERROR.replace("{reason}", err.message))
        else throw err
      }
      return
    }
    const insp = inspectCsv(content)
    setInspection(insp)
    setMapping(guessMapping(insp.headers))
    setPhase("mapping")
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  function createAccount() {
    startTransition(async () => {
      const res = await createFinanceAccount({ accountName: newName.trim(), accountKind: newKind, ibanLast4: parsed?.ibanLast4 ?? null })
      if (res.success) { setAccountId(res.data.id); setNewName(""); router.refresh() }
      else fail(moneyErrorMessage(res.error))
    })
  }

  function confirmImport() {
    if (!parsed || !preview || preview.newCount === 0) return
    startTransition(async () => {
      const res = await importFinanceTransactions({ accountId, rows: toImportRows(parsed) })
      if (res.success) { setResult(res.data); setPhase("done"); router.refresh() }
      else fail(moneyErrorMessage(res.error))
    })
  }

  const account = accounts.find(a => a.id === accountId)

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50"><Toast variant="error" message={toast} /></div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Steps phase={phase} />
        {fileName && parsed && (
          <span className="mono text-xs text-text-mute ml-auto">
            {I.FILE_META.replace("{file}", fileName).replace("{rows}", String(parsed.rows.length)).replace("{format}", parsed.format)}
            {account && ` · ${account.name}`}
          </span>
        )}
      </div>

      {phase === "upload" && (
        <div className="flex flex-col gap-4">
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5" style={{ minWidth: 220 }}>
              <span className="label-caps">{I.ACCOUNT}</span>
              <select value={accountId} onChange={e => { setAccountId(e.target.value); setProblem(null) }} className={INPUT_CLS}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}{a.ibanLast4 ? ` · ••${a.ibanLast4}` : ""}</option>
                ))}
                <option value={NEW_ACCOUNT}>{I.NEW_ACCOUNT}</option>
              </select>
            </label>
            {accountId === NEW_ACCOUNT && (
              <>
                <label className="flex flex-col gap-1.5" style={{ minWidth: 200 }}>
                  <span className="label-caps">{MONEY.SETUP.ACCOUNT_NAME}</span>
                  <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={60} className={INPUT_CLS} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label-caps">{MONEY.SETUP.ACCOUNT_KIND}</span>
                  <select value={newKind} onChange={e => setNewKind(e.target.value as typeof newKind)} className={INPUT_CLS}>
                    {(["checking", "savings", "broker"] as const).map(k => <option key={k} value={k}>{MONEY.ACCOUNT_KINDS[k]}</option>)}
                  </select>
                </label>
                <button
                  type="button" onClick={createAccount} disabled={!newName.trim() || pending}
                  className="btn-ghost disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {I.CREATE_ACCOUNT}
                </button>
              </>
            )}
          </div>

          <label
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "card flex flex-col items-center justify-center gap-2 px-6 py-12 text-center border-dashed cursor-pointer transition-colors",
              dragging ? "border-accent bg-accent/5" : "hover:border-border-hi",
              accountId === NEW_ACCOUNT && "opacity-50 pointer-events-none",
            )}
          >
            {pending ? <Spinner size={18} /> : <UploadIcon />}
            <span className="text-md font-medium text-text">{pending ? I.READING : I.DROP_TITLE}</span>
            <span className="text-sm text-text-mute">{I.DROP_HINT}</span>
            <input
              ref={inputRef} type="file" accept=".csv,.txt,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
            />
          </label>

          {problem && <div className="card px-4 py-3 text-sm text-loss">{problem}</div>}
        </div>
      )}

      {phase === "mapping" && inspection && (
        <ColumnMapper
          inspection={inspection}
          mapping={mapping}
          onChange={setMapping}
          onCancel={reset}
          onContinue={() => text && runPreview(parseWithMapping(text, mapping), accountId)}
        />
      )}
      {phase === "mapping" && problem && <div className="card px-4 py-3 text-sm text-loss">{problem}</div>}

      {phase === "review" && preview && parsed && (
        <>
          <ImportReview preview={preview} categories={categories} errorCount={parsed.errors.length} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
            <div className="card md:col-span-2 p-0">
              <div className="px-4 py-3 border-b border-border label-caps">{I.DEDUPE_TITLE}</div>
              <p className="px-4 py-3 text-sm text-text-mute">{I.DEDUPE_BODY}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button" onClick={confirmImport} disabled={pending || preview.newCount === 0}
                className="btn-accent inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pending ? <><Spinner />{I.IMPORTING}</>
                  : preview.newCount === 0 ? I.SUBMIT_NONE
                  : I.SUBMIT.replace("{n}", String(preview.newCount))}
              </button>
              <button type="button" onClick={reset} className="btn-ghost justify-center">{I.CANCEL}</button>
            </div>
          </div>
        </>
      )}

      {phase === "done" && result && (
        <div className="card p-6 flex flex-col items-start gap-3">
          <div className="text-lg font-semibold text-text">{I.DONE_TITLE.replace("{n}", String(result.imported))}</div>
          <p className="text-md text-text-dim">
            {I.DONE_BODY.replace("{dups}", String(result.duplicates)).replace("{rules}", String(result.categorized))}
          </p>
          <div className="flex flex-wrap gap-2">
            {result.imported - result.categorized > 0 && (
              <Link href={`${APP_URLS.MONEY_TRANSACTIONS}?queue=1`} className="btn-accent">
                {I.DONE_QUEUE.replace("{n}", String(result.imported - result.categorized))}
              </Link>
            )}
            <button type="button" onClick={reset} className="btn-ghost">{I.DONE_ANOTHER}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── POST /api/ingest/ninjatrader ──────────────────────────────────────────────
// Entrada del add-on de NinjaTrader 8 (public/downloads/TradeOSSync.cs).
//
// - Auth: "Authorization: Bearer tos_..." (api_tokens). No hay sesión de
//   Supabase, así que todo va por el service-role client filtrando por el
//   user_id del token.
// - Body multipart: `payload` (JSON, IngestPayload) + `screenshot` opcional (PNG
//   o JPEG del chart, se recodifica a WebP).
// - Idempotente: dedupe por (account_id, import_key), la misma huella que el
//   import CSV. El add-on reenvía al reiniciar NinjaTrader y tras fallos de red,
//   así que los duplicados son normales. Respeta import_exclusions.
// - La captura solo se adjunta a trades recién insertados (un reenvío no la
//   duplica). A los trades ya existentes sin stop se les rellena el stop.

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "~/utils/supabase/service"
import { loadCommissionRates, withEstimatedCommission } from "~/services/commission-rates"
import { hashApiToken, parseBearerToken } from "~/helpers/api-token"
import { buildSyncTradeRows, dropCoveredRows } from "~/lib/ingest/ninjatrader-sync"
import { compressScreenshot } from "~/lib/images/compress-screenshot"
import { ingestPayloadSchema } from "~/types/ingest"
import type { IngestResponse } from "~/types/ingest"

const BUCKET = "trade-attachments"
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024
const SCREENSHOT_TYPES = new Set(["image/png", "image/jpeg"])

function fail(error: string, status: number): NextResponse<IngestResponse> {
  return NextResponse.json({ ok: false, error }, { status })
}

export async function POST(req: NextRequest): Promise<NextResponse<IngestResponse>> {
  const token = parseBearerToken(req.headers.get("authorization"))
  if (!token) return fail("UNAUTHENTICATED", 401)

  const service = createServerClient()

  const { data: tokenRow, error: tokenError } = await service
    .from("api_tokens")
    .select("id, user_id")
    .eq("token_hash", hashApiToken(token))
    .is("revoked_at", null)
    .maybeSingle()

  if (tokenError) {
    console.error(tokenError)
    return fail("INTERNAL_ERROR", 500)
  }
  if (!tokenRow) return fail("UNAUTHENTICATED", 401)

  const userId = tokenRow.user_id as string

  // ── Body ───────────────────────────────────────────────────────────────────
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail("INVALID_BODY", 400)
  }

  const rawPayload = form.get("payload")
  if (typeof rawPayload !== "string") return fail("MISSING_PAYLOAD", 400)

  let json: unknown
  try {
    json = JSON.parse(rawPayload)
  } catch {
    return fail("INVALID_PAYLOAD", 400)
  }

  const parsed = ingestPayloadSchema.safeParse(json)
  if (!parsed.success) return fail("INVALID_PAYLOAD", 400)

  const screenshot = form.get("screenshot")
  if (screenshot !== null) {
    if (!(screenshot instanceof File))            return fail("INVALID_SCREENSHOT", 400)
    if (!SCREENSHOT_TYPES.has(screenshot.type))   return fail("INVALID_SCREENSHOT", 400)
    if (screenshot.size > MAX_SCREENSHOT_BYTES)   return fail("SCREENSHOT_TOO_LARGE", 413)
  }

  // Non-fatal: solo informativo en /settings.
  const { error: touchError } = await service
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id)
  if (touchError) console.error(touchError)

  // ── Cuenta (misma regla que el import: upsert sin pisar lo editado) ────────
  const accountName = parsed.data.account

  const { error: upsertAccountError } = await service
    .from("accounts")
    .upsert(
      { user_id: userId, name: accountName },
      { onConflict: "user_id,name", ignoreDuplicates: true }
    )

  if (upsertAccountError) {
    console.error(upsertAccountError)
    return fail("INTERNAL_ERROR", 500)
  }

  const { data: account, error: accountError } = await service
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("name", accountName)
    .single()

  if (accountError || !account) {
    console.error(accountError)
    return fail("INTERNAL_ERROR", 500)
  }

  const accountId = account.id as string

  // ── Trades ────────────────────────────────────────────────────────────────
  const rows = buildSyncTradeRows(parsed.data)
  const importKeys = rows.map((r) => r.importKey)

  const { data: exclusions, error: exclusionsError } = await service
    .from("import_exclusions")
    .select("import_key")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .in("import_key", importKeys)

  if (exclusionsError) {
    console.error(exclusionsError)
    return fail("INTERNAL_ERROR", 500)
  }

  const excludedKeys = new Set((exclusions ?? []).map((e) => e.import_key as string))
  const wanted = rows.filter((r) => !excludedKeys.has(r.importKey))

  // Reenvíos con otro reparto de contratos (dropCoveredRows): se buscan los
  // trades de la cuenta en la ventana de entradas del payload.
  let fresh = wanted
  if (wanted.length > 0) {
    const entries = wanted.map((r) => r.entryTime).sort()
    const { data: existing, error: existingError } = await service
      .from("trades")
      .select("instrument, direction, contracts, entry_price, exit_price, entry_time, exit_time")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .gte("entry_time", new Date(Date.parse(entries[0]!) - 1000).toISOString())
      .lte("entry_time", new Date(Date.parse(entries[entries.length - 1]!) + 1000).toISOString())

    if (existingError) {
      console.error(existingError)
      return fail("INTERNAL_ERROR", 500)
    }

    fresh = dropCoveredRows(wanted, (existing ?? []).map((t) => ({
      instrument: t.instrument as string,
      direction:  t.direction as "long" | "short",
      contracts:  Number(t.contracts),
      entryPrice: Number(t.entry_price),
      exitPrice:  Number(t.exit_price),
      entryTime:  t.entry_time as string,
      exitTime:   t.exit_time as string,
    })))
  }

  let insertedIds: string[] = []
  if (fresh.length > 0) {
    // Sin comisión del bróker (cuenta sin plantilla en NinjaTrader): tarifa de la
    // cuenta. Si las tarifas no se pueden leer, el trade entra igual sin estimar.
    const rates = (await loadCommissionRates(service, [accountId])) ?? new Map()
    const { data: inserted, error: insertError } = await service
      .from("trades")
      .upsert(
        fresh.map((r) => ({
          user_id:     userId,
          account_id:  accountId,
          import_key:  r.importKey,
          instrument:  r.instrument,
          direction:   r.direction,
          contracts:   r.contracts,
          entry_price: r.entryPrice,
          exit_price:  r.exitPrice,
          entry_time:  r.entryTime,
          exit_time:   r.exitTime,
          pnl:         r.pnl,
          ...withEstimatedCommission(r, rates.get(accountId)),
          mae:         r.mae,
          mfe:         r.mfe,
          stop_price:  r.stopPrice,
          source:      "sync",
        })),
        { onConflict: "account_id,import_key", ignoreDuplicates: true }
      )
      .select("id, import_key")

    if (insertError) {
      console.error(insertError)
      return fail("INTERNAL_ERROR", 500)
    }

    insertedIds = (inserted ?? []).map((t) => t.id as string)

    // Trades que ya estaban (p. ej. importados antes por CSV): solo se les
    // rellena el stop si no tenían, nunca se pisa uno puesto a mano.
    const insertedKeys = new Set((inserted ?? []).map((t) => t.import_key as string))
    for (const row of wanted) {
      if (insertedKeys.has(row.importKey) || row.stopPrice === null) continue
      const { error: stopError } = await service
        .from("trades")
        .update({ stop_price: row.stopPrice })
        .eq("user_id", userId)
        .eq("account_id", accountId)
        .eq("import_key", row.importKey)
        .is("stop_price", null)
      if (stopError) console.error(stopError)
    }
  }

  // ── Captura del chart ─────────────────────────────────────────────────────
  // Non-fatal: los trades ya están guardados; si falla, el add-on no reintenta
  // (el reintento no la adjuntaría, los trades ya no son nuevos).
  let attached = false
  if (screenshot instanceof File && insertedIds.length > 0) {
    attached = await attachScreenshot(service, userId, insertedIds, screenshot)
  }

  return NextResponse.json({
    ok:         true,
    imported:   insertedIds.length,
    duplicates: wanted.length - insertedIds.length,
    excluded:   rows.length - wanted.length,
    attached,
  })
}

async function attachScreenshot(
  service: ReturnType<typeof createServerClient>,
  userId: string,
  tradeIds: string[],
  file: File,
): Promise<boolean> {
  let image
  try {
    image = await compressScreenshot(Buffer.from(await file.arrayBuffer()))
  } catch (err) {
    console.error(err)
    return false
  }

  const fileName = `ninjatrader-${Date.now()}.webp`
  const uploaded: string[] = []

  // Una copia por trade: cada attachment es dueño de su objeto en Storage, así
  // borrar el trade o el attachment de una fila no rompe la de las demás.
  for (const tradeId of tradeIds) {
    const storagePath = `${userId}/${tradeId}/${fileName}`

    const { error: uploadError } = uploaded.length === 0
      ? await service.storage.from(BUCKET).upload(storagePath, image.buffer, {
          contentType: image.mimeType,
          upsert:      false,
        })
      : await service.storage.from(BUCKET).copy(uploaded[0]!, storagePath)

    if (uploadError) {
      console.error(uploadError)
      continue
    }

    const { error: rowError } = await service.from("trade_attachments").insert({
      user_id:      userId,
      trade_id:     tradeId,
      storage_path: storagePath,
      file_name:    fileName,
      mime_type:    image.mimeType,
      size_bytes:   image.buffer.length,
    })

    if (rowError) {
      console.error(rowError)
      await service.storage.from(BUCKET).remove([storagePath])
      continue
    }

    uploaded.push(storagePath)
  }

  return uploaded.length > 0
}

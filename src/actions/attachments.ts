"use server"

import { createClient } from "~/utils/supabase/server"
import { createServerClient } from "~/utils/supabase/service"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

const BUCKET = "trade-attachments"

// The bucket is private; images are served via short-lived signed URLs.
// The card re-fetches attachments on every mount, so a 1h TTL is plenty.
const SIGNED_URL_TTL = 60 * 60

export type TradeAttachment = {
  id:          string
  storagePath: string
  fileName:    string
  mimeType:    string
  sizeBytes:   number
  publicUrl:   string  // signed URL (private bucket), valid for SIGNED_URL_TTL seconds
  createdAt:   string
}

// ── List attachments for a trade ─────────────────────────────────────────────
export async function getTradeAttachments(
  tradeId: string,
): Promise<ResultType<TradeAttachment[], string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("trade_attachments")
    .select("*")
    .eq("trade_id", tradeId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  const rows = data ?? []
  if (rows.length === 0) return createDataResult([])

  const service = createServerClient()

  const { data: signed } = await service.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((row) => row.storage_path), SIGNED_URL_TTL)

  const urlByPath = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl] as const)
  )

  const attachments: TradeAttachment[] = rows.map((row) => ({
    id:          row.id,
    storagePath: row.storage_path,
    fileName:    row.file_name,
    mimeType:    row.mime_type,
    sizeBytes:   row.size_bytes,
    publicUrl:   urlByPath.get(row.storage_path) ?? "",
    createdAt:   row.created_at,
  }))

  return createDataResult(attachments)
}

// ── Upload a single attachment ────────────────────────────────────────────────
export async function uploadTradeAttachment(
  formData: FormData,
): Promise<ResultType<TradeAttachment, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const file    = formData.get("file")
  const tradeId = formData.get("tradeId")

  if (!(file instanceof File))     return createErrorResult("INVALID_FILE")
  if (typeof tradeId !== "string") return createErrorResult("INVALID_TRADE_ID")

  if (file.size > 10 * 1024 * 1024) return createErrorResult("FILE_TOO_LARGE")
  if (!file.type.startsWith("image/")) return createErrorResult("INVALID_MIME_TYPE")

  const ext         = file.name.split(".").pop() ?? "jpg"
  const storagePath = `${user.id}/${tradeId}/${Date.now()}.${ext}`

  const service = createServerClient()
  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error(uploadError)
    return createErrorResult(uploadError.message)
  }

  const { data: row, error: dbError } = await supabase
    .from("trade_attachments")
    .insert({
      user_id:      user.id,
      trade_id:     tradeId,
      storage_path: storagePath,
      file_name:    file.name,
      mime_type:    file.type,
      size_bytes:   file.size,
    })
    .select("*")
    .single()

  if (dbError) {
    // Clean up storage on DB failure
    await service.storage.from(BUCKET).remove([storagePath])
    console.error(dbError)
    return createErrorResult(dbError.message)
  }

  const { data: urlData } = await service.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  return createDataResult({
    id:          row.id,
    storagePath: row.storage_path,
    fileName:    row.file_name,
    mimeType:    row.mime_type,
    sizeBytes:   row.size_bytes,
    publicUrl:   urlData?.signedUrl ?? "",
    createdAt:   row.created_at,
  })
}

// ── Delete an attachment ──────────────────────────────────────────────────────
export async function deleteTradeAttachment(
  attachmentId: string,
): Promise<ResultType<{ id: string }, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data: row, error: fetchError } = await supabase
    .from("trade_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .eq("user_id", user.id)
    .single()

  if (fetchError || !row) return createErrorResult("NOT_FOUND")

  const service = createServerClient()
  await service.storage.from(BUCKET).remove([row.storage_path])

  const { error: dbError } = await supabase
    .from("trade_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("user_id", user.id)

  if (dbError) {
    console.error(dbError)
    return createErrorResult(dbError.message)
  }

  return createDataResult({ id: attachmentId })
}

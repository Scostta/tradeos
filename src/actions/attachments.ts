"use server"

import { createClient } from "~/utils/supabase/server"
import { createServerClient } from "~/utils/supabase/service"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"

const BUCKET = "trade-attachments"

export type TradeAttachment = {
  id:          string
  storagePath: string
  fileName:    string
  mimeType:    string
  sizeBytes:   number
  publicUrl:   string
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

  const service = createServerClient()
  const attachments: TradeAttachment[] = (data ?? []).map((row) => {
    const { data: urlData } = service.storage
      .from(BUCKET)
      .getPublicUrl(row.storage_path)
    return {
      id:          row.id,
      storagePath: row.storage_path,
      fileName:    row.file_name,
      mimeType:    row.mime_type,
      sizeBytes:   row.size_bytes,
      publicUrl:   urlData.publicUrl,
      createdAt:   row.created_at,
    }
  })

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

  const { data: urlData } = service.storage.from(BUCKET).getPublicUrl(storagePath)

  return createDataResult({
    id:          row.id,
    storagePath: row.storage_path,
    fileName:    row.file_name,
    mimeType:    row.mime_type,
    sizeBytes:   row.size_bytes,
    publicUrl:   urlData.publicUrl,
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

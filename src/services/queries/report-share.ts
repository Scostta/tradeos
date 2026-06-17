import { createClient } from "~/utils/supabase/server"
import { createServerClient } from "~/utils/supabase/service"
import { reportSnapshotSchema } from "~/types/report-share"
import { createDataResult, createErrorResult } from "~/helpers/result"
import type { ResultType } from "~/helpers/result"
import type { ReportShareSummary, PublicShare } from "~/types/report-share"

/** The signed-in owner's active shares (for the management panel). */
export async function listReportShares(): Promise<ResultType<ReportShareSummary[], string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return createErrorResult("UNAUTHENTICATED")

  const { data, error } = await supabase
    .from("report_shares")
    .select("id, token, title, created_at")
    .eq("user_id", user.id)
    .eq("revoked", false)
    .order("created_at", { ascending: false })

  if (error) {
    console.error(error)
    return createErrorResult(error.message)
  }

  return createDataResult(
    (data ?? []).map((r) => ({
      id:        r.id as string,
      token:     r.token as string,
      title:     r.title as string,
      createdAt: r.created_at as string,
    })),
  )
}

/**
 * Public read of a share by token. Uses the service-role client (bypasses RLS,
 * no auth needed) but only ever selects the curated snapshot — never user_id,
 * account_id or raw trades. Returns null if the token is unknown or revoked.
 */
export async function getPublicShare(token: string): Promise<PublicShare | null> {
  const service = createServerClient()
  const { data, error } = await service
    .from("report_shares")
    .select("title, snapshot, created_at")
    .eq("token", token)
    .eq("revoked", false)
    .maybeSingle()

  if (error) {
    console.error(error)
    return null
  }
  if (!data) return null

  const parsed = reportSnapshotSchema.safeParse(data.snapshot)
  if (!parsed.success) {
    console.error("Invalid report snapshot:", parsed.error)
    return null
  }

  return { title: data.title as string, createdAt: data.created_at as string, snapshot: parsed.data }
}

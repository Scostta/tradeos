import "server-only"
import { createClient } from "@supabase/supabase-js"
import { envClient } from "~/env/client"
import { envServer } from "~/env/server"

export function createServerClient() {
  return createClient(
    envClient.NEXT_PUBLIC_SUPABASE_URL,
    envServer.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

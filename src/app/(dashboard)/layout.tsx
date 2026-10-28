import { cookies } from "next/headers";
import { createClient } from "~/utils/supabase/server";
import { getProfile } from "~/services/queries/profile";
import { DashboardShell } from "~/components/layout/dashboard-shell.client";
import { ACTIVE_MODULE_COOKIE, parseModule } from "~/helpers/active-module";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ data: { user } }, profileResult, cookieStore] = await Promise.all([
    supabase.auth.getUser(),
    getProfile(),
    cookies(),
  ]);

  const userName = profileResult.success ? profileResult.data.displayName : null;
  const timezone = profileResult.success ? profileResult.data.timezone : "UTC";
  // Último módulo visitado: el sidebar lo muestra en las rutas compartidas.
  const initialModule = parseModule(cookieStore.get(ACTIVE_MODULE_COOKIE)?.value) ?? "trading";

  return (
    <DashboardShell
      userEmail={user?.email}
      userName={userName ?? undefined}
      timezone={timezone}
      initialModule={initialModule}
    >
      {children}
    </DashboardShell>
  );
}

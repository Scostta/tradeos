import { createClient } from "~/utils/supabase/server";
import { getProfile } from "~/services/queries/profile";
import { getPropFirmAlerts } from "~/services/queries/accounts";
import { DashboardShell } from "~/components/layout/dashboard-shell.client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ data: { user } }, profileResult, propFirmAlerts] = await Promise.all([
    supabase.auth.getUser(),
    getProfile(),
    getPropFirmAlerts(),
  ]);

  const userName = profileResult.success ? profileResult.data.displayName : null;
  const timezone = profileResult.success ? profileResult.data.timezone : "UTC";

  return (
    <DashboardShell
      userEmail={user?.email}
      userName={userName ?? undefined}
      timezone={timezone}
      propFirmAlerts={propFirmAlerts}
    >
      {children}
    </DashboardShell>
  );
}

import { createClient } from "~/utils/supabase/server";
import { DashboardShell } from "~/components/layout/dashboard-shell.client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <DashboardShell userEmail={user?.email}>
      {children}
    </DashboardShell>
  );
}

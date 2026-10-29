import { cookies } from "next/headers";
import { createClient } from "~/utils/supabase/server";
import { getProfile } from "~/services/queries/profile";
import { DashboardShell } from "~/components/layout/dashboard-shell.client";
import { InvestSellBanner } from "~/components/layout/invest-sell-banner.client";
import { getInvestSellAlerts } from "~/services/queries/invest";
import { ACTIVE_MODULE_COOKIE, parseModule } from "~/helpers/active-module";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // Aviso de venta de Invest en toda la app (INVEST_SPEC §4.9): solo lectura.
  const [{ data: { user } }, profileResult, cookieStore, sellAlerts] = await Promise.all([
    supabase.auth.getUser(),
    getProfile(),
    cookies(),
    getInvestSellAlerts(),
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
      <InvestSellBanner alerts={sellAlerts} />
      {/* El `h-full` de cada página mide lo que queda debajo del aviso. */}
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </DashboardShell>
  );
}

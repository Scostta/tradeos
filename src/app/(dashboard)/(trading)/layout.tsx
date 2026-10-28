import { getPropFirmAlerts } from "~/services/queries/accounts";
import { PropFirmAlertBanner } from "~/components/layout/prop-firm-alert-banner.client";

// Rutas del módulo Trading (route group: no cambia las URLs). Es el único que
// pide las alertas de prop firm: Invest, Money y /settings no las cargan.
export default async function TradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const propFirmAlerts = await getPropFirmAlerts();

  return (
    <>
      <PropFirmAlertBanner alerts={propFirmAlerts} />
      {/* Mismo patrón que el shell: el `h-full` de cada página mide lo que
          queda debajo del banner. */}
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </>
  );
}

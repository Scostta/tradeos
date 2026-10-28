import { redirect } from "next/navigation";
import { APP_URLS } from "~/constants/app-urls";

// "/" la resuelve el proxy (login o home del último módulo). Esto es solo
// la red de seguridad si algún día no pasa por él.
export default function RootPage() {
  redirect(APP_URLS.DASHBOARD);
}

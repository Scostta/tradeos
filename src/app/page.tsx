import { redirect } from "next/navigation";
import { APP_URLS } from "~/constants/app-urls";

export default function RootPage() {
  redirect(APP_URLS.DASHBOARD);
}

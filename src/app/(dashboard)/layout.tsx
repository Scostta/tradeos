import { createClient } from "~/utils/supabase/server";
import { Sidebar } from "~/components/layout/sidebar.client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar userEmail={user?.email} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}

import { requireAuth } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AccountOption } from "@/components/shell/AccountSwitcher";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, name, slug, status, account_personas(display_name, genre)")
    .order("created_at");

  const accounts: AccountOption[] = (data ?? []).map((a: any) => {
    const persona = Array.isArray(a.account_personas)
      ? a.account_personas[0]
      : a.account_personas;
    return {
      id: a.id,
      name: a.name,
      slug: a.slug,
      status: a.status,
      displayName: persona?.display_name ?? null,
      genre: persona?.genre ?? null,
    };
  });

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen flex bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header accounts={accounts} />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

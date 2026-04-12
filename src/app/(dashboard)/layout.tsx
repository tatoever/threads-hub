import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <Link href="/" className="text-lg font-bold text-white">
            Threads Hub
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavItem href="/" label="ダッシュボード" />
          <NavItem href="/accounts" label="アカウント" />
          <NavItem href="/pipeline" label="パイプライン" />
          <NavItem href="/alerts" label="アラート" />
          <NavItem href="/settings" label="設定" />
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-md text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
    >
      {label}
    </Link>
  );
}

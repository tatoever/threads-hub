"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Workflow,
  AlertTriangle,
  Settings,
  Sparkles,
  FlaskConical,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NavEntry = {
  href: string;
  label: string;
  icon: React.ElementType;
  matchPrefix?: string;
};

const NAV: NavEntry[] = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/accounts", label: "アカウント", icon: Users, matchPrefix: "/accounts" },
  { href: "/pipeline", label: "パイプライン", icon: Workflow },
  { href: "/buzz-templates", label: "バズ構文", icon: FlaskConical, matchPrefix: "/buzz-templates" },
  { href: "/articles", label: "記事", icon: FileText, matchPrefix: "/articles" },
  { href: "/alerts", label: "アラート", icon: AlertTriangle },
  { href: "/settings", label: "設定", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r border-border bg-surface-subtle">
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        <Link href="/" className="font-semibold tracking-tight">
          Threads Hub
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map((item) => {
          const active =
            item.matchPrefix
              ? pathname?.startsWith(item.matchPrefix)
              : pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border text-[11px] text-muted-foreground">
        <p className="font-medium text-foreground/70">10アカウント運用基盤</p>
        <p className="mt-0.5">v0.1 · threads-hub</p>
      </div>
    </aside>
  );
}

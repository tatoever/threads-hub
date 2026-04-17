"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AccountSwitcher, type AccountOption } from "./AccountSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function useBreadcrumb(accounts: AccountOption[]) {
  const pathname = usePathname() ?? "/";
  const segments = pathname.split("/").filter(Boolean);

  const parts: { label: string; href?: string }[] = [];

  if (segments.length === 0) {
    parts.push({ label: "ダッシュボード" });
    return parts;
  }

  const [root, maybeId, tail] = segments;
  if (root === "accounts") {
    parts.push({ label: "アカウント", href: "/accounts" });
    if (maybeId === "new") {
      parts.push({ label: "新規作成" });
    } else if (maybeId) {
      const acc = accounts.find((a) => a.id === maybeId);
      parts.push({
        label: acc?.displayName || acc?.name || "詳細",
        href: `/accounts/${maybeId}`,
      });
      if (tail) parts.push({ label: tail });
    }
  } else if (root === "pipeline") {
    parts.push({ label: "パイプライン" });
  } else if (root === "alerts") {
    parts.push({ label: "アラート" });
  } else if (root === "settings") {
    parts.push({ label: "設定" });
  } else {
    parts.push({ label: root });
  }

  return parts;
}

export function Header({ accounts }: { accounts: AccountOption[] }) {
  const crumbs = useBreadcrumb(accounts);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        {crumbs.map((c, i) => (
          <React.Fragment key={`${c.label}-${i}`}>
            {i > 0 && (
              <span className="text-muted-foreground/60" aria-hidden>
                /
              </span>
            )}
            {c.href && i < crumbs.length - 1 ? (
              <Link
                href={c.href}
                className="truncate text-muted-foreground hover:text-foreground transition-colors"
              >
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-foreground">{c.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <AccountSwitcher accounts={accounts} />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <Link href="/alerts" aria-label="アラート">
            <Bell className="size-4" />
          </Link>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

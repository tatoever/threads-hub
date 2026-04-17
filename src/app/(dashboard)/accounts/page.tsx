"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot, statusToTone } from "@/components/shell/StatusDot";
import { PageHeader } from "@/components/dashboard/PageHeader";

interface Account {
  id: string;
  name: string;
  slug: string;
  status: string;
  daily_post_target: number;
  default_model: string;
  account_personas: any;
  account_tokens: any;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <PageHeader
        title="アカウント管理"
        description={`登録済み ${accounts.length} アカウント`}
        actions={
          <Button asChild>
            <Link href="/accounts/new">
              <Plus className="size-4" />
              新規追加
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">まだアカウントがありません</p>
          <p className="text-sm text-muted-foreground mt-1">
            「新規追加」から始めましょう
          </p>
          <Button asChild className="mt-4">
            <Link href="/accounts/new">
              <Plus className="size-4" />
              新規追加
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const persona = Array.isArray(account.account_personas)
              ? account.account_personas[0]
              : account.account_personas;
            const token = Array.isArray(account.account_tokens)
              ? account.account_tokens[0]
              : account.account_tokens;

            return (
              <Link
                key={account.id}
                href={`/accounts/${account.id}`}
                className="group"
              >
                <Card className="p-5 h-full transition-all hover:border-border-strong hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusDot tone={statusToTone(account.status)} />
                        <h2 className="font-semibold truncate group-hover:text-primary transition-colors">
                          {persona?.display_name || account.name}
                        </h2>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        @{account.slug}
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    {persona?.genre && (
                      <Badge variant="outline">{persona.genre}</Badge>
                    )}
                    {persona?.niche && (
                      <Badge variant="secondary">{persona.niche}</Badge>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-xs pt-4 border-t border-border">
                    <div>
                      <p className="text-muted-foreground">投稿</p>
                      <p className="font-semibold tabular-nums mt-0.5">
                        {account.daily_post_target}
                        <span className="text-muted-foreground text-[10px] ml-0.5">本/日</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">モデル</p>
                      <p className="font-semibold mt-0.5">
                        {account.default_model === "opus" ? "Opus" : "Sonnet"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">API</p>
                      <p
                        className={
                          token?.status === "active"
                            ? "text-success font-semibold mt-0.5"
                            : "text-warning font-semibold mt-0.5"
                        }
                      >
                        {token?.status === "active" ? "接続済" : "未接続"}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

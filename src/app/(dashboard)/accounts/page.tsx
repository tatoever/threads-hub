"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Sparkles, Send, KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot, statusToTone } from "@/components/shell/StatusDot";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { cn } from "@/lib/utils/cn";

interface Account {
  id: string;
  name: string;
  slug: string;
  status: string;
  daily_post_target: number;
  default_model: string;
  profile_picture_url: string | null;
  profile_bio: string | null;
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
            <Skeleton key={i} className="h-56" />
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
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountCard({ account }: { account: Account }) {
  const persona = Array.isArray(account.account_personas)
    ? account.account_personas[0]
    : account.account_personas;
  const token = Array.isArray(account.account_tokens)
    ? account.account_tokens[0]
    : account.account_tokens;

  const displayName = persona?.display_name || account.name;
  const bio = account.profile_bio || persona?.background || null;
  const apiActive = token?.status === "active";

  return (
    <Link href={`/accounts/${account.id}`} className="group">
      <Card className="h-full overflow-hidden transition-all hover:border-border-strong hover:shadow-md">
        {/* Header: name left / avatar right */}
        <div className="p-5 pb-4">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StatusDot tone={statusToTone(account.status)} />
                <h2 className="text-base font-semibold truncate group-hover:text-primary transition-colors">
                  {displayName}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                @{account.slug}
              </p>
            </div>
            <Avatar
              src={account.profile_picture_url}
              name={displayName}
              seed={account.id}
              size="lg"
              ring
            />
          </div>

          {/* Bio */}
          {bio ? (
            <p className="mt-3 text-xs text-foreground/80 whitespace-pre-wrap line-clamp-3 leading-relaxed">
              {bio}
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground italic">
              プロフィール未設定
            </p>
          )}

          {/* Tags */}
          {(persona?.genre || persona?.niche) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {persona?.genre && <Badge variant="outline">{persona.genre}</Badge>}
              {persona?.niche && <Badge variant="secondary">{persona.niche}</Badge>}
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-3 border-t border-border bg-surface-subtle/60">
          <StatCell
            icon={Send}
            label="投稿"
            value={
              <span>
                {account.daily_post_target}
                <span className="text-[10px] text-muted-foreground ml-0.5">本/日</span>
              </span>
            }
          />
          <StatCell
            icon={Sparkles}
            label="モデル"
            value={account.default_model === "opus" ? "Opus" : "Sonnet"}
          />
          <StatCell
            icon={KeyRound}
            label="API"
            value={
              <span className={apiActive ? "text-success" : "text-warning"}>
                {apiActive ? "接続済" : "未接続"}
              </span>
            }
          />
          <span className="sr-only">
            <ArrowRight />
          </span>
        </div>
      </Card>
    </Link>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-3 py-3 border-r border-border last:border-r-0")}>
      <div className="inline-flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums leading-tight">
        {value}
      </div>
    </div>
  );
}

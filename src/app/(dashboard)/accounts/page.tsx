"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Sparkles, Send, KeyRound, ExternalLink } from "lucide-react";
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
  const threadsUrl = `https://www.threads.net/@${account.slug}`;

  return (
    <div className="group relative">
      <Card className="h-full overflow-hidden transition-all hover:border-border-strong hover:shadow-md">
        {/* カード全体をクリック可能にする透明オーバーレイ（Threadsボタンはこの上に乗せる） */}
        <Link
          href={`/accounts/${account.id}`}
          aria-label={`${displayName} の詳細`}
          className="absolute inset-0 z-10"
        />

        {/* Header: name left / avatar right */}
        <div className="p-5 pb-4 relative z-0">
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

          {/* Tags — ジャンル + Threads 直リンクボタン */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {persona?.genre && <Badge variant="outline">{persona.genre}</Badge>}
            <a
              href={threadsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`Threadsで @${account.slug} を開く`}
              className="relative z-20 inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border-strong transition-colors"
            >
              <ExternalLink className="size-3" />
              Threads
            </a>
          </div>
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
    </div>
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

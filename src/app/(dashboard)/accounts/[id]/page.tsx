import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ExternalLink,
  Cpu,
  Send,
  KeyRound,
  Megaphone,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusDot, statusToTone } from "@/components/shell/StatusDot";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusToggle } from "@/components/account/StatusToggle";
import { AccountTabs } from "@/components/account/AccountTabs";
import { PostList } from "@/components/account/PostList";
import { FollowerChart } from "@/components/account/FollowerChart";
import { CommentPanel } from "@/components/account/CommentPanel";
import { NoteFeed } from "@/components/account/NoteFeed";
import { AccountArticlesList } from "@/components/account/AccountArticlesList";
import { RefreshProfileButton } from "@/components/account/RefreshProfileButton";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: account } = await supabase
    .from("accounts")
    .select(
      "*, account_personas(*), account_tokens(*), cta_destinations(*), research_sources(*)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!account) notFound();

  const persona = Array.isArray(account.account_personas)
    ? account.account_personas[0]
    : account.account_personas;
  const token = Array.isArray(account.account_tokens)
    ? account.account_tokens[0]
    : account.account_tokens;
  const cta = account.cta_destinations ?? [];
  const research = account.research_sources ?? [];

  const apiConnected = token?.status === "active";

  const displayName = persona?.display_name || account.name;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <Avatar
            src={account.profile_picture_url}
            name={displayName}
            seed={account.id}
            size="xl"
            ring
          />
          <div className="min-w-0 pt-1">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <StatusDot tone={statusToTone(account.status)} className="size-3" />
              {displayName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span>@{account.threads_username || account.slug}</span>
              {persona?.genre ? <span>· {persona.genre}</span> : null}
              {persona?.niche ? <span>· {persona.niche}</span> : null}
              <a
                href={`https://www.threads.net/@${account.threads_username || account.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Threadsで開く"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border-strong transition-colors"
              >
                <ExternalLink className="size-3" />
                Threadsで見る
              </a>
            </p>
            {account.profile_bio && (
              <p className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap max-w-[560px] leading-relaxed">
                {account.profile_bio}
              </p>
            )}
            {account.profile_synced_at && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                プロフィール最終同期: {new Date(account.profile_synced_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={account.status} />
          <RefreshProfileButton accountId={id} disabled={!apiConnected} />
          <StatusToggle accountId={id} currentStatus={account.status} />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="モデル"
          value={account.default_model === "opus" ? "Opus" : "Sonnet"}
          hint="AI生成モデル"
          icon={Cpu}
        />
        <KpiCard
          label="投稿目標"
          value={`${account.daily_post_target ?? 0}`}
          hint="本 / 日"
          icon={Send}
        />
        <KpiCard
          label="API接続"
          value={apiConnected ? "接続済" : "未接続"}
          hint={apiConnected ? "Threads認証済" : "要設定"}
          icon={KeyRound}
          tone={apiConnected ? "success" : "warning"}
        />
        <KpiCard
          label="CTA登録"
          value={`${cta.length}`}
          hint="誘導先"
          icon={Megaphone}
        />
      </section>

      <AccountTabs
        panels={{
          overview: (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SectionCard title="ペルソナ概要" editHref={`/accounts/${id}/concept`}>
                {persona ? (
                  <DetailList>
                    <DetailRow label="ジャンル" value={persona.genre} />
                    <DetailRow label="ニッチ" value={persona.niche} />
                    <DetailRow label="ターゲット" value={persona.target_audience} />
                    <DetailRow label="口調" value={persona.tone_style} />
                  </DetailList>
                ) : (
                  <EmptyState text="ペルソナ未設定" />
                )}
              </SectionCard>

              <SectionCard title="API接続" action={!apiConnected && <ConnectButton id={id} />}>
                {apiConnected ? (
                  <DetailList>
                    <DetailRow
                      label="ステータス"
                      value={
                        <span className="inline-flex items-center gap-1.5 text-success">
                          <CheckCircle2 className="size-4" />
                          接続済み
                        </span>
                      }
                    />
                    <DetailRow label="Threads ID" value={account.threads_user_id} mono />
                    <DetailRow
                      label="トークン期限"
                      value={
                        token?.token_expires_at
                          ? new Date(token.token_expires_at).toLocaleDateString("ja-JP")
                          : "-"
                      }
                    />
                  </DetailList>
                ) : (
                  <EmptyState
                    icon={XCircle}
                    text="Threads APIに接続されていません"
                    tone="warning"
                  />
                )}
              </SectionCard>
            </div>
          ),
          persona: (
            <SectionCard title="ペルソナ詳細" editHref={`/accounts/${id}/concept`}>
              {persona ? (
                <DetailList>
                  <DetailRow label="表示名" value={persona.display_name} />
                  <DetailRow label="ジャンル" value={persona.genre} />
                  <DetailRow label="ニッチ" value={persona.niche} />
                  <DetailRow label="ターゲット" value={persona.target_audience} />
                  <DetailRow label="口調" value={persona.tone_style} />
                  <DetailRow label="年齢感" value={persona.age_range} />
                  <DetailRow label="性別感" value={persona.gender_feel} />
                  <DetailRow label="背景" value={persona.background} multiline />
                  <DetailRow
                    label="禁止ワード"
                    value={persona.prohibited_words?.join(", ") || "なし"}
                  />
                </DetailList>
              ) : (
                <EmptyState text="ペルソナ未設定" />
              )}
            </SectionCard>
          ),
          api: (
            <SectionCard
              title="Threads API接続"
              action={!apiConnected && <ConnectButton id={id} />}
            >
              {apiConnected ? (
                <DetailList>
                  <DetailRow
                    label="ステータス"
                    value={
                      <span className="inline-flex items-center gap-1.5 text-success">
                        <CheckCircle2 className="size-4" />
                        接続済み
                      </span>
                    }
                  />
                  <DetailRow label="Threads ID" value={account.threads_user_id} mono />
                  <DetailRow
                    label="トークン期限"
                    value={
                      token?.token_expires_at
                        ? new Date(token.token_expires_at).toLocaleString("ja-JP")
                        : "-"
                    }
                  />
                </DetailList>
              ) : (
                <EmptyState icon={XCircle} text="未接続" tone="warning" />
              )}
            </SectionCard>
          ),
          notes: (
            <div className="space-y-4">
              <AccountArticlesList accountId={id} accountSlug={account.slug} />
              <NoteFeed accountId={id} />
            </div>
          ),
          operations: (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <PostList accountId={id} />
              </div>
              <div className="space-y-4">
                <FollowerChart accountId={id} />
                <CommentPanel accountId={id} />
              </div>
            </div>
          ),
          research: (
            <SectionCard
              title={`リサーチソース (${research.length}件)`}
              editHref={`/accounts/${id}/concept`}
              editLabel="設定"
            >
              {research.length > 0 ? (
                <ul className="divide-y divide-border">
                  {research.map((r: any) => (
                    <li key={r.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm capitalize">{r.source_type}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.config?.queries?.join(", ") || r.config?.url || "-"}
                        </p>
                      </div>
                      <Badge variant={r.is_active ? "success" : "secondary"}>
                        {r.is_active ? "有効" : "無効"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState text="リサーチソース未設定" />
              )}
            </SectionCard>
          ),
        }}
      />
    </div>
  );
}

function ConnectButton({ id }: { id: string }) {
  return (
    <Button asChild size="sm">
      <a href={`/api/auth/threads?account_id=${id}`}>
        <ExternalLink className="size-4" />
        Threads認証
      </a>
    </Button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "success" | "warning" | "secondary" | "danger"; label: string }> = {
    active: { variant: "success", label: "稼働中" },
    testing: { variant: "warning", label: "テスト" },
    setup: { variant: "secondary", label: "設定中" },
    paused: { variant: "danger", label: "停止中" },
  };
  const entry = map[status] ?? { variant: "secondary" as const, label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

function SectionCard({
  title,
  children,
  editHref,
  editLabel = "編集",
  action,
}: {
  title: string;
  children: React.ReactNode;
  editHref?: string;
  editLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {editHref ? (
          <Link
            href={editHref}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {editLabel}
          </Link>
        ) : action ? (
          action
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function DetailList({ children }: { children: React.ReactNode }) {
  return <dl className="space-y-2.5 text-sm">{children}</dl>;
}

function DetailRow({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "space-y-1" : "flex gap-3"}>
      <dt className="w-24 shrink-0 text-muted-foreground text-xs uppercase tracking-wider pt-0.5">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "font-mono text-xs text-foreground break-all"
            : multiline
            ? "text-foreground whitespace-pre-wrap"
            : "text-foreground"
        }
      >
        {value || <span className="text-muted-foreground">-</span>}
      </dd>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
  tone = "muted",
  actionHref,
  actionLabel,
}: {
  icon?: React.ElementType;
  text: string;
  tone?: "muted" | "warning";
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      {Icon && (
        <Icon
          className={
            tone === "warning"
              ? "size-6 text-warning mb-2"
              : "size-6 text-muted-foreground mb-2"
          }
        />
      )}
      <p
        className={
          tone === "warning" ? "text-sm text-warning" : "text-sm text-muted-foreground"
        }
      >
        {text}
      </p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-2 text-sm text-primary hover:underline"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

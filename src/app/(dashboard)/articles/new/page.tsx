import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/client";
import { NewArticleForm } from "./NewArticleForm";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const supabase = createServiceClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, slug, name, account_personas(display_name)")
    .order("created_at");

  const options = (accounts ?? []).map((a: any) => {
    const persona = Array.isArray(a.account_personas) ? a.account_personas[0] : a.account_personas;
    return {
      id: a.id,
      slug: a.slug,
      displayName: persona?.display_name ?? a.name,
    };
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/articles" className="text-sm text-muted-foreground hover:text-foreground">
          ← 記事一覧
        </Link>
        <h1 className="text-xl font-semibold">新規記事</h1>
      </div>
      <NewArticleForm accounts={options} />
    </div>
  );
}

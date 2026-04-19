import { notFound, redirect } from "next/navigation";
import { getArticleById } from "@/lib/articles/queries";
import { createServiceClient } from "@/lib/supabase/client";
import { ArticleEditor } from "./ArticleEditor";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();

  const supabase = createServiceClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("id, slug, name, account_personas(display_name)")
    .eq("id", article.account_id)
    .maybeSingle();
  if (!account) redirect("/articles");
  const persona: any = Array.isArray(account.account_personas) ? account.account_personas[0] : account.account_personas;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ArticleEditor
        article={article}
        accountOptions={[
          {
            id: account.id,
            slug: account.slug,
            displayName: persona?.display_name ?? account.name,
          },
        ]}
      />
    </div>
  );
}

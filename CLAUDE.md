@AGENTS.md

# threads-hub プロジェクトルール

## 本番URL（最重要）

```
https://urasan-threads-auto-hub.vercel.app/
```

Vercelデフォルトの `threads-hub-iota.vercel.app` や `threads-XXXX-akimi-studio.vercel.app` ではなく、**必ず上記ドメインをユーザーに案内すること**。

## デプロイ手順

```bash
# 1. ビルド・デプロイ
npx vercel --prod --yes --scope akimi-studio

# 2. 出力の Production URL（threads-XXXXXX-akimi-studio.vercel.app）を控えて alias 付け替え
npx vercel alias set threads-XXXXXX-akimi-studio.vercel.app urasan-threads-auto-hub.vercel.app --scope akimi-studio

# 3. 検証
curl -sI https://urasan-threads-auto-hub.vercel.app/login | grep HTTP  # 200 OK を確認
```

**`vercel --prod` だけでは `urasan-threads-auto-hub.vercel.app` のaliasは自動更新されない。** 手動で付け替えないと旧デプロイを指したままになる。過去にこのミスがあったため、デプロイ後は必ずalias付け替え＋curl検証までをワンセットにすること。

## 開発サーバー

- port: **3900**（`npm run dev` で起動、`next dev -p 3900 --experimental-https`）
- Claude Code の `preview_start` ツールは port 3000 を内部で触ろうとして本番PM2（threads-auto-agent）と衝突するため使えない
- 代替：bash で `npm run dev` を run_in_background で起動 → curl で検証

## Supabase

- プロジェクトID: `bllypchfvmovgokgjfsj`
- migration追加時は `supabase/migrations/NNN_xxx.sql` に配置し、Supabase Dashboard SQL Editor か Chrome操作ツールで本番DB適用
- Claude Code CLIからの直接適用は不可（DATABASE_URL未設定、supabase CLI未インストール）

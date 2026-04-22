import NoTrackController from "./NoTrackController";

export const dynamic = "force-static";

export const metadata = {
  title: "計測除外設定 | note-sub",
  robots: { index: false, follow: false },
};

export default function NoTrackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-white text-black">
      <div className="w-full max-w-xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs tracking-wider uppercase text-neutral-500">
            Admin tooling · note-sub.top
          </p>
          <h1 className="text-2xl font-semibold">このブラウザを計測から除外する</h1>
          <p className="text-sm text-neutral-600 leading-relaxed">
            管理者自身のアクセスがアナリティクス（PV・スクロール到達率・CTAクリック・ヒートマップ）
            に混ざると、数字が歪みます。このページでブラウザごとに「計測除外」を切り替えられます。
          </p>
        </header>

        <NoTrackController />

        <section className="space-y-3 text-sm text-neutral-600 leading-relaxed border-t pt-6">
          <p className="font-semibold text-neutral-900">動作の仕組み</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>このブラウザの <code className="text-xs bg-neutral-100 px-1 rounded">localStorage.noTrack</code> に 1 を保存します</li>
            <li>ArticleTracker は起動時に noTrack をチェックし、1 ならイベント送信を即 return します</li>
            <li>設定はブラウザ単位・ドメイン単位。別ブラウザ/シークレット/別デバイスでは改めて設定が必要です</li>
            <li>localStorage をクリアすると解除されます（「計測を有効に戻す」ボタンも用意）</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm text-neutral-600 leading-relaxed border-t pt-6">
          <p className="font-semibold text-neutral-900">即時切替URL（ブックマーク推奨）</p>
          <ul className="list-disc pl-5 space-y-1 font-mono text-xs break-all">
            <li>除外ON:  https://note-sub.top/no-track?set=1</li>
            <li>除外OFF: https://note-sub.top/no-track?set=0</li>
          </ul>
          <p className="text-xs">
            記事ページのURLに <code className="bg-neutral-100 px-1 rounded">?no-track=1</code> を付けて開いても同じ効果になります。
          </p>
        </section>
      </div>
    </main>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "運営者情報 | note-sub.top",
  description: "note-sub.top の運営者情報・お問い合わせ先",
};

export default function OperatorInfoPage() {
  return (
    <article className="legal-article">
      <h1>運営者情報</h1>
      <p className="legal-updated">最終更新日: 2026年4月20日</p>

      <section>
        <h2>本サイトの性質について</h2>
        <p>
          note-sub.top（以下「当サイト」）は、<strong>商品・サービスの直接販売を一切行っておりません</strong>。
          記事を通じて第三者が提供する商品・サービスを紹介し、紹介リンクからのお申込に対して成果報酬を受け取る
          アフィリエイトプログラムのみを収益源としています。
        </p>
        <p>
          そのため、特定商取引法に基づく販売者としての表記義務は負いません。
          ただし運営者情報の透明性のために、以下の情報を公開しています。
        </p>
      </section>

      <table className="legal-table">
        <tbody>
          <tr>
            <th>運営者</th>
            <td>note-sub.top 運営</td>
          </tr>
          <tr>
            <th>連絡先（メール）</th>
            <td>
              uranainote178@gmail.com<br />
              <span className="legal-sub">
                ※ お問い合わせはメールにて承ります。できる限り速やかに対応いたしますが、
                ご返信までに数日いただく場合があります。
              </span>
            </td>
          </tr>
          <tr>
            <th>所在地・電話番号</th>
            <td>
              メールでの対応を原則としており、通常公開しておりません。<br />
              <span className="legal-sub">
                ※ 法令に基づく開示請求があった場合は、遅滞なく開示いたします。
              </span>
            </td>
          </tr>
          <tr>
            <th>取扱い内容</th>
            <td>
              当サイトでの直接販売はありません。<br />
              記事を通じた第三者サービスの紹介（アフィリエイトプログラム）のみを行っています。<br />
              詳しくは<a href="/legal/advertising">広告表示について</a>をご確認ください。
            </td>
          </tr>
          <tr>
            <th>販売価格・支払・引渡</th>
            <td>当サイトでの販売行為がないため該当なし。紹介先の各サービスの規約に従います。</td>
          </tr>
          <tr>
            <th>返品・キャンセル</th>
            <td>当サイトでの販売行為がないため該当なし。紹介先の各サービスの規約に従います。</td>
          </tr>
        </tbody>
      </table>

      <section>
        <h2>関連ページ</h2>
        <ul>
          <li><a href="/legal/privacy">プライバシーポリシー</a></li>
          <li><a href="/legal/advertising">広告表示について</a></li>
        </ul>
      </section>
    </article>
  );
}

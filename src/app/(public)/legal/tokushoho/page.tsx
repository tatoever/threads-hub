import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | note-sub.top",
  description: "note-sub.top の運営者情報・お問い合わせ先",
};

export default function TokushohoPage() {
  return (
    <article className="legal-article">
      <h1>特定商取引法に基づく表記</h1>
      <p className="legal-updated">最終更新日: 2026年4月20日</p>

      <p className="legal-note">
        ※ 当サイトは商品の直接販売を行っていないため、特定商取引法の適用範囲外の項目もありますが、
        運営者情報の透明化のために本ページを公開しています。
      </p>

      <table className="legal-table">
        <tbody>
          <tr>
            <th>販売業者</th>
            <td>【個人運営】※ 開示請求があった場合は速やかに開示します</td>
          </tr>
          <tr>
            <th>運営責任者</th>
            <td>【運営者名を記載してください】</td>
          </tr>
          <tr>
            <th>所在地</th>
            <td>【所在地を記載してください。開示請求時に速やかに開示 と記載することも可】</td>
          </tr>
          <tr>
            <th>連絡先（メール）</th>
            <td>
              【メールアドレスを記載してください】<br />
              ※ お問い合わせは原則メールで承ります。
            </td>
          </tr>
          <tr>
            <th>連絡先（電話）</th>
            <td>
              ※ 電話対応は行っておりません。お問い合わせはメールにてお願いいたします。<br />
              ※ 請求があれば速やかに開示します。
            </td>
          </tr>
          <tr>
            <th>取扱商品・サービス</th>
            <td>
              当サイトでは、商品の直接販売は行っておりません。<br />
              掲載記事を通じて、第三者が提供する商品・サービスの紹介（アフィリエイトプログラム）を行っています。<br />
              詳しくは<a href="/legal/advertising">広告表示について</a>をご確認ください。
            </td>
          </tr>
          <tr>
            <th>販売価格</th>
            <td>当サイトでの直接販売はありません。紹介先の各サービスの販売ページで表示される価格が適用されます。</td>
          </tr>
          <tr>
            <th>支払方法・商品の引渡時期</th>
            <td>当サイトでの直接販売はありません。各紹介先の規約に従います。</td>
          </tr>
          <tr>
            <th>返品・キャンセル</th>
            <td>当サイトでの直接販売はありません。各紹介先の規約に従います。</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

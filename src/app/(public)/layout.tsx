import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./public.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-sans-jp",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://note-sub.top"),
  robots: {
    index: true,
    follow: true,
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${notoSansJp.variable} note-public-root`} data-public-theme="light">
      {children}
    </div>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KEISHA - 傾斜割り勘計算ツール | ログイン不要",
  description: "飲み会の傾斜割り勘をその場でサクッと計算。役職・学年・男女別の比率設定、遅刻・主役の個別調整、LINE共有まで完結。ログイン不要・完全無料。",
  keywords: "割り勘, 傾斜割り勘, 飲み会, 計算, 幹事",
  openGraph: {
    title: "KEISHA - 傾斜割り勘計算ツール",
    description: "飲み会の傾斜割り勘をその場でサクッと計算。ログイン不要・完全無料。",
    url: "https://keisha-warikan.com",
    siteName: "KEISHA",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "KEISHA - 傾斜割り勘計算ツール",
    description: "飲み会の傾斜割り勘をその場でサクッと計算。ログイン不要・完全無料。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
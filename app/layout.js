import "./globals.css";

export const metadata = {
  title: "공부하자 — 시험 공부 플래너",
  description: "시험일까지, 뭘 공부할지 더 이상 고민하지 마세요.",
  other: {
    "google-adsense-account": "ca-pub-3450079984401603",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3450079984401603"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

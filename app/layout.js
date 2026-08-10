import "./globals.css";
import "./content.css";

export const metadata = {
  metadataBase: new URL("https://ai-tast.pages.dev"),
  title: {
    default: "공부하자 — 시험 공부 플래너와 학습 가이드",
    template: "%s | 공부하자",
  },
  description: "시험일까지 남은 기간과 공부 범위를 바탕으로 실천 가능한 계획을 만들고, 검증된 학습법을 익히는 무료 공부 플래너입니다.",
  keywords: ["시험 공부 계획", "공부 플래너", "중학생 공부법", "고등학생 공부법", "복습 계획"],
  authors: [{ name: "공부하자 편집팀" }],
  creator: "공부하자",
  publisher: "공부하자",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "공부하자 — 시험 공부 플래너와 학습 가이드",
    description: "내 시험 범위와 일정에 맞는 공부 계획을 무료로 만들어보세요.",
    url: "/",
    siteName: "공부하자",
    locale: "ko_KR",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
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

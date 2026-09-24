import "./globals.css";
import "./content.css";
import AdPolicy from "./ad-policy";

export const metadata = {
  metadataBase: new URL("https://ai-tast.pages.dev"),
  title: {
    default: "시험플랜온 | 무료 시험 공부 계획표",
    template: "%s | 시험플랜온",
  },
  description: "시험일과 공부 범위를 입력하면 학습일과 복습일을 나누어 주는 무료 시험 공부 플래너입니다.",
  applicationName: "시험플랜온",
  twitter: {
    card: "summary",
    title: "시험플랜온 | 무료 시험 공부 계획표",
    description: "시험일과 공부 범위를 입력하면 학습일과 복습일을 나누어 주는 무료 시험 공부 플래너입니다.",
  },
  keywords: ["시험 공부 계획", "공부 플래너", "중학생 공부법", "고등학생 공부법", "복습 계획"],
  authors: [{ name: "시험플랜온 편집팀" }],
  creator: "시험플랜온",
  publisher: "시험플랜온",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "시험플랜온 | 무료 시험 공부 계획표",
    description: "시험일과 공부 범위를 입력하면 학습일과 복습일을 나누어 주는 무료 시험 공부 플래너입니다.",
    url: "/",
    siteName: "시험플랜온",
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
        <meta name="google-site-verification" content="rBqp4Tyy2fPAqzE2tK7i1tDEN-9YTNUW9pX3CHAemcc" />
      </head>
      <body><AdPolicy />{children}</body>
    </html>
  );
}

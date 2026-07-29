import Link from "next/link";
import { SiteFooter, SiteHeader } from "../site-chrome";

export const metadata = {
  title: "학습 가이드",
  description: "시험 계획 세우기, 기억에 남는 복습, 과목별 공부법을 실제 예시와 함께 안내합니다.",
  alternates: { canonical: "/guides" },
};

const guides = [
  { href: "/guides/exam-plan", label: "PLANNING", title: "시험 2주 전, 무너지지 않는 계획 세우기", copy: "범위 수집부터 우선순위, 복습일 배치와 밀린 일정 조정까지 단계별로 정리합니다." },
  { href: "/guides/review", label: "REVIEW", title: "읽기만 하지 않는 복습법", copy: "회상 연습, 간격 복습, 오답 기록을 일상 공부에 적용하는 방법을 설명합니다." },
  { href: "/guides/focus", label: "FOCUS", title: "집중 시간을 제대로 사용하는 법", copy: "25분·50분 집중 세션을 과목과 과제 성격에 맞게 선택하고 기록하는 방법입니다." },
];

export default function GuidesPage() {
  return (
    <main className="info-page">
      <SiteHeader />
      <section className="info-main">
        <header className="section-heading">
          <p className="eyebrow">ORIGINAL STUDY GUIDES</p>
          <h1>계획을 세운 다음,<br />어떻게 공부할까요?</h1>
          <p>공부하자 편집팀이 학생의 실제 시험 준비 과정에서 바로 적용할 수 있도록 작성한 학습 자료입니다. 짧은 요령보다 계획, 실행, 점검이 연결되는 방법을 다룹니다.</p>
        </header>
        <div className="guide-grid">
          {guides.map((guide) => (
            <Link className="guide-card" href={guide.href} key={guide.href}>
              <span>{guide.label}</span><h2>{guide.title}</h2><p>{guide.copy}</p>
            </Link>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

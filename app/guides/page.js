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
  { href: "/guides/active-recall", label: "MEMORY", title: "책을 덮고 떠올리는 회상 학습", copy: "읽은 내용을 스스로 꺼내며 기억의 빈틈을 찾는 연습을 과목별 예시로 안내합니다." },
  { href: "/guides/mistake-notes", label: "CORRECTION", title: "다시 틀리지 않는 오답 정리", copy: "정답을 베끼는 대신 틀린 이유와 다음 행동을 남기는 간단한 오답 기록법입니다." },
  { href: "/guides/subject-strategy", label: "SUBJECTS", title: "과목마다 다르게 공부하는 법", copy: "수학·국어·영어·사회·과학의 특성에 맞춰 학습 순서와 점검 질문을 제시합니다." },
  { href: "/guides/recovery", label: "RECOVERY", title: "밀린 계획을 현실적으로 복구하기", copy: "계획을 놓친 날 자책하거나 몰아 공부하지 않고 우선순위를 다시 정하는 방법입니다." },
  { href: "/guides/exam-day", label: "EXAM DAY", title: "시험 전날과 당일 체크리스트", copy: "새로운 공부를 줄이고 기억, 컨디션, 준비물을 안정적으로 점검하는 순서입니다." },
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

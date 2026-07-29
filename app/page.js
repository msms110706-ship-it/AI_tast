"use client";

import { useEffect, useMemo, useState } from "react";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6];

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function makePlan({ subject, examDate, range, days, minutes }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${examDate}T00:00:00`);
  const studyDates = [];

  for (let cursor = new Date(today); cursor < end; cursor = addDays(cursor, 1)) {
    if (days.includes(cursor.getDay())) studyDates.push(new Date(cursor));
  }

  if (!studyDates.length) return [];

  const rangeText = range.trim();
  const chunks = rangeText
    .split(/\n|,|→|~|–|-/)
    .map((item) => item.trim())
    .filter(Boolean);

  return studyDates.map((date, index) => {
    const progress = (index + 1) / studyDates.length;
    const isFinal = index === studyDates.length - 1;
    const isReview = !isFinal && studyDates.length >= 5 && (index + 1) % 4 === 0;
    let task;

    if (isFinal) {
      task = "전체 범위 최종 점검 · 오답 다시 보기";
    } else if (isReview) {
      task = "지금까지 공부한 범위 복습 · 취약점 보완";
    } else if (chunks.length > 1) {
      const chunkIndex = Math.min(
        chunks.length - 1,
        Math.floor(progress * chunks.length)
      );
      task = `${chunks[chunkIndex]} 집중 학습`;
    } else {
      const start = Math.floor((index / studyDates.length) * 100) + 1;
      const finish = Math.min(100, Math.floor(progress * 100));
      task = `${rangeText || "입력한 시험 범위"} 중 ${start}–${finish}% 학습`;
    }

    return {
      id: `${localDateString(date)}-${index}`,
      date: localDateString(date),
      label: `${date.getMonth() + 1}.${date.getDate()} ${DAY_NAMES[date.getDay()]}`,
      subject: subject.trim() || "시험 공부",
      task,
      minutes,
      done: false,
    };
  });
}

export default function Home() {
  const defaultExam = useMemo(() => localDateString(addDays(new Date(), 14)), []);
  const [subject, setSubject] = useState("한국사");
  const [examDate, setExamDate] = useState(defaultExam);
  const [range, setRange] = useState("조선 전기부터 근대 사회까지");
  const [minutes, setMinutes] = useState(60);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [plan, setPlan] = useState([]);
  const [view, setView] = useState("form");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("study-flow-plan");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPlan(parsed);
        if (parsed.length) setView("plan");
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (plan.length) localStorage.setItem("study-flow-plan", JSON.stringify(plan));
  }, [plan]);

  const createPlan = (event) => {
    event.preventDefault();
    const today = localDateString(new Date());
    if (!examDate || examDate <= today) {
      setError("시험 날짜는 내일 이후로 골라주세요.");
      return;
    }
    if (!range.trim()) {
      setError("공부할 범위를 입력해주세요.");
      return;
    }
    if (!days.length) {
      setError("공부 가능한 요일을 하나 이상 골라주세요.");
      return;
    }
    const nextPlan = makePlan({ subject, examDate, range, days, minutes });
    if (!nextPlan.length) {
      setError("시험 전 공부 가능한 날짜가 없어요. 요일을 다시 골라주세요.");
      return;
    }
    setError("");
    setPlan(nextPlan);
    setView("plan");
  };

  const toggleDay = (day) => {
    setDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort()
    );
  };

  const doneCount = plan.filter((item) => item.done).length;
  const progress = plan.length ? Math.round((doneCount / plan.length) * 100) : 0;

  return (
    <main>
      <nav className="nav">
        <button className="brand" onClick={() => setView("form")} aria-label="처음으로">
          공부<span>하자!</span>
        </button>
        <div className="nav-right">
          <span>오늘부터, 차근차근.</span>
          {plan.length > 0 && (
            <button className="ghost-button" onClick={() => setView(view === "form" ? "plan" : "form")}>
              {view === "form" ? "내 계획 보기" : "새 계획 만들기"}
            </button>
          )}
        </div>
      </nav>

      {view === "form" ? (
        <section className="planner-shell">
          <div className="intro">
            <p className="eyebrow">STUDY PLANNER · 01</p>
            <h1>시험 공부,<br /><em>막막하지 않게.</em></h1>
            <p className="description">
              시험일과 범위만 알려주세요.<br />
              남은 날에 딱 맞는 계획을 짜드릴게요.
            </p>
            <div className="promise">
              <span>✓</span>
              <p><strong>복습일까지 알아서</strong><br />무리 없는 분량으로 나눠요.</p>
            </div>
          </div>

          <form className="planner-card" onSubmit={createPlan}>
            <div className="card-heading">
              <span>나의 시험 정보</span>
              <span className="step">1 / 1</span>
            </div>

            <label>
              <span>과목명</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="예: 한국사" />
            </label>

            <label>
              <span>시험 날짜</span>
              <input type="date" min={localDateString(addDays(new Date(), 1))} value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </label>

            <label>
              <span>시험 범위</span>
              <textarea value={range} onChange={(e) => setRange(e.target.value)} placeholder="예: 교과서 2–5단원, 프린트 1–8장" rows="3" />
              <small>쉼표나 줄바꿈으로 단원을 나누면 더 구체적으로 배분해요.</small>
            </label>

            <div className="field">
              <span className="label-title">공부 가능한 요일</span>
              <div className="day-picker">
                {DAY_NAMES.map((name, index) => (
                  <button key={name} type="button" className={days.includes(index) ? "active" : ""} onClick={() => toggleDay(index)}>
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <label>
              <span className="slider-label"><b>하루 공부 시간</b><strong>{minutes}분</strong></span>
              <input className="range-input" type="range" min="20" max="180" step="10" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            </label>

            {error && <p className="error">{error}</p>}
            <button className="primary-button" type="submit">
              나만의 계획 만들기 <span>→</span>
            </button>
            <p className="privacy">입력한 정보는 이 기기에만 저장돼요.</p>
          </form>
        </section>
      ) : (
        <section className="result-shell">
          <header className="result-header">
            <div>
              <p className="eyebrow">MY STUDY PLAN</p>
              <h1><em>{plan[0]?.subject}</em>, 오늘부터 시작!</h1>
              <p>{plan.length}번의 공부로 시험 준비를 끝내요.</p>
            </div>
            <button className="primary-button compact" onClick={() => setView("form")}>계획 다시 짜기</button>
          </header>

          <div className="progress-card">
            <div className="progress-copy">
              <strong>{progress}%</strong>
              <span>{doneCount} / {plan.length} 완료</span>
            </div>
            <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
            <p>{progress === 100 ? "완주했어요! 시험 잘 보고 오세요 ✦" : "체크할 때마다 목표에 한 걸음 가까워져요."}</p>
          </div>

          <div className="plan-list">
            {plan.map((item, index) => (
              <article className={`plan-item ${item.done ? "done" : ""}`} key={item.id}>
                <button
                  className="check"
                  aria-label={`${item.label} 완료 표시`}
                  onClick={() => setPlan((current) => current.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry))}
                >
                  {item.done ? "✓" : index + 1}
                </button>
                <div className="date">{item.label}</div>
                <div className="task">
                  <strong>{item.task}</strong>
                  <span>{item.minutes}분 · 집중 학습</span>
                </div>
                <span className="status">{item.done ? "완료" : "예정"}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer>
        <span>공부하자!</span>
        <p>완벽한 계획보다, 오늘의 한 걸음.</p>
      </footer>
    </main>
  );
}

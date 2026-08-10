"use client";

import { useEffect, useMemo, useState } from "react";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6];
const DISQUS_URL = "https://ai-tast.pages.dev/";

function DisqusComments() {
  useEffect(() => {
    window.disqus_config = function () {
      this.page.url = DISQUS_URL;
      this.page.identifier = "gongbuhaja-community";
      this.page.title = "공부하자! 이야기 나눔";
    };

    if (window.DISQUS) {
      window.DISQUS.reset({
        reload: true,
        config: window.disqus_config,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://gongbuhaja.disqus.com/embed.js";
    script.setAttribute("data-timestamp", String(Date.now()));
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <section className="comments-shell" aria-labelledby="comments-title">
      <div className="comments-heading">
        <div>
          <p className="eyebrow">COMMUNITY · COMMENTS</p>
          <h2 id="comments-title">같이 이야기해요</h2>
        </div>
        <p>공부 팁과 응원을 자유롭게 남겨주세요.</p>
      </div>
      <div id="disqus_thread" />
      <noscript>
        댓글을 보려면 JavaScript를 활성화해주세요.{" "}
        <a href="https://disqus.com/?ref_noscript">Disqus 댓글 보기</a>
      </noscript>
    </section>
  );
}

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

function getStudyHelp(subject, range) {
  const text = `${subject} ${range}`.toLowerCase();

  if (text.includes("확률")) {
    return {
      title: "확률은 ‘경우의 수’부터",
      tip: "전체 경우가 모두 같은 가능성을 가질 때, 확률은 ‘원하는 경우의 수 ÷ 전체 경우의 수’예요. 문제를 읽자마자 분모가 될 전체 경우부터 적어보세요.",
      questions: [
        "주사위 한 개를 던질 때 3의 배수가 나올 확률은?",
        "동전 두 개를 동시에 던질 때 앞면이 정확히 하나 나올 확률은?",
        "1부터 10까지 중 하나를 고를 때 소수가 나올 확률은?"
      ]
    };
  }
  if (text.includes("수학")) {
    return {
      title: "답보다 풀이의 흐름을 남기기",
      tip: "틀린 문제는 정답만 고치지 말고 ‘어디에서 생각이 끊겼는지’를 한 줄로 적어두세요. 비슷한 문제를 다시 만났을 때 훨씬 빨리 알아챌 수 있어요.",
      questions: ["이 단원의 핵심 공식을 말로 설명할 수 있나요?", "가장 자주 틀리는 계산은 무엇인가요?", "오늘 푼 문제 중 하나를 풀이 없이 다시 풀 수 있나요?"]
    };
  }
  if (text.includes("영어")) {
    return {
      title: "읽고, 가리고, 말하기",
      tip: "단어나 문장을 눈으로만 반복하지 말고 뜻을 가린 뒤 소리 내어 떠올려 보세요. 기억에서 직접 꺼내는 연습이 오래 남습니다.",
      questions: ["오늘 배운 단어 5개로 문장을 만들 수 있나요?", "지문의 핵심 내용을 한 문장으로 말해보세요.", "헷갈린 문법을 예문으로 설명할 수 있나요?"]
    };
  }
  if (text.includes("역사") || text.includes("한국사")) {
    return {
      title: "사건을 앞뒤로 연결하기",
      tip: "연도만 외우기보다 ‘원인 → 사건 → 결과’를 화살표로 연결하세요. 인물과 제도도 이 흐름 안에 놓으면 암기가 쉬워져요.",
      questions: ["오늘 배운 사건의 원인은 무엇인가요?", "그 사건 이후 가장 크게 달라진 점은?", "비슷한 시기의 다른 사건과 연결할 수 있나요?"]
    };
  }
  if (text.includes("과학")) {
    return {
      title: "현상을 내 말로 설명하기",
      tip: "개념을 외운 뒤 책을 덮고 실제 현상에 빗대어 설명해 보세요. 그림을 직접 그려 보는 것도 효과적이에요.",
      questions: ["이 현상이 일어나는 순서를 설명할 수 있나요?", "조건 하나가 바뀌면 결과는 어떻게 될까요?", "오늘 개념을 보여주는 일상 속 사례는?"]
    };
  }
  return {
    title: "기억에서 꺼내는 공부",
    tip: "읽는 시간을 줄이고, 책을 덮은 채 방금 배운 내용을 종이에 적어보세요. 기억나지 않는 부분이 오늘 다시 볼 곳입니다.",
    questions: ["오늘 배운 핵심을 세 문장으로 요약하면?", "가장 헷갈리는 개념은 무엇인가요?", "시험에 나온다면 어떤 문제로 나올까요?"]
  };
}

function inferQuestionSubject(question, selectedSubject) {
  const text = question.toLowerCase();
  if (/(수학|공식|방정식|함수|확률|도형|각도|넓이|부피|기울기|제곱|근의 공식|피타고라스)/.test(text)) return "수학";
  if (/(역사|한국사|세계사|왕|대통령|장군|독립운동|전쟁|조선|고려|신라|백제|고구려|인물|업적)/.test(text)) return "역사";
  if (/(과학|물리|화학|생물|지구과학|원소|분자|세포|힘|에너지|전류|행성|광합성|유전)/.test(text)) return "과학";
  if (/(영어|문법|단어|동사|명사|형용사|시제|영작|해석)/.test(text)) return "영어";
  if (/(국어|문학|소설|시인|작가|문법|품사|주제|비유)/.test(text)) return "국어";
  return selectedSubject || "일반";
}

function getQuestionPlaceholder(selectedSubject) {
  const subjectText = selectedSubject.toLowerCase();
  if (subjectText.includes("수학") || subjectText.includes("확률")) return "예: 이차방정식의 근의 공식을 알려줘";
  if (subjectText.includes("역사") || subjectText.includes("한국사")) return "예: 세종대왕의 주요 업적은 무엇인가요?";
  if (subjectText.includes("과학")) return "예: 광합성은 어떤 원리로 일어나나요?";
  if (subjectText.includes("영어")) return "예: 현재완료와 과거시제의 차이는?";
  if (subjectText.includes("국어")) return "예: 직유법과 은유법의 차이는?";
  return `예: ${selectedSubject || "이 과목"}의 핵심 개념을 설명해줘`;
}

function getMathFormulaAnswer(question) {
  const text = question.replace(/\s+/g, "");
  const formulas = [
    {
      match: /피타고라스/,
      answer: "피타고라스 정리\n\n직각삼각형에서 빗변의 길이를 c, 나머지 두 변의 길이를 a, b라고 하면\n\n a² + b² = c²\n\n이 공식은 반드시 직각삼각형에서만 사용할 수 있어요. 예를 들어 두 직각변이 3과 4라면 c² = 3² + 4² = 25이므로 빗변 c는 5입니다.",
    },
    {
      match: /근의공식|이차방정식/,
      answer: "이차방정식의 근의 공식\n\nax² + bx + c = 0 (a ≠ 0)일 때\n\n x = (-b ± √(b² - 4ac)) / 2a\n\n여기서 b² - 4ac는 판별식입니다. 판별식이 양수면 서로 다른 두 실근, 0이면 중근, 음수면 실근이 없습니다.",
    },
    {
      match: /확률/,
      answer: "확률의 기본 공식\n\n각 결과가 일어날 가능성이 모두 같을 때\n\n 확률 = 원하는 경우의 수 ÷ 전체 경우의 수\n\n예를 들어 주사위에서 짝수가 나오는 경우는 2, 4, 6의 3가지이고 전체는 6가지이므로 확률은 3/6 = 1/2입니다.",
    },
    {
      match: /원의?넓이|원의?둘레|원주/,
      answer: "원의 공식\n\n반지름을 r이라고 하면\n\n 원의 넓이 = πr²\n 원의 둘레 = 2πr\n\n지름이 주어졌다면 먼저 2로 나누어 반지름을 구하세요. π는 보통 문제의 조건에 따라 3.14 또는 π 그대로 사용합니다.",
    },
    {
      match: /기울기|일차함수/,
      answer: "직선의 기울기 공식\n\n두 점 (x₁, y₁), (x₂, y₂)를 지나는 직선의 기울기 m은\n\n m = (y₂ - y₁) / (x₂ - x₁)\n\n일차함수 y = mx + b에서 m은 기울기, b는 y절편입니다. x₂와 x₁이 같으면 분모가 0이므로 기울기를 정할 수 없습니다.",
    },
    {
      match: /삼각형.*넓이|넓이.*삼각형/,
      answer: "삼각형의 넓이 공식\n\n 넓이 = 밑변 × 높이 ÷ 2\n\n높이는 밑변과 반드시 수직인 길이입니다. 삼각형 밖으로 높이를 연장해야 하는 경우도 있으니 수직 표시를 먼저 확인하세요.",
    },
    {
      match: /속력|속도|거리|시간/,
      answer: "거리·속력·시간 공식\n\n 거리 = 속력 × 시간\n 속력 = 거리 ÷ 시간\n 시간 = 거리 ÷ 속력\n\n계산 전에 km와 m, 시간과 분처럼 단위를 반드시 통일해야 합니다.",
    },
  ];
  return formulas.find((formula) => formula.match.test(text))?.answer || "";
}

async function getFallbackAnswer(question, selectedSubject) {
  const inferredSubject = inferQuestionSubject(question, selectedSubject);
  if (inferredSubject === "수학") {
    const formulaAnswer = getMathFormulaAnswer(question);
    if (formulaAnswer) return { answer: formulaAnswer, sources: [], subject: inferredSubject };
  }

  const searchQuery =
    question
      .replace(
        /(무엇인가요|무엇인가|뭔가요|뭐야|알려\s*줘|알려주세요|설명해\s*줘|설명해주세요|어떤\s*원리로|어떻게\s*일어나나요|의\s*주요\s*업적|주요\s*업적|핵심\s*개념|에\s*대해|\?)/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim() || question;

  const endpoint = new URL("https://ko.wikipedia.org/w/api.php");
  endpoint.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: searchQuery,
    gsrlimit: "3",
    prop: "extracts|info",
    exintro: "1",
    explaintext: "1",
    inprop: "url",
    format: "json",
    origin: "*",
  });

  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("인터넷 자료를 가져오지 못했어요.");
  const data = await response.json();
  const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  if (!pages.length) throw new Error("질문과 관련된 자료를 찾지 못했어요. 핵심 낱말을 넣어 다시 질문해주세요.");

  const answer = pages
    .slice(0, 2)
    .map((page) => `${page.title}\n${(page.extract || "관련 문서를 확인해보세요.").slice(0, 650)}`)
    .join("\n\n");

  return {
    answer: `질문과 가장 관련 있는 인터넷 자료를 정리했어요.\n\n${answer}`,
    sources: pages.map((page) => ({ title: page.title, url: page.fullurl })).filter((source) => source.url),
    subject: inferredSubject,
  };
}

function formatTimer(seconds) {
  const minute = String(Math.floor(seconds / 60)).padStart(2, "0");
  const second = String(seconds % 60).padStart(2, "0");
  return `${minute}:${second}`;
}

export default function Home() {
  const defaultExam = useMemo(() => localDateString(addDays(new Date(), 14)), []);
  const [user, setUser] = useState(null);
  const [loginName, setLoginName] = useState("");
  const [grade, setGrade] = useState("중2");
  const [subject, setSubject] = useState("한국사");
  const [examDate, setExamDate] = useState(defaultExam);
  const [range, setRange] = useState("조선 전기부터 근대 사회까지");
  const [minutes, setMinutes] = useState(60);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [plan, setPlan] = useState([]);
  const [plans, setPlans] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [view, setView] = useState("form");
  const [error, setError] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState(25);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [answerStatus, setAnswerStatus] = useState("idle");
  const [sharedPlans, setSharedPlans] = useState([]);
  const [communityGrade, setCommunityGrade] = useState("전체");
  const [contactStatus, setContactStatus] = useState("idle");
  const [contactMessage, setContactMessage] = useState("");

  useEffect(() => {
    const savedUser = localStorage.getItem("study-flow-user");
    if (savedUser) setUser(JSON.parse(savedUser));
    const shared = localStorage.getItem("study-flow-shared");
    if (shared) setSharedPlans(JSON.parse(shared));
  }, []);

  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem(`study-flow-plans-${user.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPlans(parsed);
        if (parsed.length) {
          const latest = parsed[0];
          setPlan(latest.items);
          setCurrentPlanId(latest.id);
          setSubject(latest.subject);
          setRange(latest.range);
          setExamDate(latest.examDate);
          setView("plan");
        }
      } catch {}
    } else {
      const legacy = localStorage.getItem("study-flow-plan");
      if (legacy) {
        try {
          const items = JSON.parse(legacy);
          if (items.length) {
            const migrated = { id: `plan-${Date.now()}`, name: "계획 1", subject: items[0]?.subject || "시험 공부", range: "이전에 저장한 범위", examDate: "", createdAt: new Date().toISOString(), items };
            setPlans([migrated]);
            setPlan(items);
            setCurrentPlanId(migrated.id);
            setView("plan");
          }
        } catch {}
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const key = `study-flow-plans-${user.id}`;
    if (plans.length) localStorage.setItem(key, JSON.stringify(plans));
    else localStorage.removeItem(key);
  }, [plans, user]);

  useEffect(() => {
    if (!currentPlanId || !plan.length) return;
    setPlans((current) => current.map((savedPlan) => savedPlan.id === currentPlanId ? { ...savedPlan, items: plan } : savedPlan));
  }, [plan, currentPlanId]);

  useEffect(() => {
    if (!timerRunning) return;
    const timer = setInterval(() => {
      setTimerSeconds((seconds) => {
        if (seconds <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timerRunning]);

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
    const id = `plan-${Date.now()}`;
    const savedPlan = {
      id,
      name: `계획 ${plans.length + 1}`,
      grade,
      subject: subject.trim() || "시험 공부",
      range: range.trim(),
      examDate,
      createdAt: new Date().toISOString(),
      items: nextPlan,
    };
    setPlan(nextPlan);
    setPlans((current) => [savedPlan, ...current]);
    setCurrentPlanId(id);
    setView("plan");
  };

  const openPlan = (savedPlan) => {
    setCurrentPlanId(savedPlan.id);
    setPlan(savedPlan.items);
    setSubject(savedPlan.subject);
    setRange(savedPlan.range);
    setExamDate(savedPlan.examDate);
    setView("plan");
  };

  const deletePlan = (id) => {
    if (!window.confirm("이 계획을 보관함에서 삭제할까요?")) return;
    const next = plans.filter((savedPlan) => savedPlan.id !== id);
    setPlans(next);
    if (currentPlanId === id) {
      if (next.length) openPlan(next[0]);
      else {
        setPlan([]);
        setCurrentPlanId(null);
        setView("form");
      }
    }
  };

  const changeTimer = (value) => {
    setTimerMode(value);
    setTimerSeconds(value * 60);
    setTimerRunning(false);
  };

  const login = (event) => {
    event.preventDefault();
    if (!loginName.trim()) return;
    const nextUser = { id: loginName.trim().toLowerCase().replace(/\s+/g, "-"), name: loginName.trim(), grade };
    localStorage.setItem("study-flow-user", JSON.stringify(nextUser));
    setUser(nextUser);
    setPlans([]);
  };

  const logout = () => {
    localStorage.removeItem("study-flow-user");
    setUser(null);
    setPlans([]);
    setPlan([]);
    setView("form");
  };

  const askCoach = async (event) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || answerStatus === "loading") return;

    setAnswerStatus("loading");
    setAnswer(null);

    try {
      const selectedSubject = activePlan?.subject || subject;
      let result;

      try {
        const response = await fetch("/api/coach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: trimmedQuestion,
            subject: selectedSubject,
            range: activePlan?.range || range,
            grade: activePlan?.grade || user?.grade || grade,
          }),
        });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) throw new Error("API_UNAVAILABLE");
        const apiResult = await response.json();
        if (!response.ok) throw new Error(apiResult.error || "API_UNAVAILABLE");
        result = { ...apiResult, subject: apiResult.subject || inferQuestionSubject(trimmedQuestion, selectedSubject) };
      } catch {
        result = await getFallbackAnswer(trimmedQuestion, selectedSubject);
      }

      setAnswer(result);
      setAnswerStatus("success");
    } catch (requestError) {
      setAnswer({
        answer: requestError.message || "잠시 후 다시 질문해주세요.",
        sources: [],
      });
      setAnswerStatus("error");
    }
  };

  const shareCurrentPlan = () => {
    if (!activePlan || sharedPlans.some((item) => item.sourceId === activePlan.id && item.author === user.name)) return;
    const shared = { ...activePlan, id: `shared-${Date.now()}`, sourceId: activePlan.id, author: user.name, grade: activePlan.grade || user.grade, likes: 0 };
    const next = [shared, ...sharedPlans];
    setSharedPlans(next);
    localStorage.setItem("study-flow-shared", JSON.stringify(next));
  };

  const copySharedPlan = (shared) => {
    const copied = { ...shared, id: `plan-${Date.now()}`, name: `계획 ${plans.length + 1}`, createdAt: new Date().toISOString(), items: shared.items.map((item, index) => ({ ...item, id: `${Date.now()}-${index}`, done: false })) };
    setPlans((current) => [copied, ...current]);
    openPlan(copied);
  };

  const toggleDay = (day) => {
    setDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort()
    );
  };

  const submitContact = async (event) => {
    event.preventDefault();
    setContactStatus("sending");
    setContactMessage("");

    try {
      const response = await fetch("https://formspree.io/f/xbdnbrka", {
        method: "POST",
        body: new FormData(event.currentTarget),
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error("Formspree request failed");
      event.currentTarget.reset();
      setContactStatus("success");
      setContactMessage("문의가 잘 접수됐어요. 확인 후 입력하신 이메일로 연락드릴게요.");
    } catch {
      setContactStatus("error");
      setContactMessage("전송에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  const doneCount = plan.filter((item) => item.done).length;
  const progress = plan.length ? Math.round((doneCount / plan.length) * 100) : 0;
  const activePlan = plans.find((savedPlan) => savedPlan.id === currentPlanId);
  const studyHelp = getStudyHelp(activePlan?.subject || subject, activePlan?.range || range);
  const communityPlans = [
    { id: "sample-1", name: "7일 완성 계획", grade: "중2", subject: "수학", range: "경우의 수와 확률", author: "공부별", likes: 18, items: makePlan({ subject: "수학", examDate: defaultExam, range: "경우의 수, 확률의 뜻, 확률 계산", days: DEFAULT_DAYS, minutes: 40 }) },
    { id: "sample-2", name: "개념부터 차근차근", grade: "중3", subject: "과학", range: "생식과 유전", author: "차근이", likes: 12, items: makePlan({ subject: "과학", examDate: defaultExam, range: "세포 분열, 생식, 유전", days: DEFAULT_DAYS, minutes: 50 }) },
    { id: "sample-3", name: "시험 전 핵심 복습", grade: "고1", subject: "영어", range: "교과서 3–4과", author: "영단어왕", likes: 25, items: makePlan({ subject: "영어", examDate: defaultExam, range: "3과 본문, 3과 문법, 4과 본문, 4과 문법", days: DEFAULT_DAYS, minutes: 60 }) },
    ...sharedPlans,
  ].filter((item) => communityGrade === "전체" || item.grade === communityGrade);

  const contactPage = (
    <section className="contact-shell">
      <div className="contact-copy">
        <button className="back-link" type="button" onClick={() => setView(user ? "form" : "form")}>← 돌아가기</button>
        <p className="eyebrow">PARTNERSHIP · CONTACT</p>
        <h1>함께 만들<br />공부의 <em>다음.</em></h1>
        <p className="description">
          공부하자!와 함께할 아이디어가 있나요?<br />
          제휴, 콘텐츠, 교육기관 협업 제안을 기다립니다.
        </p>
        <div className="contact-note">
          <span>01</span>
          <p><strong>영업일 기준 2–3일 이내</strong><br />담당자가 이메일로 답변드려요.</p>
        </div>
      </div>

      <form className="planner-card contact-form" onSubmit={submitContact}>
        <div className="card-heading">
          <span>제휴 문의</span>
          <span className="step">LET&apos;S TALK</span>
        </div>
        <div className="contact-row">
          <label>
            <span>회사·기관명</span>
            <input name="company" placeholder="예: 공부교육" required />
          </label>
          <label>
            <span>담당자명</span>
            <input name="name" placeholder="홍길동" required />
          </label>
        </div>
        <label>
          <span>회신 이메일</span>
          <input type="email" name="email" placeholder="hello@company.com" required />
        </label>
        <label>
          <span>제휴 유형</span>
          <select name="partnership_type" defaultValue="" required>
            <option value="" disabled>제휴 유형을 선택해주세요</option>
            <option value="교육기관 제휴">교육기관 제휴</option>
            <option value="콘텐츠 협업">콘텐츠 협업</option>
            <option value="브랜드·마케팅">브랜드·마케팅</option>
            <option value="기술·서비스 연동">기술·서비스 연동</option>
            <option value="기타">기타</option>
          </select>
        </label>
        <label>
          <span>문의 내용</span>
          <textarea name="message" rows="6" placeholder="제안 배경과 함께하고 싶은 내용을 간단히 적어주세요." required />
        </label>
        <label className="consent-field">
          <input type="checkbox" name="privacy_consent" value="동의" required />
          <span>문의 답변을 위한 개인정보 수집·이용에 동의합니다.</span>
        </label>
        <input type="hidden" name="_subject" value="[공부하자!] 새로운 제휴 문의" />
        {contactMessage && <p className={`form-status ${contactStatus}`} role="status">{contactMessage}</p>}
        <button className="primary-button" type="submit" disabled={contactStatus === "sending"}>
          {contactStatus === "sending" ? "보내는 중..." : "문의 보내기"} <span>→</span>
        </button>
        <p className="privacy">입력하신 정보는 문의 답변 목적으로만 사용됩니다.</p>
      </form>
    </section>
  );

  if (!user && view !== "contact") {
    return (
      <main className="public-home">
        <nav className="public-nav" aria-label="주요 메뉴">
          <a className="brand" href="/">공부<span>하자!</span></a>
          <div>
            <a href="#planner-start">플래너 시작</a>
            <a href="/guides">학습 가이드</a>
            <a href="/about">서비스 소개</a>
          </div>
        </nav>

        <section className="auth-page" id="planner-start">
          <div className="auth-copy">
            <p className="eyebrow">FREE STUDY PLANNER</p>
            <h1>시험 공부를<br /><em>실행 가능한 계획으로.</em></h1>
            <p>시험일, 범위, 가능한 요일을 입력하면 남은 기간에 맞춰 학습과 복습 일정을 나눠드립니다. 가입 없이 이 기기에서 무료로 사용할 수 있어요.</p>
            <ul className="hero-points">
              <li>시험 전 마지막 날은 전체 복습으로 자동 배정</li>
              <li>학습 가능 요일과 하루 공부 시간을 직접 설정</li>
              <li>계획과 완료 기록은 브라우저에만 저장</li>
            </ul>
          </div>
          <form className="auth-card" onSubmit={login}>
            <div className="card-heading"><span>무료 플래너 시작하기</span><span className="step">LOCAL</span></div>
            <label><span>이름 또는 별명</span><input value={loginName} onChange={(event) => setLoginName(event.target.value)} placeholder="예: 확률마스터" autoFocus /></label>
            <label><span>현재 학년</span><select value={grade} onChange={(event) => setGrade(event.target.value)}>{["초4","초5","초6","중1","중2","중3","고1","고2","고3"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="primary-button" type="submit">내 공부방 들어가기 <span>→</span></button>
            <p className="privacy">비밀번호나 실명을 요구하지 않습니다.</p>
          </form>
        </section>

        <section className="public-section" aria-labelledby="method-title">
          <div className="section-heading">
            <p className="eyebrow">HOW IT WORKS</p>
            <h2 id="method-title">계획이 실제 공부로 이어지도록</h2>
            <p>많은 계획이 실패하는 이유는 의지가 부족해서가 아니라, 해야 할 일이 너무 크고 모호하기 때문입니다. 공부하자는 범위와 시간을 작은 행동 단위로 바꾸는 데 집중합니다.</p>
          </div>
          <div className="method-grid">
            <article><b>01</b><h3>범위를 나눕니다</h3><p>단원이나 교재 범위를 쉼표로 구분하면 공부 가능한 날짜에 순서대로 배분합니다. 무엇을 펼쳐야 할지 고민하는 시간을 줄일 수 있습니다.</p></article>
            <article><b>02</b><h3>복습을 끼워 넣습니다</h3><p>공부일이 충분하면 네 번째 학습마다 복습일을 만들고, 시험 전 마지막 공부일에는 전체 범위와 오답을 점검합니다.</p></article>
            <article><b>03</b><h3>완료를 기록합니다</h3><p>공부한 일정에 체크하며 진행률을 확인합니다. 계획을 놓친 날에는 실패로 판단하기보다 남은 일정의 분량을 현실적으로 다시 조정하세요.</p></article>
          </div>
        </section>

        <section className="public-section evidence-section" aria-labelledby="principles-title">
          <div className="section-heading">
            <p className="eyebrow">STUDY PRINCIPLES</p>
            <h2 id="principles-title">계획표와 함께 써야 효과적인 3가지 원칙</h2>
          </div>
          <div className="principle-list">
            <article><h3>읽은 뒤 책을 덮고 떠올리기</h3><p>같은 내용을 반복해서 읽는 것보다, 방금 배운 내용을 보지 않고 설명하거나 적어보세요. 기억나지 않는 부분을 발견하는 과정 자체가 다음 복습 범위를 정해줍니다.</p></article>
            <article><h3>복습 간격을 조금씩 늘리기</h3><p>한 번에 오래 외우기보다 학습 당일, 며칠 뒤, 시험 전에 다시 확인하세요. 매번 모든 내용을 읽지 말고 틀린 문제와 헷갈린 개념을 우선하면 시간을 아낄 수 있습니다.</p></article>
            <article><h3>시간보다 결과를 구체적으로 적기</h3><p>‘수학 1시간’ 대신 ‘연립방정식 개념 확인 후 유형 문제 10개’처럼 끝났는지 판단할 수 있는 목표를 사용하세요. 집중 시간은 목표를 돕는 도구이지 목표 자체가 아닙니다.</p></article>
          </div>
          <a className="text-link" href="/guides">과목별 학습 가이드 모두 보기 →</a>
        </section>

        <section className="public-section faq-section" aria-labelledby="faq-title">
          <div className="section-heading"><p className="eyebrow">FAQ</p><h2 id="faq-title">자주 묻는 질문</h2></div>
          <div className="faq-grid">
            <details><summary>계획은 서버에 저장되나요?</summary><p>아니요. 현재 버전은 별명, 계획, 완료 기록을 사용 중인 브라우저의 로컬 저장소에만 보관합니다. 브라우저 데이터를 삭제하거나 다른 기기를 사용하면 기록이 이어지지 않습니다.</p></details>
            <details><summary>만든 계획을 그대로 따라야 하나요?</summary><p>아닙니다. 학교 일정이나 이해도에 따라 분량을 바꾸는 것이 좋습니다. 하루를 놓쳤다면 다음 날에 전부 몰아넣기보다 중요도가 낮은 내용을 줄이고 복습일을 지키세요.</p></details>
            <details><summary>학습 코치 답변은 항상 정확한가요?</summary><p>학습 코치는 이해를 돕는 보조 기능입니다. 중요한 시험 정보와 교과 내용은 학교 교재와 담당 교사의 안내를 우선하고, 인터넷 출처가 표시된 경우 원문도 함께 확인하세요.</p></details>
            <details><summary>누가 이용할 수 있나요?</summary><p>초등학교 고학년부터 고등학생까지 사용할 수 있도록 만들었습니다. 학년은 계획을 구분하기 위한 항목이며, 누구나 무료로 플래너와 공개 학습 자료를 이용할 수 있습니다.</p></details>
          </div>
        </section>

        <footer className="public-footer">
          <div><a className="brand" href="/">공부<span>하자!</span></a><p>학생이 오늘 할 일을 분명하게 만드는 무료 시험 공부 도구</p></div>
          <nav aria-label="사이트 정보">
            <a href="/about">소개</a><a href="/guides">학습 가이드</a><a href="/privacy">개인정보처리방침</a><a href="/terms">이용약관</a>
            <button type="button" onClick={() => setView("contact")}>문의</button>
          </nav>
          <p>© 2026 공부하자. All rights reserved.</p>
        </footer>
      </main>
    );
  }

  if (!user && view === "contact") {
    return <main>{contactPage}</main>;
  }

  return (
    <main>
      <nav className="nav">
        <button className="brand" onClick={() => setView("form")} aria-label="처음으로">
          공부<span>하자!</span>
        </button>
        <div className="nav-right">
          <button className="user-badge" onClick={logout}>{user.grade} · {user.name} <small>로그아웃</small></button>
          <button className="nav-link" onClick={() => setView("community")}>계획 둘러보기</button>
          <button className="nav-link contact-nav" onClick={() => setView("contact")}>제휴 문의</button>
          <button className="nav-link" onClick={() => setView("library")}>
            계획 보관함 <b>{plans.length}</b>
          </button>
          <button className="ghost-button" onClick={() => setView("form")}>+ 새 계획</button>
        </div>
      </nav>

      {view === "contact" ? contactPage : view === "form" ? (
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
              <span>대상 학년</span>
              <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                {["초4","초5","초6","중1","중2","중3","고1","고2","고3"].map((item) => <option key={item}>{item}</option>)}
              </select>
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
      ) : view === "community" ? (
        <section className="library-shell">
          <header className="library-header">
            <div><p className="eyebrow">STUDY COMMUNITY</p><h1>계획 둘러보기</h1><p>같은 학년·단원을 공부한 친구의 계획을 내 보관함에 담아보세요.</p></div>
            <div className="community-filter">
              <span>학년 필터</span>
              <select value={communityGrade} onChange={(event) => setCommunityGrade(event.target.value)}>
                {["전체","초4","초5","초6","중1","중2","중3","고1","고2","고3"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </header>
          <div className="community-notice">현재는 이 브라우저 안에서 작동하는 체험 커뮤니티예요. 실제 다중 사용자 공유는 서버 연결 후 사용할 수 있어요.</div>
          <div className="library-grid">
            {communityPlans.map((shared) => (
              <article className="library-card community-card" key={shared.id}>
                <div className="library-number">♡ {shared.likes || 0}</div>
                <span className="subject-chip">{shared.grade} · {shared.subject}</span>
                <h2>{shared.range}</h2>
                <p>by {shared.author} · {shared.name} · 총 {shared.items.length}회</p>
                <div className="community-preview">“하루씩 따라가며 완료 체크할 수 있어요.”</div>
                <div className="library-actions"><button onClick={() => copySharedPlan(shared)}>이 계획 따라하기 <span>→</span></button></div>
              </article>
            ))}
          </div>
        </section>
      ) : view === "library" ? (
        <section className="library-shell">
          <header className="library-header">
            <div>
              <p className="eyebrow">PLAN ARCHIVE</p>
              <h1>나의 계획 보관함</h1>
              <p>만들었던 계획을 언제든 다시 열어 이어서 공부하세요.</p>
            </div>
            <button className="primary-button compact" onClick={() => setView("form")}>+ 새 계획 만들기</button>
          </header>

          {plans.length ? (
            <div className="library-grid">
              {plans.map((savedPlan) => {
                const completed = savedPlan.items.filter((item) => item.done).length;
                const savedProgress = Math.round((completed / savedPlan.items.length) * 100);
                return (
                  <article className="library-card" key={savedPlan.id}>
                    <div className="library-number">{savedPlan.name}</div>
                    <span className="subject-chip">{savedPlan.subject}</span>
                    <h2>{savedPlan.range}</h2>
                    <p>시험일 {savedPlan.examDate || "날짜 정보 없음"} · 총 {savedPlan.items.length}회</p>
                    <div className="mini-progress"><i style={{ width: `${savedProgress}%` }} /></div>
                    <div className="library-meta"><strong>{savedProgress}% 완료</strong><span>{completed}/{savedPlan.items.length}</span></div>
                    <div className="library-actions">
                      <button onClick={() => openPlan(savedPlan)}>계획 열기 <span>→</span></button>
                      <button className="delete-button" onClick={() => deletePlan(savedPlan.id)}>삭제</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-library">
              <span>✦</span>
              <h2>아직 저장한 계획이 없어요.</h2>
              <p>첫 계획을 만들면 이곳에 자동으로 보관됩니다.</p>
              <button className="primary-button compact" onClick={() => setView("form")}>첫 계획 만들기</button>
            </div>
          )}
        </section>
      ) : (
        <section className="result-shell">
          <header className="result-header">
            <div>
              <p className="eyebrow">MY STUDY PLAN · {activePlan?.name || "현재 계획"}</p>
              <h1><em>{plan[0]?.subject}</em>, 오늘부터 시작!</h1>
              <p>{plan.length}번의 공부로 시험 준비를 끝내요.</p>
            </div>
            <div className="result-actions">
              <button className="ghost-button" onClick={shareCurrentPlan}>커뮤니티에 공유</button>
              <button className="primary-button compact" onClick={() => setView("library")}>보관함 보기</button>
            </div>
          </header>

          <div className="progress-card">
            <div className="progress-copy">
              <strong>{progress}%</strong>
              <span>{doneCount} / {plan.length} 완료</span>
            </div>
            <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
            <p>{progress === 100 ? "완주했어요! 시험 잘 보고 오세요 ✦" : "체크할 때마다 목표에 한 걸음 가까워져요."}</p>
          </div>

          <div className="study-tools">
            <article className="timer-card">
              <div className="tool-heading">
                <div><span>FOCUS TIMER</span><h2>지금, 딱 집중하기</h2></div>
                <i className={timerRunning ? "pulse active" : "pulse"} />
              </div>
              <div className="timer-modes">
                {[25, 50, 10].map((value) => (
                  <button className={timerMode === value ? "active" : ""} key={value} onClick={() => changeTimer(value)}>
                    {value === 10 ? "휴식 10분" : `집중 ${value}분`}
                  </button>
                ))}
              </div>
              <div className="timer-display">{formatTimer(timerSeconds)}</div>
              <div className="timer-actions">
                <button className="timer-main" onClick={() => timerSeconds > 0 && setTimerRunning((running) => !running)}>
                  {timerRunning ? "잠시 멈춤" : timerSeconds === 0 ? "시간 종료" : "시작하기"}
                </button>
                <button onClick={() => changeTimer(timerMode)}>초기화</button>
              </div>
            </article>

            <article className="help-card">
              <div className="tool-heading">
                <div><span>STUDY COACH</span><h2>{studyHelp.title}</h2></div>
                <b>TIP</b>
              </div>
              <p className="tip-copy">{studyHelp.tip}</p>
              <div className="question-box">
                <span>오늘의 셀프 질문</span>
                <strong>{studyHelp.questions[questionIndex % studyHelp.questions.length]}</strong>
              </div>
              <button className="question-button" onClick={() => setQuestionIndex((index) => index + 1)}>다른 질문 받기 ↻</button>
              <form className="ask-form" onSubmit={askCoach}>
                <label>
                  <span>{activePlan?.subject || subject}에 대해 질문하기</span>
                  <input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder={getQuestionPlaceholder(activePlan?.subject || subject)}
                    maxLength={1000}
                  />
                </label>
                <button type="submit" disabled={answerStatus === "loading"}>
                  {answerStatus === "loading" ? "찾는 중…" : "답변 받기"}
                </button>
              </form>
              {answer && (
                <div className={`coach-answer ${answerStatus === "error" ? "error" : ""}`}>
                  <b>{answerStatus === "error" ? "자료를 찾지 못했어요" : `${answer.subject || activePlan?.subject || subject} 코치의 답변`}</b>
                  <p>{answer.answer}</p>
                  {answer.sources?.length > 0 && (
                    <div className="answer-sources">
                      <span>인터넷 출처</span>
                      {answer.sources.map((source, index) => (
                        <a href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${index}`}>
                          {source.title || source.url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          </div>

          <div className="list-heading">
            <div><span>CHECKLIST</span><h2>공부 일정</h2></div>
            <p>완료한 날을 체크해 보세요.</p>
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

      <DisqusComments />

      <footer>
        <span>공부하자!</span>
        <button type="button" onClick={() => setView("contact")}>제휴 문의</button>
        <p>완벽한 계획보다, 오늘의 한 걸음.</p>
      </footer>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6];
const DISQUS_URL = "https://ai-tast.pages.dev/";
const MUSIC_PLAYLISTS = [
  {
    id: "streambeats-lofi",
    label: "INSTRUMENTAL · 무가사",
    title: "StreamBeats - Lofi",
    description: "말소리 없이 잔잔한 비트가 이어지는 집중용 플레이리스트예요. 독서, 암기, 문제 풀이처럼 긴 공부에 잘 어울려요.",
    duration: "10시간 이상",
    provider: "Spotify",
    embedUrl: "https://open.spotify.com/embed/playlist/4kAqBBEZQsBIXMIJl6u8tO?utm_source=generator&theme=0",
    playlistUrl: "https://open.spotify.com/playlist/4kAqBBEZQsBIXMIJl6u8tO",
    policyUrl: "https://www.streambeats.com/",
    policyLabel: "StreamBeats 공식 안내",
  },
  {
    id: "ncs-vocal",
    label: "VOCAL · 가사 있음",
    title: "NCS Releases",
    description: "보컬과 가사가 포함된 곡을 섞어 듣고 싶을 때 고르는 긴 재생목록이에요. 단순 암기보다 가벼운 정리 시간에 추천해요.",
    duration: "10시간 이상",
    provider: "Spotify",
    embedUrl: "https://open.spotify.com/embed/playlist/7sZbq8QGyMnhKPcLJvCUFD?utm_source=generator&theme=0",
    playlistUrl: "https://open.spotify.com/playlist/7sZbq8QGyMnhKPcLJvCUFD",
    policyUrl: "https://ncs.io/usage-policy",
    policyLabel: "NCS 이용 정책",
  },
];

function getPlaylistEmbed(rawUrl) {
  try {
    const originalUrl = rawUrl.trim();
    const url = new URL(originalUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (url.protocol !== "https:") return null;

    if (host === "open.spotify.com") {
      const match = url.pathname.match(/^\/(?:intl-[a-zA-Z-]+\/)?(playlist|album|track)\/([a-zA-Z0-9]+)\/?$/);
      if (!match) return null;
      return {
        provider: "Spotify",
        url: originalUrl,
        linkKey: `spotify:${match[1]}:${match[2]}`,
        embedUrl: `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`,
      };
    }

    if (host === "spotify.link") {
      const shortId = url.pathname.split("/").filter(Boolean)[0];
      if (!shortId || !/^[a-zA-Z0-9]+$/.test(shortId)) return null;
      return {
        provider: "Spotify",
        url: originalUrl,
        linkKey: `spotify:short:${shortId}`,
        embedUrl: null,
      };
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
      const listId = url.searchParams.get("list");
      const watchId = host === "youtu.be"
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([a-zA-Z0-9_-]+)/)?.[1];
      if (listId && !/^[a-zA-Z0-9_-]+$/.test(listId)) return null;
      if (watchId && !/^[a-zA-Z0-9_-]+$/.test(watchId)) return null;
      if (!listId && !watchId) return null;
      return {
        provider: "YouTube",
        url: originalUrl,
        linkKey: listId ? `youtube:list:${listId}` : `youtube:video:${watchId}`,
        embedUrl: null,
        listId: listId || null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function getPlanShareKey(savedPlan) {
  return savedPlan?.shareKey || savedPlan?.sourceId || savedPlan?.id || "";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function apiMessage(result, fallback) {
  return typeof result?.error === "string" ? result.error : result?.error?.message || fallback;
}

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

const MODERN_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,64}$/;
const LEGACY_PIN = /^\d{6,8}$/;

function getSubjectPlanStrategy(subject) {
  const text = subject.toLowerCase();
  if (/수학|수리|확률|기하/.test(text)) return { learn: (part) => `${part}: 핵심 개념·공식의 조건 확인 → 대표 유형 문제 풀이`, recall: "풀이를 가리고 대표 문제 다시 풀기 → 막힌 지점 한 줄 기록", guide: "수학은 개념 뒤에 반드시 풀이를 붙이고, 답보다 풀이가 끊긴 지점을 확인해요." };
  if (/영어/.test(text)) return { learn: (part) => `${part}: 핵심 단어 회상 → 문단별 한 줄 요약 → 문법 예문 만들기`, recall: "뜻과 본문을 가리고 말하기 → 틀린 단어·문장만 다시 쓰기", guide: "영어는 단어를 문장 속에서 말하고 쓰며, 긴 글은 문단별 핵심을 요약해요." };
  if (/국어|문학|독서/.test(text)) return { learn: (part) => `${part}: 지문 읽기 → 문단 핵심 요약 → 선택지 근거 표시`, recall: "글을 덮고 주제·근거 설명하기 → 틀린 선택지의 판단 근거 고치기", guide: "국어는 답만 고르지 않고 선택지의 판단 근거를 지문에서 찾아요." };
  if (/역사|한국사|사회|윤리|지리/.test(text)) return { learn: (part) => `${part}: 핵심 개념 확인 → 원인·사건·결과 연결표 만들기`, recall: "자료를 가리고 흐름·비교표 다시 그리기 → 빠진 개념 보충", guide: "사회·역사는 낱말만 외우지 않고 원인·사건·결과와 제도·영향을 연결해요." };
  if (/과학|물리|화학|생명|지구/.test(text)) return { learn: (part) => `${part}: 핵심 원리 이해 → 그림·실험 과정 재구성 → 현상 설명`, recall: "책을 덮고 조건 변화에 따른 결과 설명하기 → 관련 문제로 확인", guide: "과학은 용어 암기 뒤에 원리로 현상을 설명하고 실험 과정을 재구성해요." };
  return { learn: (part) => `${part}: 핵심 내용 이해 → 책을 덮고 3문장 요약 → 확인 문제`, recall: "자료를 가리고 핵심 내용 회상하기 → 기억나지 않은 부분만 다시 보기", guide: "읽기만 반복하지 않고 자료를 가린 채 기억에서 직접 꺼내요." };
}

function makePlan({ subject, examDate, range, days, minutes, unitDetails = "", difficulty = "보통", confidence = "보통", importance = "보통", autoMode = true, dayMinutes = {} }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${examDate}T00:00:00`);
  const studyDates = [];

  for (let cursor = new Date(today); cursor < end; cursor = addDays(cursor, 1)) {
    if (days.includes(cursor.getDay())) studyDates.push(new Date(cursor));
  }

  if (!studyDates.length) return [];

  const rangeText = range.trim();
  const detailedChunks = unitDetails.trim().split(/\n/).map((line) => line.trim()).filter(Boolean);
  const chunks = (detailedChunks.length ? detailedChunks : rangeText
    .split(/\n|,|→|~|–/)
    .map((item) => item.trim())
    .filter(Boolean));

  const strategy = getSubjectPlanStrategy(subject);
  const learningDateCount = studyDates.filter((_, index) => index !== studyDates.length - 1 && !(studyDates.length >= 5 && (index + 1) % 4 === 0)).length;
  let learningIndex = 0;

  return studyDates.flatMap((date, index) => {
    const isFinal = index === studyDates.length - 1;
    const isReview = !isFinal && studyDates.length >= 5 && (index + 1) % 4 === 0;
    const daysLeft = Math.ceil((end - date) / 86400000);
    const availableMinutes = Math.min(minutes, Number(dayMinutes[date.getDay()] || minutes));
    let task;
    let studyType = "개념";

    if (isFinal) {
      task = "전체 범위: 책을 덮고 핵심 회상 → 오답 재풀이 → 시험 직전 볼 한 장 정리";
      studyType = "복습";
    } else if (isReview) {
      task = strategy.recall;
      studyType = "복습";
    } else {
      const chunkIndex = Math.min(chunks.length - 1, Math.floor((learningIndex / Math.max(1, learningDateCount)) * chunks.length));
      task = strategy.learn(chunks[chunkIndex] || rangeText || "입력한 시험 범위");
      learningIndex += 1;
      if (autoMode && daysLeft <= 3) studyType = "문제풀이";
      else if (autoMode && daysLeft <= 7) studyType = confidence === "낮음" ? "오답" : "문제풀이";
    }

    const unit = chunks[Math.min(chunks.length - 1, Math.max(0, learningIndex - 1))] || rangeText;
    const base = {
      date: localDateString(date),
      label: `${date.getMonth() + 1}.${date.getDate()} ${DAY_NAMES[date.getDay()]}`,
      subject: subject.trim() || "시험 공부",
      actualMinutes: 0,
      unit,
      difficulty,
      confidence,
      importance,
      guideTip: isFinal ? "시험 전날과 당일 체크리스트" : isReview ? "회상 학습·오답 정리 가이드" : strategy.guide,
      done: false,
    };
    const makeTask = (suffix, action, taskMinutes, type, target, reviewDate = null) => ({ ...base, id: `${localDateString(date)}-${index}-${suffix}`, task: action, action, minutes: taskMinutes, studyType: type, targetAmount: target, reviewDate });
    if (isFinal) {
      const reviewMinutes = Math.max(1, Math.floor(availableMinutes * .5));
      const readyMinutes = Math.max(1, Math.min(5, Math.floor(availableMinutes * .1)));
      const errorMinutes = Math.max(1, availableMinutes - reviewMinutes - readyMinutes);
      return [makeTask("review", "전체 범위를 책 없이 회상하고 핵심 한 장 점검", reviewMinutes, "복습", "전체 범위 1회 회상"), makeTask("errors", "남은 오답을 풀이 가리고 다시 풀기", errorMinutes, "오답", "미해결 오답 전부"), makeTask("ready", "시험 시간·준비물 확인", readyMinutes, "복습", "준비물 체크 완료")];
    }
    if (isReview) return [makeTask("recall", strategy.recall, availableMinutes, "복습", "이전 학습 범위 회상 및 오답 재확인")];
    const conceptMinutes = Math.max(1, Math.floor(availableMinutes * .35));
    const practiceMinutes = Math.max(1, Math.floor(availableMinutes * .5));
    const correctionMinutes = Math.max(1, availableMinutes - conceptMinutes - practiceMinutes);
    const problemCount = Math.max(3, Math.round(practiceMinutes / 4));
    const reviewDate = localDateString(addDays(date, daysLeft <= 7 ? 1 : 3));
    const memoryAction = autoMode && daysLeft <= 3 ? `${unit} 암기 항목을 자료 없이 회상 확인` : `${unit} 핵심 개념을 내 말로 정리`;
    const practiceAction = autoMode && daysLeft <= 3 ? `${unit} 시간 제한 실전 문제 ${problemCount}개 풀이` : autoMode && daysLeft <= 7 ? `${unit} 취약 유형 문제 ${problemCount}개 풀이` : `${unit} 교과서·기본 문제 ${problemCount}개 풀이`;
    const firstType = autoMode && daysLeft <= 3 ? "암기" : autoMode && daysLeft <= 7 && confidence === "낮음" ? "오답" : "개념";
    return [makeTask("concept", memoryAction, conceptMinutes, firstType, autoMode && daysLeft <= 3 ? "암기 항목 전부 회상" : "핵심 개념·공식·흐름 1회 정리", reviewDate), makeTask("practice", practiceAction, practiceMinutes, "문제풀이", `${problemCount}문제`, reviewDate), makeTask("correct", `${unit} 틀린 문제 원인 기록 및 핵심 회상`, correctionMinutes, "오답", "틀린 이유와 다음 행동 기록", reviewDate)];
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
  const [loginPin, setLoginPin] = useState("");
  const [loginStatus, setLoginStatus] = useState("idle");
  const [loginError, setLoginError] = useState("");
  const [syncStatus, setSyncStatus] = useState("idle");
  const sessionTokenRef = useRef("");
  const plansHydratedRef = useRef(false);
  const syncTimerRef = useRef(null);
  const serverRevisionRef = useRef(0);
  const [grade, setGrade] = useState("중2");
  const [ageGroup, setAgeGroup] = useState("under13");
  const [subject, setSubject] = useState("한국사");
  const [examDate, setExamDate] = useState(defaultExam);
  const [range, setRange] = useState("조선 전기부터 근대 사회까지");
  const [minutes, setMinutes] = useState(60);
  const [unitDetails, setUnitDetails] = useState("");
  const [difficulty, setDifficulty] = useState("보통");
  const [confidence, setConfidence] = useState("보통");
  const [importance, setImportance] = useState("보통");
  const [autoMode, setAutoMode] = useState(true);
  const [dayMinutes, setDayMinutes] = useState(Object.fromEntries(DEFAULT_DAYS.map((day) => [day, 60])));
  const [rescheduleProposal, setRescheduleProposal] = useState(null);
  const [mistakes, setMistakes] = useState([]);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [plan, setPlan] = useState([]);
  const [plans, setPlans] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [view, setView] = useState("form");
  const [error, setError] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState(25);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [timerInitialSeconds, setTimerInitialSeconds] = useState(25 * 60);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [answerStatus, setAnswerStatus] = useState("idle");
  const [sharedPlans, setSharedPlans] = useState([]);
  const sharedPlansRef = useRef([]);
  const [communityGrade, setCommunityGrade] = useState("전체");
  const [contactStatus, setContactStatus] = useState("idle");
  const [contactMessage, setContactMessage] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [editingPlan, setEditingPlan] = useState(null);
  const [customPlaylists, setCustomPlaylists] = useState([]);
  const [playlistForm, setPlaylistForm] = useState({ title: "", url: "", lyrics: "무가사" });

  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem("study-flow-session") || "null");
      if (session?.user) {
        sessionTokenRef.current = session.token || "";
        setUser(session.user);
      }
    } catch {}
    const shared = localStorage.getItem("study-flow-shared");
    if (shared) {
      const parsed = JSON.parse(shared);
      sharedPlansRef.current = parsed;
      setSharedPlans(parsed);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    plansHydratedRef.current = false;
    const saved = localStorage.getItem(`study-flow-plans-${user.id}`);
    let localPlans = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        localPlans = parsed;
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
            localPlans = [migrated];
            setPlans([migrated]);
            setPlan(items);
            setCurrentPlanId(migrated.id);
            setView("plan");
          }
        } catch {}
      }
    }
    const loadServerPlans = async () => {
      setSyncStatus("syncing");
      try {
        const response = await fetch("/api/sync", { headers: { authorization: `Bearer ${sessionTokenRef.current}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(apiMessage(result, "동기화에 실패했어요."));
        const serverPlans = Array.isArray(result.plans) ? result.plans : [];
        serverRevisionRef.current = Number(result.revision || 0);
        const resolved = serverPlans.length ? serverPlans : localPlans;
        setPlans(resolved);
        if (resolved.length) { openPlan(resolved[0]); setView("today"); }
        plansHydratedRef.current = true;
        setSyncStatus("saved");
        // 기존 브라우저 기록을 처음 로그인한 계정의 서버 공간으로 옮긴다.
        if (!serverPlans.length && localPlans.length) {
          const migrationResponse = await fetch("/api/sync", { method: "PUT", headers: { authorization: `Bearer ${sessionTokenRef.current}`, "content-type": "application/json" }, body: JSON.stringify({ plans: localPlans, revision: serverRevisionRef.current, mutationId: crypto.randomUUID() }) });
          const migrationResult = await readJsonResponse(migrationResponse); if (migrationResponse.ok) serverRevisionRef.current = Number(migrationResult.revision || serverRevisionRef.current);
        }
      } catch (loadError) {
        plansHydratedRef.current = true;
        setSyncStatus("offline");
      }
    };
    loadServerPlans();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const key = `study-flow-plans-${user.id}`;
    if (plans.length) localStorage.setItem(key, JSON.stringify(plans));
    else localStorage.removeItem(key);
    if (!plansHydratedRef.current) return;
    clearTimeout(syncTimerRef.current);
    setSyncStatus("syncing");
    syncTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/sync", { method: "PUT", headers: { authorization: `Bearer ${sessionTokenRef.current}`, "content-type": "application/json" }, body: JSON.stringify({ plans, revision: serverRevisionRef.current, mutationId: crypto.randomUUID() }) });
        const result = await readJsonResponse(response);
        if (!response.ok) { if (response.status === 409) setShareStatus("다른 기기에서 계획이 변경됐어요. 새로고침 후 다시 확인해주세요."); throw new Error(); }
        serverRevisionRef.current = Number(result.revision || serverRevisionRef.current);
        setSyncStatus("saved");
      } catch { setSyncStatus("offline"); }
    }, 500);
    return () => clearTimeout(syncTimerRef.current);
  }, [plans, user]);

  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(`study-flow-playlists-${user.id}`);
      const parsed = saved ? JSON.parse(saved) : [];
      setCustomPlaylists(parsed.flatMap((playlist) => {
        let normalized = getPlaylistEmbed(playlist.url);
        if (!playlist.linkKey && normalized?.provider === "YouTube") {
          const legacyUrl = new URL(playlist.url);
          const legacyListId = legacyUrl.searchParams.get("list");
          if (legacyUrl.pathname === "/playlist" && /^RD[a-zA-Z0-9_-]{11}$/.test(legacyListId || "")) {
            const videoId = legacyListId.slice(2);
            normalized = getPlaylistEmbed(`https://www.youtube.com/watch?v=${videoId}&list=${legacyListId}&start_radio=1`);
          }
        }
        return normalized ? [{ ...playlist, ...normalized }] : [];
      }));
    } catch {
      setCustomPlaylists([]);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const key = `study-flow-playlists-${user.id}`;
    if (customPlaylists.length) localStorage.setItem(key, JSON.stringify(customPlaylists));
    else localStorage.removeItem(key);
  }, [customPlaylists, user]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/mistakes", { headers: { authorization: `Bearer ${sessionTokenRef.current}` } }).then(async (response) => {
      const result = await readJsonResponse(response);
      if (response.ok && Array.isArray(result.mistakes)) setMistakes(result.mistakes);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!currentPlanId || !plan.length) return;
    setPlans((current) => current.map((savedPlan) => savedPlan.id === currentPlanId ? { ...savedPlan, items: plan, schemaVersion: 2, revision: Number(savedPlan.revision || 0) + 1, updatedAt: new Date().toISOString() } : savedPlan));
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

  useEffect(() => {
    if (!shareStatus) return;
    const timeout = setTimeout(() => setShareStatus(""), 3200);
    return () => clearTimeout(timeout);
  }, [shareStatus]);

  useEffect(() => {
    sharedPlansRef.current = sharedPlans;
  }, [sharedPlans]);

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
    const nextPlan = makePlan({ subject, examDate, range, days, minutes, unitDetails, difficulty, confidence, importance, autoMode, dayMinutes });
    const requestedUnits = unitDetails.trim().split(/\n/).map((item) => item.trim()).filter(Boolean);
    const missingUnits = requestedUnits.filter((unit) => !nextPlan.some((item) => item.unit === unit));
    if (missingUnits.length) {
      setError(`현재 가능 시간으로는 ${missingUnits.length}개 단원을 배정할 수 없어요. 약 ${missingUnits.length * minutes}분을 추가하거나 범위를 줄여주세요.`);
      return;
    }
    const weakUnits = [...new Set(mistakes.filter((item) => item.subject === subject && mistakes.filter((entry) => entry.subject === item.subject && entry.unit === item.unit).length >= 2).map((item) => item.unit))];
    if (weakUnits.length && nextPlan[0]) {
      nextPlan[0] = { ...nextPlan[0], task: `취약 단원 ${weakUnits.join(", ")} 오답 원인 확인 → 관련 문제 재풀이`, unit: weakUnits.join(", "), studyType: "오답", targetAmount: "반복 오답 전부 재확인" };
    }
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
      settings: { unitDetails, difficulty, confidence, importance, autoMode, dayMinutes, maxDailyMinutes: minutes },
      schemaVersion: 2,
      revision: 1,
      updatedAt: new Date().toISOString(),
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

  const startEditingPlan = (savedPlan) => {
    setEditingPlan({
      ...savedPlan,
      items: savedPlan.items.map((item) => ({ ...item })),
    });
    setView("edit");
  };

  const updateEditingItem = (id, field, value) => {
    setEditingPlan((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, [field]: value } : item),
    }));
  };

  const saveEditedPlan = (event) => {
    event.preventDefault();
    if (!editingPlan?.name.trim() || !editingPlan.subject.trim() || !editingPlan.range.trim()) {
      setShareStatus("계획 이름, 과목과 범위를 모두 입력해주세요.");
      return;
    }
    if (!editingPlan.items.length || editingPlan.items.some((item) => !item.task.trim() || Number(item.minutes) < 1)) {
      setShareStatus("공부 일정의 내용과 시간을 확인해주세요.");
      return;
    }

    const updated = {
      ...editingPlan,
      name: editingPlan.name.trim(),
      subject: editingPlan.subject.trim(),
      range: editingPlan.range.trim(),
      items: editingPlan.items.map((item) => ({ ...item, minutes: Number(item.minutes) })),
    };
    setPlans((current) => current.map((savedPlan) => savedPlan.id === updated.id ? updated : savedPlan));
    if (currentPlanId === updated.id) {
      setPlan(updated.items);
      setSubject(updated.subject);
      setRange(updated.range);
      setExamDate(updated.examDate);
    }
    setEditingPlan(null);
    setView("library");
    setShareStatus(`${updated.name}의 수정 내용을 저장했어요.`);
  };

  const proposeReschedule = () => {
    if (!activePlan) return;
    const today = localDateString(new Date());
    const overdue = activePlan.items.filter((item) => !item.done && item.date < today);
    if (!overdue.length) { setShareStatus("재조정할 지난 미완료 작업이 없어요."); return; }
    const end = new Date(`${activePlan.examDate}T00:00:00`);
    const slots = [];
    for (let cursor = new Date(`${today}T00:00:00`); cursor < end; cursor = addDays(cursor, 1)) {
      if (days.includes(cursor.getDay())) slots.push({ date: localDateString(cursor), used: activePlan.items.filter((item) => !overdue.includes(item) && item.date === localDateString(cursor)).reduce((sum, item) => sum + Number(item.minutes || 0), 0), limit: Math.min(minutes, Number(dayMinutes[cursor.getDay()] || minutes)) });
    }
    const changes = [];
    const sorted = [...overdue].sort((a, b) => (b.importance === "높음") - (a.importance === "높음") || (a.confidence === "낮음" ? -1 : 1));
    for (const item of sorted) {
      const slot = slots.find((entry) => entry.used + Number(item.minutes) <= entry.limit);
      if (!slot) { const shortage = sorted.slice(changes.length).reduce((sum, entry) => sum + Number(entry.minutes), 0); setShareStatus(`시험 전까지 약 ${shortage}분이 부족해요. 가능 시간을 늘리거나 범위를 줄여주세요.`); return; }
      changes.push({ id: item.id, from: item.date, to: slot.date, minutes: item.minutes, task: item.task }); slot.used += Number(item.minutes);
    }
    setRescheduleProposal(changes);
  };

  const approveReschedule = () => {
    if (!rescheduleProposal) return;
    setPlan((current) => current.map((item) => { const change = rescheduleProposal.find((entry) => entry.id === item.id); if (!change) return item; const date = new Date(`${change.to}T00:00:00`); return { ...item, date: change.to, label: `${date.getMonth() + 1}.${date.getDate()} ${DAY_NAMES[date.getDay()]}`, updatedAt: new Date().toISOString() }; }));
    setRescheduleProposal(null); setShareStatus("확인한 변경 내용으로 일정을 재조정했어요.");
  };

  const saveMistake = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = [{ id: crypto.randomUUID(), subject: String(form.get("subject")), unit: String(form.get("unit")), memo: String(form.get("memo")), reason: String(form.get("reason")), reviewDate: String(form.get("reviewDate")), createdAt: new Date().toISOString() }, ...mistakes];
    setMistakes(next); event.currentTarget.reset();
    try {
      const response = await fetch("/api/mistakes", { method: "PUT", headers: { authorization: `Bearer ${sessionTokenRef.current}`, "content-type": "application/json" }, body: JSON.stringify({ mistakes: next }) });
      const result = await readJsonResponse(response); if (!response.ok) throw new Error(apiMessage(result, "저장하지 못했어요."));
      setShareStatus("오답을 저장하고 취약 단원 분석에 반영했어요.");
    } catch (saveError) { setShareStatus(saveError.message); }
  };

  const exportIcs = (todayOnly = false) => {
    const selected = plan.filter((item) => !todayOnly || item.date === localDateString(new Date()));
    const escape = (value) => String(value).replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//공부하자//Study Plan//KO", ...selected.flatMap((item) => ["BEGIN:VEVENT", `UID:${item.id}@gongbuhaja`, `DTSTART;VALUE=DATE:${item.date.replaceAll("-", "")}`, `SUMMARY:${escape(`${item.subject} ${item.unit || "공부"}`)}`, `DESCRIPTION:${escape(`${item.task} (${item.minutes}분)`)}`, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" })); link.download = todayOnly ? "오늘의-공부.ics" : "시험-공부-계획.ics"; link.click(); URL.revokeObjectURL(link.href);
  };

  const changeLoginCode = async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setSettingsMessage("");
    const response = await fetch("/api/account", { method: "PATCH", headers: { authorization: `Bearer ${sessionTokenRef.current}`, "content-type": "application/json" }, body: JSON.stringify({ currentCode: form.get("currentCode"), newCode: form.get("newCode") }) });
    const result = await readJsonResponse(response); if (!response.ok) { setSettingsMessage(apiMessage(result, "변경하지 못했어요.")); return; }
    setSettingsMessage("코드를 변경했습니다. 모든 기기에서 로그아웃됩니다."); setTimeout(logout, 1200);
  };

  const deleteAccount = async (event) => {
    event.preventDefault(); const confirmation = String(new FormData(event.currentTarget).get("confirmation") || "");
    if (!window.confirm("계정과 모든 학습 데이터를 복구할 수 없게 삭제할까요?")) return;
    const response = await fetch("/api/account", { method: "DELETE", headers: { authorization: `Bearer ${sessionTokenRef.current}`, "content-type": "application/json" }, body: JSON.stringify({ confirmation }) });
    const result = await readJsonResponse(response); if (!response.ok) { setSettingsMessage(apiMessage(result, "삭제하지 못했어요.")); return; }
    localStorage.clear(); window.location.reload();
  };

  const logoutAllDevices = async () => {
    const response = await fetch("/api/sessions", { method: "DELETE", headers: { authorization: `Bearer ${sessionTokenRef.current}` } });
    const result = await readJsonResponse(response);
    if (!response.ok) { setSettingsMessage(apiMessage(result, "세션을 만료하지 못했어요.")); return; }
    localStorage.removeItem("study-flow-session"); window.location.reload();
  };

  const changeTimer = (value) => {
    setTimerMode(value);
    setTimerSeconds(value * 60);
    setTimerInitialSeconds(value * 60);
    setTimerRunning(false);
  };

  const login = async (event) => {
    event.preventDefault();
    const cleanedLoginCode = loginPin.trim();
    if (!loginName.trim() || (!LEGACY_PIN.test(cleanedLoginCode) && !MODERN_PASSWORD.test(cleanedLoginCode))) {
      setLoginError("비밀번호는 영문자·숫자·특수문자를 포함한 8자 이상으로 입력해주세요. 기존 숫자 코드는 그대로 사용할 수 있어요.");
      return;
    }
    setLoginStatus("loading"); setLoginError("");
    try {
      const requestOptions = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: loginName.trim(), pin: cleanedLoginCode, grade, isUnder13: ageGroup === "under13" }) };
      let response = await fetch("/api/account", requestOptions);
      if (response.status === 405) response = await fetch("/api/account/", requestOptions);
      const result = await readJsonResponse(response);
      if (!response.ok || !result.ok || !result.user) {
        const fallbackMessage = response.status === 404
          ? "로그인 API를 찾을 수 없어요. 서버 배포 설정을 확인해주세요."
          : response.status >= 500
            ? "로그인 서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해주세요."
            : `로그인 서버 응답을 확인할 수 없어요. (상태 ${response.status})`;
        throw new Error(apiMessage(result, fallbackMessage));
      }
      const legacyId = loginName.trim().toLowerCase().replace(/\s+/g, "-");
      const legacyPlans = localStorage.getItem(`study-flow-plans-${legacyId}`);
      if (legacyPlans && !localStorage.getItem(`study-flow-plans-${result.user.id}`)) {
        localStorage.setItem(`study-flow-plans-${result.user.id}`, legacyPlans);
      }
      sessionTokenRef.current = "";
      localStorage.setItem("study-flow-session", JSON.stringify({ ok: true, user: result.user, account: result.account }));
      localStorage.removeItem("study-flow-user");
      setPlans([]); setUser(result.user); setLoginPin("");
      window.dispatchEvent(new Event("study-session-changed"));
    } catch (loginFailure) { setLoginError(loginFailure.message); }
    finally { setLoginStatus("idle"); }
  };

  const logout = async () => {
    const token = sessionTokenRef.current;
    if (token) {
      try {
        await fetch("/api/logout", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    localStorage.removeItem("study-flow-user");
    localStorage.removeItem("study-flow-session");
    sessionTokenRef.current = "";
    setUser(null);
    setPlans([]);
    setPlan([]);
    setCustomPlaylists([]);
    setView("form");
    window.location.reload();
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
    if (!activePlan) {
      setShareStatus("공유할 계획을 먼저 선택해주세요.");
      return;
    }
    if (activePlan.importedFromCommunity || (activePlan.sourceId && activePlan.author)) {
      setShareStatus("계획 둘러보기에서 가져온 계획은 다시 게시할 수 없어요.");
      return;
    }
    const shareKey = getPlanShareKey(activePlan);
    if (sharedPlansRef.current.some((item) => getPlanShareKey(item) === shareKey && (item.ownerId === user.id || item.author === user.name))) {
      setShareStatus("이미 커뮤니티에 게시한 계획이에요.");
      return;
    }
    const shared = {
      ...activePlan,
      id: `shared-${Date.now()}`,
      sourceId: activePlan.id,
      shareKey,
      ownerId: user.id,
      author: user.name,
      grade: activePlan.grade || user.grade,
      likes: 0,
      items: activePlan.items.map((item) => ({ ...item })),
    };
    const next = [shared, ...sharedPlansRef.current];
    sharedPlansRef.current = next;
    setSharedPlans(next);
    localStorage.setItem("study-flow-shared", JSON.stringify(next));
    setShareStatus("커뮤니티에 계획을 게시했어요.");
  };

  const deleteSharedPlan = (shared) => {
    const isOwner = shared.ownerId === user.id || (!shared.ownerId && shared.sourceId && shared.author === user.name);
    if (!isOwner) return;
    if (!window.confirm("커뮤니티에서 이 게시 계획을 삭제할까요? 보관함의 원본 계획은 그대로 유지됩니다.")) return;
    const next = sharedPlansRef.current.filter((item) => item.id !== shared.id);
    sharedPlansRef.current = next;
    setSharedPlans(next);
    localStorage.setItem("study-flow-shared", JSON.stringify(next));
    setShareStatus("커뮤니티 게시물을 삭제했어요. 보관함 원본은 유지됩니다.");
  };

  const addCustomPlaylist = (event) => {
    event.preventDefault();
    const parsed = getPlaylistEmbed(playlistForm.url);
    if (!playlistForm.title.trim()) {
      setShareStatus("플레이리스트 이름을 입력해주세요.");
      return;
    }
    if (!parsed) {
      setShareStatus("Spotify 플레이리스트 또는 YouTube 영상·재생목록 링크를 확인해주세요.");
      return;
    }
    const playlist = {
      id: `playlist-${Date.now()}`,
      title: playlistForm.title.trim(),
      lyrics: playlistForm.lyrics,
      createdAt: new Date().toISOString(),
      ...parsed,
    };
    const isReplacing = customPlaylists.some((item) => (item.linkKey || item.url) === (parsed.linkKey || parsed.url));
    setCustomPlaylists((current) => [playlist, ...current.filter((item) => (item.linkKey || item.url) !== (parsed.linkKey || parsed.url))]);
    setPlaylistForm({ title: "", url: "", lyrics: "무가사" });
    setShareStatus(isReplacing ? `${playlist.title} 링크를 새 카드로 다시 등록했어요.` : `${playlist.title}을 나의 플레이리스트에 추가했어요.`);
  };

  const shareCustomPlaylist = async (playlist) => {
    const shareData = {
      title: `[공부하자!] ${playlist.title}`,
      text: `${playlist.lyrics} 공부 음악 · ${playlist.provider} 플레이리스트`,
      url: playlist.url,
    };
    setShareStatus(`${playlist.title} 공유 링크를 준비했어요.`);
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData);
        setShareStatus(`${playlist.title}을 공유했어요.`);
        return;
      } catch (shareError) {
        if (shareError?.name === "AbortError") {
          setShareStatus("플레이리스트 공유를 취소했어요.");
          return;
        }
      }
    }
    const copied = await copyText(playlist.url);
    setShareStatus(copied ? `${playlist.title} 링크를 복사했어요.` : "공유하지 못했어요. 원본에서 열기를 이용해주세요.");
  };

  const deleteCustomPlaylist = (playlist) => {
    if (!window.confirm(`${playlist.title}을 나의 플레이리스트에서 삭제할까요?`)) return;
    setCustomPlaylists((current) => current.filter((item) => item.id !== playlist.id));
    setShareStatus(`${playlist.title}을 삭제했어요.`);
  };

  const shareSavedPlan = async (savedPlan) => {
    const schedule = savedPlan.items
      .map((item) => `${item.done ? "✓" : "□"} ${item.label} · ${item.task} (${item.minutes}분)`)
      .join("\n");
    const text = [
      `[공부하자!] ${savedPlan.name}`,
      `${savedPlan.subject} · 시험일 ${savedPlan.examDate || "미정"}`,
      `범위: ${savedPlan.range}`,
      "",
      schedule,
      "",
      "공부하자!에서 만든 계획이에요.",
    ].join("\n");
    const shareData = {
      title: `${savedPlan.subject} 공부 계획`,
      text,
      url: DISQUS_URL,
    };

    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        setShareStatus(`${savedPlan.name}을 공유했어요.`);
      } else {
        await navigator.clipboard.writeText(`${text}\n${DISQUS_URL}`);
        setShareStatus(`${savedPlan.name}을 클립보드에 복사했어요.`);
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(`${text}\n${DISQUS_URL}`);
          setShareStatus(`${savedPlan.name}을 클립보드에 복사했어요.`);
        } catch {
          setShareStatus("공유하지 못했어요. 잠시 후 다시 시도해주세요.");
        }
      }
    }
  };

  const copySharedPlan = (shared) => {
    const copied = { ...shared, id: `plan-${Date.now()}`, shareKey: getPlanShareKey(shared), importedFromCommunity: true, name: `계획 ${plans.length + 1}`, createdAt: new Date().toISOString(), items: shared.items.map((item, index) => ({ ...item, id: `${Date.now()}-${index}`, done: false })) };
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
  const isCommunityImportedPlan = Boolean(activePlan?.importedFromCommunity || (activePlan?.sourceId && activePlan?.author));
  const hasSharedActivePlan = Boolean(activePlan && sharedPlans.some(
    (item) => getPlanShareKey(item) === getPlanShareKey(activePlan) && (item.ownerId === user?.id || item.author === user?.name)
  ));
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
            <p>시험일, 범위, 가능한 요일을 입력하면 남은 기간에 맞춰 학습과 복습 일정을 나눠드립니다. 같은 별명과 로그인 코드로 어느 기기에서나 계획을 이어갈 수 있어요.</p>
            <ul className="hero-points">
              <li>시험 전 마지막 날은 전체 복습으로 자동 배정</li>
              <li>학습 가능 요일과 하루 공부 시간을 직접 설정</li>
              <li>계획과 완료 기록을 계정별로 안전하게 동기화</li>
            </ul>
          </div>
          <form className="auth-card" onSubmit={login}>
            <div className="card-heading"><span>무료 플래너 시작하기</span><span className="step">SYNC</span></div>
            <label><span>이름 또는 별명</span><input value={loginName} onChange={(event) => setLoginName(event.target.value)} placeholder="예: 확률마스터" autoFocus /></label>
            <label><span>비밀번호</span><input type="password" minLength="6" maxLength="64" value={loginPin} onChange={(event) => setLoginPin(event.target.value)} placeholder="영문자·숫자·특수문자 포함 8자 이상" autoComplete="current-password" /></label>
            <label><span>현재 학년</span><select value={grade} onChange={(event) => setGrade(event.target.value)}>{["초4","초5","초6","중1","중2","중3","고1","고2","고3"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>연령 구분</span><select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)}><option value="under13">13세 미만</option><option value="over13">13세 이상</option></select></label>
            <button className="primary-button" type="submit" disabled={loginStatus === "loading"}>{loginStatus === "loading" ? "확인하는 중..." : "내 공부방 들어가기"} <span>→</span></button>
            {loginError && <p className="form-status error" role="alert">{loginError}</p>}
            <p className="privacy">처음 입력하면 계정이 만들어집니다. 새 비밀번호는 영문자·숫자·특수문자를 모두 포함해 8자 이상으로 만드세요. 기존 숫자 로그인 코드는 그대로 사용할 수 있습니다.</p>
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
            <details><summary>다른 기기에서도 계획을 볼 수 있나요?</summary><p>네. 같은 별명과 로그인 코드를 입력하면 서버에 동기화된 계획과 완료 기록을 불러옵니다. 인터넷 연결이 잠시 끊기면 이 기기에 저장하고 연결이 돌아온 뒤 다시 동기화합니다.</p></details>
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
          <span className={`sync-status ${syncStatus}`}>{syncStatus === "idle" ? "불러오는 중" : syncStatus === "syncing" ? "동기화 중" : syncStatus === "offline" ? "기기 저장됨" : "서버 저장됨"}</span>
          <button className="nav-link" onClick={() => setView("today")}>오늘의 공부</button>
          <button className="nav-link info-nav" onClick={() => setView("mistakes")}>오답 관리</button>
          <a className="nav-link info-nav" href="/guides">학습 가이드</a>
          <a className="nav-link info-nav" href="/about">서비스 소개</a>
          <button className="nav-link community-nav" onClick={() => setView("community")}>계획 둘러보기</button>
          <button className="nav-link" onClick={() => setView("music")}>노래</button>
          <button className="nav-link contact-nav" onClick={() => setView("contact")}>제휴 문의</button>
          <button className="nav-link" onClick={() => setView("library")}>
            계획 보관함 <b>{plans.length}</b>
          </button>
          <button className="nav-link info-nav" onClick={() => setView("settings")}>계정 설정</button>
          <button className="ghost-button" onClick={() => setView("form")}>+ 새 계획</button>
        </div>
      </nav>

      {shareStatus && <div className="action-toast" role="status" aria-live="polite">✓ {shareStatus}</div>}

      {view === "contact" ? contactPage : view === "today" ? (
        <section className="today-shell">
          <header className="library-header"><div><p className="eyebrow">TODAY&apos;S STUDY</p><h1>오늘의 공부</h1><p>{localDateString(new Date())} · 완료 상태는 서버에 바로 동기화됩니다.</p></div><button className="ghost-button" onClick={proposeReschedule}>미완료 작업 재조정</button></header>
          {(() => { const today = localDateString(new Date()); const tasks = plan.filter((item) => item.date === today); const total = tasks.reduce((sum, item) => sum + Number(item.minutes || 0), 0); const completed = tasks.filter((item) => item.done).reduce((sum, item) => sum + Number(item.actualMinutes || item.minutes || 0), 0); const percent = tasks.length ? Math.round(tasks.filter((item) => item.done).length / tasks.length * 100) : 0; return <>
            <div className="today-summary"><article><span>예상 총 시간</span><strong>{total}분</strong></article><article><span>완료 / 남은 시간</span><strong>{completed}분 / {Math.max(0, total - completed)}분</strong></article><article><span>오늘 진행률</span><strong>{percent}%</strong></article><article><span>작업 타이머</span><strong>{formatTimer(timerSeconds)}</strong><button className="ghost-button" onClick={() => timerSeconds > 0 && setTimerRunning((running) => !running)}>{timerRunning ? "중지" : "시작"}</button></article></div>
            <div className="plan-list">{tasks.length ? tasks.map((item, index) => <article className={`plan-item ${item.done ? "done" : ""}`} key={item.id}><button className="check" onClick={() => setPlan((current) => current.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done, actualMinutes: !entry.done ? Math.max(1, activeTaskId === item.id ? Math.ceil((timerInitialSeconds - timerSeconds) / 60) : entry.actualMinutes || entry.minutes) : 0 } : entry))}>{item.done ? "✓" : index + 1}</button><div className="date">{item.subject}<small>{item.studyType || "학습"}</small></div><div className="task"><strong>{item.task}</strong><span>{item.targetAmount || item.unit} · {item.minutes}분{item.actualMinutes ? ` · 실제 ${item.actualMinutes}분` : ""}</span>{item.reviewDate && <small>다음 복습 {item.reviewDate}</small>}</div><button className="ghost-button" onClick={() => { changeTimer(item.minutes); setActiveTaskId(item.id); }}>{activeTaskId === item.id ? "선택됨" : "타이머"}</button></article>) : <div className="empty-library"><h2>오늘 배정된 작업이 없어요.</h2><p>새 계획을 만들거나 다음 일정을 확인해보세요.</p></div>}</div>
          </>; })()}
          {rescheduleProposal && <div className="proposal-card"><h2>재조정 변경 내용</h2>{rescheduleProposal.map((change) => <p key={change.id}><strong>{change.task}</strong><span>{change.from} → {change.to} · {change.minutes}분</span></p>)}<div><button className="ghost-button" onClick={() => setRescheduleProposal(null)}>취소</button><button className="primary-button compact" onClick={approveReschedule}>변경 승인</button></div></div>}
        </section>
      ) : view === "mistakes" ? (
        <section className="today-shell"><header className="library-header"><div><p className="eyebrow">MISTAKES · WEAK UNITS</p><h1>오답과 취약 단원</h1><p>같은 과목·단원에 오답이 2개 이상이면 취약 단원으로 계획에 우선 반영하세요.</p></div></header>
          <form className="planner-card mistake-form" onSubmit={saveMistake}><label><span>과목</span><input name="subject" required /></label><label><span>단원</span><input name="unit" required /></label><label><span>문제 메모</span><textarea name="memo" rows="3" required /></label><label><span>틀린 이유</span><select name="reason">{["개념 부족","암기 부족","계산 실수","문제 해석 오류","시간 부족","기타"].map((reason) => <option key={reason}>{reason}</option>)}</select></label><label><span>다시 볼 날짜</span><input type="date" name="reviewDate" required /></label><button className="primary-button" type="submit">오답 저장</button></form>
          <div className="mistake-list">{mistakes.map((item) => { const repeated = mistakes.filter((entry) => entry.subject === item.subject && entry.unit === item.unit).length >= 2; return <article key={item.id}><span>{item.reason}</span><h2>{item.subject} · {item.unit} {repeated && <b>취약 단원</b>}</h2><p>{item.memo}</p><small>다시 보기 {item.reviewDate}</small></article>; })}</div>
        </section>
      ) : view === "settings" ? (
        <section className="today-shell"><header className="library-header"><div><p className="eyebrow">ACCOUNT SETTINGS</p><h1>계정 설정</h1><p>서버 저장 정보: 별명 {user.name}, 학년 {user.grade}, 연령 분류 {user.isChild ? "아동" : "일반"}</p></div></header>
          <div className="settings-grid"><form className="planner-card" onSubmit={changeLoginCode}><h2>로그인 코드 변경</h2><label><span>현재 코드</span><input type="password" name="currentCode" required /></label><label><span>새 코드</span><input type="password" name="newCode" minLength="8" placeholder="영문·숫자·특수문자 포함" required /></label><button className="primary-button" type="submit">변경 후 모든 기기 로그아웃</button></form><form className="planner-card danger-card" onSubmit={deleteAccount}><h2>계정 및 데이터 삭제</h2><p>계정, 계획, 완료 기록, 오답과 모든 세션을 삭제합니다. 복구할 수 없습니다.</p><label><span>확인을 위해 별명 “{user.name}” 입력</span><input name="confirmation" required /></label><button className="primary-button" type="submit">계정 영구 삭제</button></form></div>
          {settingsMessage && <p className="form-status" role="status">{settingsMessage}</p>}<button className="ghost-button" onClick={logout}>현재 기기 로그아웃</button> <button className="ghost-button" onClick={logoutAllDevices}>모든 기기에서 로그아웃</button>
        </section>
      ) : view === "edit" && editingPlan ? (
        <section className="edit-shell">
          <header className="edit-header">
            <div>
              <p className="eyebrow">EDIT STUDY PLAN</p>
              <h1>계획 수정하기</h1>
              <p>기본 정보와 각 날짜의 공부 내용·시간을 직접 바꿀 수 있어요.</p>
            </div>
            <button className="ghost-button" type="button" onClick={() => { setEditingPlan(null); setView("library"); }}>수정 취소</button>
          </header>
          <form className="edit-form" onSubmit={saveEditedPlan}>
            <div className="edit-basics">
              <label><span>계획 이름</span><input value={editingPlan.name} onChange={(event) => setEditingPlan((current) => ({ ...current, name: event.target.value }))} /></label>
              <label><span>과목</span><input value={editingPlan.subject} onChange={(event) => setEditingPlan((current) => ({ ...current, subject: event.target.value }))} /></label>
              <label><span>시험 날짜</span><input type="date" value={editingPlan.examDate || ""} onChange={(event) => setEditingPlan((current) => ({ ...current, examDate: event.target.value }))} /></label>
              <label className="edit-range"><span>시험 범위</span><textarea rows="3" value={editingPlan.range} onChange={(event) => setEditingPlan((current) => ({ ...current, range: event.target.value }))} /></label>
            </div>
            <div className="edit-schedule-heading">
              <div><span>SCHEDULE</span><h2>공부 일정</h2></div>
              <p>게시했던 커뮤니티 계획에는 이 수정이 자동 반영되지 않아요.</p>
            </div>
            <div className="edit-schedule">
              {editingPlan.items.map((item, index) => (
                <div className="edit-schedule-row" key={item.id}>
                  <b>{index + 1}</b>
                  <span>{item.label}</span>
                  <label><span>공부 내용</span><input value={item.task} onChange={(event) => updateEditingItem(item.id, "task", event.target.value)} /></label>
                  <label><span>시간(분)</span><input type="number" min="1" max="600" value={item.minutes} onChange={(event) => updateEditingItem(item.id, "minutes", event.target.value)} /></label>
                  <button type="button" aria-label={`${item.label} 일정 삭제`} disabled={editingPlan.items.length === 1} onClick={() => setEditingPlan((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))}>삭제</button>
                </div>
              ))}
            </div>
            <div className="edit-actions">
              <button className="ghost-button" type="button" onClick={() => { setEditingPlan(null); setView("library"); }}>취소</button>
              <button className="primary-button compact" type="submit">수정 내용 저장 <span>→</span></button>
            </div>
          </form>
        </section>
      ) : view === "form" ? (
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

            <label>
              <span>단원별 분량</span>
              <textarea value={unitDetails} onChange={(e) => setUnitDetails(e.target.value)} placeholder={"예: 3단원 개념 12쪽·예제 8문제\n4단원 개념 18쪽·기출 15문제"} rows="3" />
              <small>한 줄에 한 단원씩, 페이지나 문제 수를 함께 적어주세요.</small>
            </label>

            <div className="priority-grid">
              <label><span>난이도</span><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>{["낮음","보통","높음"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>현재 자신감</span><select value={confidence} onChange={(e) => setConfidence(e.target.value)}>{["낮음","보통","높음"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>시험 중요도</span><select value={importance} onChange={(e) => setImportance(e.target.value)}>{["낮음","보통","높음"].map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>

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

            <div className="weekday-minutes">
              {days.sort((a, b) => a - b).map((day) => (
                <label key={day}><span>{DAY_NAMES[day]}요일 가능 시간</span><input type="number" min="10" max={minutes} step="10" value={dayMinutes[day] || minutes} onChange={(e) => setDayMinutes((current) => ({ ...current, [day]: Math.min(minutes, Number(e.target.value)) }))} /></label>
              ))}
            </div>

            <label>
              <span className="slider-label"><b>하루 공부 시간</b><strong>{minutes}분</strong></span>
              <input className="range-input" type="range" min="20" max="180" step="10" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            </label>

            <label className="consent-field"><input type="checkbox" checked={autoMode} onChange={(e) => setAutoMode(e.target.checked)} /><span>시험까지 남은 기간에 따른 자동 집중 모드 사용</span></label>

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
            {communityPlans.map((shared) => {
              const isOwnPost = shared.ownerId === user.id || (!shared.ownerId && shared.sourceId && shared.author === user.name);
              return (
              <article className={`library-card community-card ${isOwnPost ? "own-post" : ""}`} key={shared.id}>
                <div className="library-number">♡ {shared.likes || 0}</div>
                <span className="subject-chip">{shared.grade} · {shared.subject}{isOwnPost ? " · 내가 게시" : ""}</span>
                <h2>{shared.range}</h2>
                <p>by {shared.author} · {shared.name} · 총 {shared.items.length}회</p>
                <div className="community-preview">“하루씩 따라가며 완료 체크할 수 있어요.”</div>
                <div className="library-actions">
                  <button onClick={() => copySharedPlan(shared)}>이 계획 따라하기 <span>→</span></button>
                  {isOwnPost && <button className="delete-button" onClick={() => deleteSharedPlan(shared)}>게시물 삭제</button>}
                </div>
              </article>
            );})}
          </div>
        </section>
      ) : view === "music" ? (
        <section className="music-shell">
          <header className="music-header">
            <div>
              <p className="eyebrow">STUDY MUSIC · TEST PLAYLISTS</p>
              <h1>오래 공부하는 날의 노래</h1>
              <p>가사 유무에 따라 하나씩 골라두었어요. 공부 흐름에 맞는 재생목록을 선택해보세요.</p>
            </div>
            <button className="primary-button compact" onClick={() => setView(currentPlanId ? "plan" : "form")}>계획으로 돌아가기</button>
          </header>

          <div className="music-grid">
            {MUSIC_PLAYLISTS.map((playlist) => (
              <article className="music-card" key={playlist.id}>
                <div className="music-card-heading">
                  <span>{playlist.label}</span>
                  <b>{playlist.duration}</b>
                </div>
                <h2>{playlist.title}</h2>
                <p>{playlist.description}</p>
                <iframe
                  title={`${playlist.title} Spotify 플레이어`}
                  src={playlist.embedUrl}
                  width="100%"
                  height="352"
                  loading="lazy"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                />
                <div className="music-links">
                  <a href={playlist.playlistUrl} target="_blank" rel="noreferrer">{playlist.provider}에서 열기 ↗</a>
                  <a href={playlist.policyUrl} target="_blank" rel="noreferrer">{playlist.policyLabel} ↗</a>
                </div>
              </article>
            ))}
          </div>

          <section className="custom-playlist-section" aria-labelledby="custom-playlist-title">
            <div className="custom-playlist-heading">
              <div>
                <p className="eyebrow">MY PLAYLIST LINKS</p>
                <h2 id="custom-playlist-title">나만의 플레이리스트</h2>
                <p>Spotify 플레이리스트·곡·앨범이나 YouTube 영상·Shorts·재생목록 링크를 붙여 넣어 한곳에 모으고 친구에게 공유하세요.</p>
              </div>
              <span>{customPlaylists.length}개 저장</span>
            </div>

            <form className="playlist-add-form" onSubmit={addCustomPlaylist}>
              <label>
                <span>플레이리스트 이름</span>
                <input value={playlistForm.title} onChange={(event) => setPlaylistForm((current) => ({ ...current, title: event.target.value }))} placeholder="예: 수학 문제 풀이용" maxLength={60} />
              </label>
              <label className="playlist-url-field">
                <span>외부 플레이리스트 URL</span>
                <input type="url" inputMode="url" value={playlistForm.url} onChange={(event) => setPlaylistForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
              </label>
              <label>
                <span>가사 구분</span>
                <select value={playlistForm.lyrics} onChange={(event) => setPlaylistForm((current) => ({ ...current, lyrics: event.target.value }))}>
                  <option>무가사</option>
                  <option>가사 있음</option>
                  <option>혼합</option>
                </select>
              </label>
              <button className="primary-button compact" type="submit">링크 추가 <span>＋</span></button>
            </form>
            <p className="playlist-form-help">입력한 주소를 바꾸지 않고 그대로 저장하며, 원본 보기와 공유에도 같은 주소를 사용해요.</p>

            {customPlaylists.length ? (
              <div className="custom-playlist-grid">
                {customPlaylists.map((playlist) => (
                  <article className="custom-playlist-card" key={playlist.id}>
                    <div className="custom-playlist-meta"><span>{playlist.provider}</span><b>{playlist.lyrics}</b></div>
                    <h3>{playlist.title}</h3>
                    {playlist.embedUrl ? (
                      <iframe
                        title={`${playlist.title} ${playlist.provider} 플레이어`}
                        src={playlist.embedUrl}
                        width="100%"
                        height="240"
                        loading="lazy"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <a className="external-playlist-link" href={playlist.url} target="_blank" rel="noreferrer">
                        <span>▶</span>
                        <strong>{playlist.provider}에서 재생하기</strong>
                        <small>내부 재생을 지원하지 않는 링크는 {playlist.provider} 앱이나 웹에서 안전하게 열어요.</small>
                      </a>
                    )}
                    <div className="custom-playlist-actions">
                      <a href={playlist.url} target="_blank" rel="noreferrer">원본에서 열기 ↗</a>
                      <button type="button" onClick={() => shareCustomPlaylist(playlist)}>공유</button>
                      <button className="delete-button" type="button" onClick={() => deleteCustomPlaylist(playlist)}>삭제</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-playlist"><span>♫</span><p>아직 추가한 링크가 없어요. 좋아하는 공부 플레이리스트를 등록해보세요.</p></div>
            )}
          </section>

          <aside className="music-rights-note">
            <strong>음원 이용 안내</strong>
            <p>사이트는 음원을 직접 저장하거나 배포하지 않고 공식 Spotify 플레이어로 연결합니다. “저작권 안전”은 저작권이 없다는 뜻이 아니며, 영상·방송 등에 다시 사용할 때는 각 곡과 제작자의 최신 이용 조건 및 표기 방법을 반드시 확인하세요.</p>
          </aside>
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
                      <button className="edit-button" onClick={() => startEditingPlan(savedPlan)}>수정</button>
                      <button className="share-button" onClick={() => shareSavedPlan(savedPlan)}>공유</button>
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
              <button className="ghost-button" onClick={() => window.print()}>인쇄 · PDF</button>
              <button className="ghost-button" onClick={() => exportIcs(false)}>캘린더 ICS</button>
              {!isCommunityImportedPlan && (
                <button className={`ghost-button ${hasSharedActivePlan ? "shared" : ""}`} onClick={shareCurrentPlan} disabled={hasSharedActivePlan}>
                  {hasSharedActivePlan ? "✓ 커뮤니티 게시 완료" : "커뮤니티에 공유"}
                </button>
              )}
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
                  {item.guideTip && <small>가이드 적용 · {item.guideTip}</small>}
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

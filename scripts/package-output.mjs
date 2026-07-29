import { cp, mkdir, copyFile, rm, writeFile } from "node:fs/promises";

await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });

await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
await writeFile(
  "dist/server/index.js",
  `const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function collectSources(response) {
  const sources = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        const citation = annotation.url_citation || annotation;
        if (citation.url && !sources.some((source) => source.url === citation.url)) {
          sources.push({ url: citation.url, title: citation.title || "" });
        }
      }
    }
  }
  return sources.slice(0, 5);
}

async function answerQuestion(request, env) {
  if (!env?.OPENAI_API_KEY) {
    return json(
      { error: "인터넷 답변 기능을 사용하려면 사이트에 OPENAI_API_KEY를 등록해야 해요." },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "질문 형식이 올바르지 않아요." }, 400);
  }

  const question = String(body.question || "").trim();
  const subject = String(body.subject || "일반").trim().slice(0, 80);
  const range = String(body.range || "").trim().slice(0, 500);
  const grade = String(body.grade || "").trim().slice(0, 30);

  if (!question) return json({ error: "질문을 입력해주세요." }, 400);
  if (question.length > 1000) return json({ error: "질문은 1,000자 이내로 입력해주세요." }, 400);

  const prompt = \`너는 한국 학생을 위한 정확하고 친절한 과목별 질문 답변 코치다.
선택된 공부 과목: \${subject}
학생 학년: \${grade || "미지정"}
공부 범위: \${range || "미지정"}

학생이 묻는 내용에 직접 답하라. 공부 습관이나 동기부여 조언으로 질문을 회피하지 마라.
- 먼저 질문 자체의 실제 과목을 판별하라. 질문 내용과 선택된 공부 과목이 다르면 질문 내용을 우선하고, 선택 과목을 억지로 연결하지 마라.
- 수학: 필요한 공식의 이름과 식, 기호의 뜻, 적용 조건을 먼저 제시하고 풀이 방향을 단계별로 설명한다.
- 역사/한국사: 인물·사건의 시대, 핵심 사실, 원인과 영향 또는 의의를 설명한다.
- 과학: 핵심 개념, 원리, 인과관계와 적절한 예시를 설명한다.
- 국어/영어/사회 및 기타 과목: 질문에 맞는 개념, 근거, 예시를 제시한다.
- 최신 정보나 사실 확인이 필요한 내용은 웹 검색 결과를 근거로 답한다.
- 학생의 학년 수준에 맞는 한국어를 사용한다.
- 확실하지 않은 내용은 추측하지 말고 불확실성을 밝힌다.
- 답변은 핵심부터 시작하고, 보통 3~7개의 짧은 문단이나 단계로 작성한다.
- 웹에서 확인한 사실에는 제공되는 출처 인용을 유지한다.\`;

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: \`Bearer \${env.OPENAI_API_KEY}\`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-5.6-luna",
      reasoning: { effort: "low" },
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      input: [
        { role: "system", content: [{ type: "input_text", text: prompt }] },
        { role: "user", content: [{ type: "input_text", text: question }] },
      ],
      text: { verbosity: "medium" },
    }),
  });

  const response = await apiResponse.json();
  if (!apiResponse.ok) {
    console.error("OpenAI response error", apiResponse.status, response?.error?.code);
    return json({ error: "인터넷 자료를 확인하는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." }, 502);
  }

  const answer =
    response.output_text ||
    response.output
      ?.flatMap((item) => item.content || [])
      .filter((content) => content.type === "output_text")
      .map((content) => content.text)
      .join("\\n");

  if (!answer) return json({ error: "답변을 만들지 못했어요. 질문을 조금 더 구체적으로 적어주세요." }, 502);
  return json({ answer, sources: collectSources(response) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ads.txt") {
      return new Response(
        "google.com, pub-3450079984401603, DIRECT, f08c47fec0942fa0\\n",
        {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }
      );
    }
    if (url.pathname === "/api/coach") {
      if (request.method !== "POST") return json({ error: "POST 요청만 지원해요." }, 405);
      return answerQuestion(request, env);
    }
    if (env?.ASSETS?.fetch) {
      const assetUrl = new URL(url);
      if (assetUrl.pathname === "/") {
        assetUrl.pathname = "/index.html";
      } else if (!assetUrl.pathname.includes(".")) {
        assetUrl.pathname = \`\${assetUrl.pathname.replace(/\\/$/, "")}.html\`;
      }
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }
    return new Response("Study planner is ready.", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
`,
  "utf8"
);

// Sites validates the worker entrypoint at dist/server/index.js inside the
// uploaded archive, while static assets must remain at the archive root.
await mkdir("dist/dist/server", { recursive: true });
await copyFile("dist/server/index.js", "dist/dist/server/index.js");

// Sites/vinext archives serve browser assets from .output/public and execute
// the worker at .output/server/index.js.
await rm(".output", { recursive: true, force: true });
await mkdir(".output/server", { recursive: true });
await mkdir(".output/public", { recursive: true });
await copyFile("dist/server/index.js", ".output/server/index.js");
await cp("dist", ".output/public", { recursive: true });

// Cloudflare Pages' Next.js static-export preset publishes from `out`.
// Mirror the verified static export there while preserving `dist` for Sites.
await rm("out", { recursive: true, force: true });
await cp("dist", "out", { recursive: true });

// Cloudflare's regular Next.js Pages preset publishes this directory.
await rm(".vercel/output/static", { recursive: true, force: true });
await mkdir(".vercel/output/static", { recursive: true });
await cp("dist", ".vercel/output/static", { recursive: true });

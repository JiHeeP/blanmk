// AI 대화 연습 API (Vercel Serverless Function) — OpenAI Responses API 사용
// POST /api/chat  { lang: "zh" | "ru" | "en", messages: [{ role, content }] }
// OPENAI_API_KEY 가 없으면 503 을 돌려주고, 프런트는 대화 탭만 비활성화한다.
//
// 모델: 기본 gpt-5.6-luna (저가·저지연 채팅용, 2026-07-30 기준 $0.20/$1.20 per 1M 토큰).
//       OPENAI_MODEL 환경변수로 바꿀 수 있고, 모델을 못 찾으면 gpt-5-mini 로 자동 대체한다.

import OpenAI from "openai";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const FALLBACK_MODEL = "gpt-5-mini";

const LANG_PROFILES = {
  zh: {
    name: "중국어(普通话)",
    level:
      "학습자는 Duolingo 중국어 6단계 수준(HSK 1~2, 초급)이다. HSK 2 이하 어휘와 짧고 단순한 문장만 사용하라. 모든 중국어 문장 뒤에 괄호로 병음을 붙여라.",
  },
  ru: {
    name: "러시아어",
    level:
      "학습자는 Duolingo 러시아어 10단계 수준(A1~A2, 초급)이다. 기본 격변화와 현재·과거 시제 위주로, 한 문장을 8단어 이내로 짧게 말하라.",
  },
  en: {
    name: "영어",
    level:
      "학습자는 영어 중급(B1~B2)이다. 자연스러운 일상 영어를 쓰되, 어려운 관용구를 쓰면 짧게 풀어 설명하라.",
  },
};

function buildInstructions(lang) {
  const p = LANG_PROFILES[lang];
  return `당신은 한국 초등학교 교사의 ${p.name} 회화 연습 상대이자 친절한 튜터다.
${p.level}

대화 주제는 주로 교실·학생·학부모 소통 상황(수업 안내, 격려, 생활지도, 학부모 상담)이지만, 학습자가 원하는 어떤 주제든 따라간다.

응답 형식(반드시 지켜라):
1. 먼저 ${p.name}로 자연스럽게 답한다. 2~3문장 이내.
2. 줄을 바꾸고 "🇰🇷 " 뒤에 그 답의 한국어 번역을 붙인다.
3. 학습자의 직전 메시지에 문법·어휘 오류가 있었다면, 줄을 바꾸고 "✏️ " 뒤에 한국어로 한 줄 교정을 붙인다. 오류가 없으면 이 줄은 생략한다.
4. 마지막 줄에 학습자가 이어서 말할 수 있는 짧은 질문을 ${p.name}로 던진다.

마크다운 제목이나 목록은 쓰지 말고 평문으로 답한다.`;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-20) // 최근 20턴만 보내 비용을 억제
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

async function ask(client, model, lang, input, withReasoning) {
  const params = {
    model,
    instructions: buildInstructions(lang),
    input,
    max_output_tokens: 600,
  };
  // GPT-5 계열은 기본 추론량이 많아 느리고 비싸진다. 채팅에는 낮게 잡는다.
  if (withReasoning) params.reasoning = { effort: "low" };
  return client.responses.create(params);
}

function isModelNotFound(err) {
  if (!(err instanceof OpenAI.APIError)) return false;
  const msg = String(err.message || "").toLowerCase();
  return err.status === 404 || err.code === "model_not_found" || msg.includes("model");
}

function isReasoningRejected(err) {
  if (!(err instanceof OpenAI.APIError) || err.status !== 400) return false;
  return String(err.message || "").toLowerCase().includes("reasoning");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "no_api_key" });
  }

  const { lang, messages } = req.body || {};
  if (!LANG_PROFILES[lang]) {
    return res.status(400).json({ error: "bad_lang" });
  }
  const clean = sanitizeMessages(messages);
  if (clean.length === 0 || clean[clean.length - 1].role !== "user") {
    return res.status(400).json({ error: "bad_messages" });
  }

  const client = new OpenAI();
  let model = DEFAULT_MODEL;
  let withReasoning = true;

  try {
    let response;
    try {
      response = await ask(client, model, lang, clean, withReasoning);
    } catch (err) {
      if (isReasoningRejected(err)) {
        withReasoning = false;
        response = await ask(client, model, lang, clean, withReasoning);
      } else if (model !== FALLBACK_MODEL && isModelNotFound(err)) {
        model = FALLBACK_MODEL;
        response = await ask(client, model, lang, clean, withReasoning);
      } else {
        throw err;
      }
    }

    const text = (response.output_text || "").trim();
    return res.status(200).json({ reply: text || "(빈 응답)", model });
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) {
      return res.status(503).json({ error: "bad_api_key" });
    }
    if (err instanceof OpenAI.RateLimitError) {
      const msg = String(err.message || "").toLowerCase();
      // 잔액 부족도 429 로 온다.
      return res.status(429).json({ error: msg.includes("quota") || msg.includes("billing") ? "no_credit" : "rate_limited" });
    }
    if (err instanceof OpenAI.APIConnectionError) {
      return res.status(502).json({ error: "upstream_unreachable" });
    }
    if (err instanceof OpenAI.APIError) {
      console.error("openai error", err.status, err.message);
      return res.status(502).json({ error: "upstream_error", detail: err.message });
    }
    console.error("chat error", err);
    return res.status(500).json({ error: "server_error" });
  }
}

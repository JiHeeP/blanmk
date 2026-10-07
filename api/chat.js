// AI 대화 연습 API (Vercel Serverless Function) — OpenAI Responses API 사용
// POST /api/chat  { lang: "zh" | "ru" | "en", messages: [{ role, content }] }
// OPENAI_API_KEY 가 없으면 503 을 돌려주고, 프런트는 대화 탭만 비활성화한다.
//
// 모델: 기본 gpt-5.6-luna (저가·저지연 채팅용, 2026-07-30 기준 $0.20/$1.20 per 1M 토큰).
//       OPENAI_MODEL 환경변수로 바꿀 수 있고, 모델을 못 찾으면 gpt-5-mini 로 자동 대체한다.

import { createResponse, mapOpenAIError } from "../lib/openai.js";

// 수준은 일부러 낮게 잡는다: 짧은 문장, 아주 쉬운 단어, 한 번에 1~2문장.
const LANG_PROFILES = {
  zh: {
    name: "중국어",
    level: `학습자는 중국어 완전 초급(HSK 1)이고 한자를 읽지 못한다.
- 중국어는 반드시 성조 표시가 있는 병음(예: Nǐ hǎo!)으로만 쓴다. 한자는 '🔊' 줄에만 쓴다.
- HSK 1 수준의 아주 쉬운 단어만, 한 문장 6단어 이내.
- 학습자는 병음을 성조 없이 치거나(ni hao) 한국어로 쓸 수 있다. 뜻을 짐작해 받아 준다.`,
    lines: `1줄: 병음으로 쓴 답 (1~2문장, 마지막은 아주 쉬운 질문)
2줄: "🇰🇷 " 뒤에 한국어 번역
3줄(오류가 있을 때만): "✏️ " 뒤에 한국어로 한 줄 교정, 바른 표현은 병음으로
마지막 줄: "🔊 " 뒤에 1줄과 같은 내용을 한자로 (듣기용, 화면에는 안 보임)`,
  },
  ru: {
    name: "러시아어",
    level: `학습자는 러시아어 입문자로 키릴 문자를 막 익히는 중이다(A1 이하).
- 아주 흔하고 짧은 단어만 쓴다(예: да, нет, я, ты, мама, дом, школа, хорошо, привет, спасибо).
- 한 문장 5단어 이내, 현재 시제 위주, 어려운 격변화는 피한다.
- 학습자가 한국어로 써도 받아 주고, 러시아어로 어떻게 말하는지 보여 준다.`,
    lines: `1줄: 러시아어 답 (1~2문장, 마지막은 아주 쉬운 질문)
2줄: "🔤 " 뒤에 1줄의 라틴 문자 발음 표기, 강세 모음에 ´ 표시 (예: Privét! Kak delá?)
3줄: "🇰🇷 " 뒤에 한국어 번역
4줄(오류가 있을 때만): "✏️ " 뒤에 한국어로 한 줄 교정`,
  },
  en: {
    name: "영어",
    level: `학습자는 영어 중급이지만 회화는 편하게 하고 싶다(A2~B1).
- 쉬운 일상 단어만, 한 문장 10단어 이내. 관용구와 어려운 단어는 쓰지 않는다.`,
    lines: `1줄: 영어 답 (1~2문장, 마지막은 쉬운 질문)
2줄: "🇰🇷 " 뒤에 한국어 번역
3줄(오류가 있을 때만): "✏️ " 뒤에 한국어로 한 줄 교정과 바른 영어 문장`,
  },
};

function buildInstructions(lang) {
  const p = LANG_PROFILES[lang];
  return `당신은 한국 초등학교 교사의 ${p.name} 회화 연습 상대이자 친절한 튜터다.
${p.level}

대화 주제는 인사, 자기소개, 학교와 교실 생활처럼 쉬운 것부터 시작하고, 학습자가 원하는 주제를 따라간다.
학습자가 어려워하면 더 짧고 쉽게 말한다. 절대 길게 설명하지 않는다.

응답 형식(반드시 이 줄 순서만 지켜라):
${p.lines}

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

  try {
    // GPT-5 계열은 기본 추론량이 많아 느리고 비싸진다. 채팅에는 낮게 잡는다.
    const { response, model } = await createResponse(
      { instructions: buildInstructions(lang), input: clean, max_output_tokens: 600 },
      { reasoningEffort: "low" }
    );
    const text = (response.output_text || "").trim();
    return res.status(200).json({ reply: text || "(빈 응답)", model });
  } catch (err) {
    const { status, body } = mapOpenAIError(err);
    return res.status(status).json(body);
  }
}

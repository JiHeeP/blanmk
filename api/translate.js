// 한영 병기 번역·정리 API (Vercel Serverless Function) — OpenAI Responses API + JSON 스키마 출력
// POST /api/translate  { text: string, tone: "auto"|"formal"|"plain", vocab: boolean }
// 응답: { doc: { title_ko, title_en, sections:[{heading_ko, heading_en, pairs:[{ko,en}]}], vocab:[{ko,en,note}] }, model }

import { createResponse, mapOpenAIError } from "../lib/openai.js";

const MAX_CHARS = 6000;

const TONES = {
  auto: "원문의 문체를 그대로 따른다.",
  formal: "학부모 안내문에 맞는 정중한 격식체로 쓴다. 한국어는 '-습니다/-ㅂ니다'체, 영어는 정중하고 공식적인 문체.",
  plain: "학생도 이해하기 쉬운 쉬운 말로 쓴다. 한국어는 '-해요'체, 영어는 짧고 쉬운 문장.",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title_ko", "title_en", "sections", "vocab"],
  properties: {
    title_ko: { type: "string" },
    title_en: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading_ko", "heading_en", "pairs"],
        properties: {
          heading_ko: { type: "string" },
          heading_en: { type: "string" },
          pairs: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["ko", "en"],
              properties: { ko: { type: "string" }, en: { type: "string" } },
            },
          },
        },
      },
    },
    vocab: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ko", "en", "note"],
        properties: { ko: { type: "string" }, en: { type: "string" }, note: { type: "string" } },
      },
    },
  },
};

function buildInstructions(tone, withVocab) {
  return `당신은 한국 초등학교 교사를 돕는 전문 번역가이자 편집자다.
사용자가 준 원문을 '한국어-영어 병기 문서'로 정리해 JSON 으로만 답한다.

번역 규칙:
- 원문이 한국어면 영어로, 영어면 한국어로 번역해 ko/en 쌍을 만든다. 두 언어가 섞여 있어도 모든 쌍의 ko 와 en 을 모두 채운다.
- 내용을 빠뜨리거나 지어내지 않는다. 날짜·요일·시간·금액·전화번호·사람 이름·장소는 원문 그대로 정확히 옮긴다.
- 영어는 학부모와 학생이 읽기 쉬운 평이한 영어(CEFR B1 수준)로 쓴다. 한국 학교 고유 용어(예: 방과후학교, 돌봄교실)는 영어로 풀어 쓰고 필요하면 괄호에 로마자 표기를 덧붙인다.
- 문체: ${TONES[tone]}
- 문체가 '원문 그대로'일 때 한국어 쪽은 원문 문장을 최대한 유지하고 맞춤법·띄어쓰기 오류만 고친다.

정리 규칙:
- title_ko/title_en: 문서 전체 제목. 원문에 제목이 없으면 내용을 요약한 짧은 제목을 만든다.
- sections: 원문의 흐름에 따라 1~6개 묶음으로 나누고 각 묶음에 짧은 제목(heading)을 붙인다. 원문이 짧아 나눌 필요가 없으면 섹션 1개에 heading 은 빈 문자열로 둔다.
- pairs: 한 쌍은 1~2문장. 너무 긴 문장은 자연스럽게 나눈다. 목록 항목은 항목 하나를 한 쌍으로 만든다.
- vocab: ${withVocab ? "학부모·학생이 알아 두면 좋은 핵심 어휘 5~10개. ko=한국어 단어, en=영어 대응어, note=한 줄 설명(한국어)." : "빈 배열 [] 로 둔다."}`;
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

// 모델 출력이 스키마와 조금 달라도 화면이 깨지지 않게 정리한다.
function normalizeDoc(raw) {
  const sections = (Array.isArray(raw?.sections) ? raw.sections : [])
    .map((s) => ({
      heading_ko: str(s?.heading_ko),
      heading_en: str(s?.heading_en),
      pairs: (Array.isArray(s?.pairs) ? s.pairs : [])
        .map((p) => ({ ko: str(p?.ko), en: str(p?.en) }))
        .filter((p) => p.ko || p.en),
    }))
    .filter((s) => s.pairs.length > 0);
  const vocab = (Array.isArray(raw?.vocab) ? raw.vocab : [])
    .map((v) => ({ ko: str(v?.ko), en: str(v?.en), note: str(v?.note) }))
    .filter((v) => v.ko || v.en);
  return { title_ko: str(raw?.title_ko), title_en: str(raw?.title_en), sections, vocab };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1));
    throw new Error("not json");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "no_api_key" });
  }

  const { text, tone = "auto", vocab = true } = req.body || {};
  const source = typeof text === "string" ? text.trim() : "";
  if (!source) return res.status(400).json({ error: "empty_text" });
  if (source.length > MAX_CHARS) return res.status(400).json({ error: "too_long", max: MAX_CHARS });
  if (!TONES[tone]) return res.status(400).json({ error: "bad_tone" });

  try {
    const { response, model } = await createResponse(
      {
        instructions: buildInstructions(tone, Boolean(vocab)),
        input: source,
        max_output_tokens: 16000,
        text: { format: { type: "json_schema", name: "bilingual_document", schema: SCHEMA, strict: true } },
      },
      { reasoningEffort: "low" }
    );

    if (response.status === "incomplete") {
      return res.status(422).json({ error: "output_truncated" });
    }

    let doc;
    try {
      doc = normalizeDoc(parseJson(response.output_text || ""));
    } catch {
      return res.status(502).json({ error: "bad_model_output" });
    }
    if (doc.sections.length === 0) {
      return res.status(502).json({ error: "bad_model_output" });
    }
    return res.status(200).json({ doc, model });
  } catch (err) {
    const { status, body } = mapOpenAIError(err);
    return res.status(status).json(body);
  }
}

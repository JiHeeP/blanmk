// OpenAI 호출 공용 모듈. api/chat.js, api/translate.js 가 같이 쓴다.
// - 기본 모델: gpt-5.6-luna (OPENAI_MODEL 로 변경 가능)
// - 모델을 못 찾으면 gpt-5-mini 로 한 번 자동 재시도
// - reasoning 파라미터를 거부하는 모델이면 빼고 한 번 재시도
import OpenAI from "openai";

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
export const FALLBACK_MODEL = "gpt-5-mini";

function isModelNotFound(err) {
  if (!(err instanceof OpenAI.APIError)) return false;
  const msg = String(err.message || "").toLowerCase();
  return err.status === 404 || err.code === "model_not_found" || (err.status === 400 && msg.includes("model"));
}

function isReasoningRejected(err) {
  if (!(err instanceof OpenAI.APIError) || err.status !== 400) return false;
  return String(err.message || "").toLowerCase().includes("reasoning");
}

// params 에 model 을 넣지 않으면 DEFAULT_MODEL 을 쓴다. { response, model } 을 돌려준다.
export async function createResponse(params, { reasoningEffort = "low" } = {}) {
  const client = new OpenAI();
  let model = params.model || DEFAULT_MODEL;
  let withReasoning = Boolean(reasoningEffort);

  const call = () =>
    client.responses.create({
      ...params,
      model,
      ...(withReasoning ? { reasoning: { effort: reasoningEffort } } : {}),
    });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return { response: await call(), model };
    } catch (err) {
      if (withReasoning && isReasoningRejected(err)) {
        withReasoning = false;
        continue;
      }
      if (model !== FALLBACK_MODEL && isModelNotFound(err)) {
        model = FALLBACK_MODEL;
        continue;
      }
      throw err;
    }
  }
  return { response: await call(), model };
}

// SDK 오류를 { status, body } 로 바꾼다. 프런트는 body.error 코드로 안내 문구를 고른다.
export function mapOpenAIError(err) {
  if (err instanceof OpenAI.AuthenticationError) {
    return { status: 503, body: { error: "bad_api_key" } };
  }
  if (err instanceof OpenAI.RateLimitError) {
    const msg = String(err.message || "").toLowerCase();
    // 잔액 부족도 429 로 온다.
    const noCredit = msg.includes("quota") || msg.includes("billing");
    return { status: 429, body: { error: noCredit ? "no_credit" : "rate_limited" } };
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return { status: 502, body: { error: "upstream_unreachable" } };
  }
  if (err instanceof OpenAI.APIError) {
    console.error("openai error", err.status, err.message);
    return { status: 502, body: { error: "upstream_error", detail: err.message } };
  }
  console.error("server error", err);
  return { status: 500, body: { error: "server_error" } };
}

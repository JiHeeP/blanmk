import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LANGUAGES, getSystemPrompt } from "../public/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const API_URL = "https://api.moonshot.ai/v1/chat/completions";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

class RetryableApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "RetryableApiError";
    this.status = status;
  }
}

export function getRuntimeConfig() {
  return {
    model: process.env.MOONSHOT_MODEL || "kimi-k2.5",
    temperature: Number(process.env.MOONSHOT_TEMPERATURE || 1),
    logsDir: path.join(projectRoot, process.env.LOG_DIR || "logs"),
    moonshotConfigured: Boolean(process.env.MOONSHOT_API_KEY),
    runningOnVercel: Boolean(process.env.VERCEL),
  };
}

export function getHealthPayload() {
  const config = getRuntimeConfig();

  return {
    ok: true,
    app: "terrain-explorer-chatbot",
    model: config.model,
    moonshotConfigured: config.moonshotConfigured,
    loggingMode: config.runningOnVercel ? "console" : "file",
    timestamp: new Date().toISOString(),
  };
}

export async function processChatRequest(body, meta = {}) {
  const config = getRuntimeConfig();
  const lang = typeof body?.lang === "string" ? body.lang : "ko";
  const terrain = typeof body?.terrain === "string" ? body.terrain : "mountain";
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim().slice(0, 120)
      : "anonymous";

  if (!config.moonshotConfigured) {
    throw new HttpError(
      500,
      "MOONSHOT_API_KEY가 없습니다. 루트 폴더의 .env 파일에 API 키를 넣어 주세요.",
    );
  }

  if (!LANGUAGES.some((item) => item.code === lang)) {
    throw new HttpError(400, "지원하지 않는 언어입니다.");
  }

  if (!messages.length) {
    throw new HttpError(400, "보낼 대화 내용이 없습니다.");
  }

  const normalizedMessages = messages
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim(),
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

  if (!normalizedMessages.length) {
    throw new HttpError(400, "유효한 대화 내용이 없습니다.");
  }

  const reply = await callMoonshot(
    {
      model: config.model,
      temperature: config.temperature,
      messages: [
        { role: "system", content: getSystemPrompt(lang, terrain) },
        ...normalizedMessages,
      ],
    },
    { lang },
  );

  const logEntry = {
    sessionId,
    lang,
    terrain,
    model: config.model,
    temperature: config.temperature,
    userAgent: meta.userAgent || "",
    remoteAddress: meta.remoteAddress || "",
    messages: normalizedMessages,
    reply,
    createdAt: new Date().toISOString(),
  };

  await writeChatLog(logEntry, config).catch((error) => {
    console.error("채팅 로그 저장에 실패했습니다.", error);
  });

  return {
    message: reply,
  };
}

async function callMoonshot(payload, options = {}) {
  const lang = typeof options.lang === "string" ? options.lang : "ko";
  const retries = [0, 1000, 2000, 4000];
  let lastError;

  for (const delay of retries) {
    if (delay) {
      await wait(delay);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      let response;
      try {
        response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage =
          data?.error?.message ||
          data?.message ||
          "Kimi 2.5 API request failed.";

        if (isRetryableStatus(response.status)) {
          console.error("[moonshot] retryable upstream error", {
            status: response.status,
            errorMessage,
          });
          throw new RetryableApiError(response.status, errorMessage);
        }

        throw new HttpError(response.status, errorMessage);
      }

      const content = data?.choices?.[0]?.message?.content;

      if (typeof content === "string" && content.trim()) {
        return content.trim();
      }

      if (Array.isArray(content)) {
        const joined = content
          .map((item) => (typeof item?.text === "string" ? item.text : ""))
          .join("")
          .trim();

        if (joined) {
          return joined;
        }
      }

      throw new Error("Kimi 2.5 returned an empty response.");
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) {
        throw error;
      }

      lastError = error;
    }
  }

  if (lastError instanceof RetryableApiError) {
    console.error("[moonshot] upstream busy after retries", {
      status: lastError.status,
      errorMessage: lastError.message,
    });
    throw new HttpError(503, getTemporaryErrorMessage(lang));
  }

  if (lastError instanceof Error) {
    console.error("[moonshot] request failed after retries", {
      name: lastError.name,
      errorMessage: lastError.message,
    });
    throw new HttpError(503, getTemporaryErrorMessage(lang));
  }

  throw new HttpError(503, getTemporaryErrorMessage(lang));
}

async function writeChatLog(entry, config) {
  if (config.runningOnVercel) {
    console.log(`[chat-log] ${JSON.stringify(entry)}`);
    return;
  }

  await mkdir(config.logsDir, { recursive: true });
  const day = entry.createdAt.slice(0, 10);
  const filePath = path.join(config.logsDir, `chat-${day}.jsonl`);
  await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

function getTemporaryErrorMessage(langCode) {
  if (langCode === "zh") {
    return "AI 服务器暂时繁忙，请稍后再试。";
  }

  if (langCode === "ru") {
    return "Сервис ИИ временно перегружен. Пожалуйста, попробуйте позже.";
  }

  return "AI 서버가 잠시 바쁩니다. 잠시 후 다시 시도해 주세요.";
}

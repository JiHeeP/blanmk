// 로컬 실행용 간단 서버. Vercel 없이 `node server.js` 로 띄운다.
// public/ 정적 파일 + /api/chat 을 그대로 흉내 낸다.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chatHandler from "./api/chat.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, "public");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// Vercel 의 res.status().json() 형태를 흉내 낸다.
function vercelify(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  };
  return res;
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/chat") {
      req.body = await readJsonBody(req);
      return chatHandler(req, vercelify(res));
    }

    let filePath = path.join(PUBLIC, decodeURIComponent(url.pathname));
    if (!filePath.startsWith(PUBLIC)) {
      res.writeHead(403);
      return res.end();
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC, "index.html");
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`Trilingo: http://localhost:${PORT}`);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("ANTHROPIC_API_KEY 없음 → AI 대화 기능은 꺼진 상태로 실행됩니다.");
    }
  });

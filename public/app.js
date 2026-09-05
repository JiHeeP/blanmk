/* Trilingo 메인 앱. 해시 라우팅 (#home, #study/zh, #quiz/zh, #chat/zh, #words/zh, #settings) */
(function () {
  const LANGS = {
    zh: { name: "중국어", flag: "🇨🇳", tts: "zh-CN", level: "HSK 1~2 · 듀오링고 6단계" },
    ru: { name: "러시아어", flag: "🇷🇺", tts: "ru-RU", level: "A1~A2 · 듀오링고 10단계" },
    en: { name: "영어", flag: "🇬🇧", tts: "en-US", level: "B1~B2 · 중급" },
  };
  const LANG_KEYS = Object.keys(LANGS);
  const $app = document.getElementById("app");
  const $sync = document.getElementById("sync-status");

  // ---------- 유틸 ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const vocab = (lang) => window.VOCAB[lang] || [];
  const findWord = (lang, id) => vocab(lang).find((w) => w.id === id);

  function speak(text, lang) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANGS[lang].tts;
    u.rate = 0.9;
    const voices = speechSynthesis.getVoices();
    const prefix = LANGS[lang].tts.split("-")[0];
    const v = voices.find((x) => x.lang.replace("_", "-") === LANGS[lang].tts) || voices.find((x) => x.lang.toLowerCase().startsWith(prefix));
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  if ("speechSynthesis" in window) speechSynthesis.getVoices();

  // ---------- 학습 큐 계산 ----------
  function counts(lang) {
    const now = Date.now();
    const words = vocab(lang);
    let due = 0, seen = 0, known = 0;
    for (const w of words) {
      const c = Store.getCard(lang, w.id);
      if (c && c.seen) {
        seen += 1;
        if (SRS.isDue(c, now)) due += 1;
        if (SRS.status(c) === "known") known += 1;
      }
    }
    const log = Store.todayLog(lang);
    const newLeft = Math.max(0, (Store.state.settings.newPerDay || 5) - (log.new || 0));
    const newAvail = words.length - seen;
    return { due, seen, known, total: words.length, newLeft: Math.min(newLeft, newAvail), todayNew: log.new || 0, todayReview: log.review || 0 };
  }

  function buildQueue(lang) {
    const now = Date.now();
    const words = vocab(lang);
    const due = words
      .map((w) => ({ w, c: Store.getCard(lang, w.id) }))
      .filter(({ c }) => SRS.isDue(c, now))
      .sort((a, b) => a.c.due - b.c.due)
      .map(({ w }) => ({ word: w, isNew: false }));
    const { newLeft } = counts(lang);
    const fresh = words.filter((w) => !Store.getCard(lang, w.id)?.seen).slice(0, newLeft).map((w) => ({ word: w, isNew: true }));
    return [...due, ...fresh];
  }

  // ---------- 라우팅 ----------
  function route() {
    const [path, arg] = location.hash.replace(/^#/, "").split("/");
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === (path || "home")));
    window.scrollTo(0, 0);
    switch (path) {
      case "study": return renderStudy(arg);
      case "quiz": return renderQuiz(arg);
      case "chat": return renderChat(arg);
      case "words": return renderWords(arg);
      case "settings": return renderSettings();
      default: return renderHome();
    }
  }
  window.addEventListener("hashchange", route);

  // ---------- 홈 ----------
  function renderHome() {
    const streak = Store.streak();
    const tiles = LANG_KEYS.map((lang) => {
      const c = counts(lang);
      const L = LANGS[lang];
      const todayDone = c.due === 0 && c.newLeft === 0;
      return `
        <section class="card lang-tile ${lang}">
          <div class="row">
            <div class="title">${L.flag} ${L.name}</div>
            <div class="meta right">${L.level}</div>
          </div>
          <div class="stats">
            <div class="stat"><b>${c.due}</b><span>복습 대기</span></div>
            <div class="stat"><b>${c.newLeft}</b><span>오늘 새 단어</span></div>
            <div class="stat"><b>${c.seen}/${c.total}</b><span>학습한 단어</span></div>
            <div class="stat"><b>${c.known}</b><span>익힘</span></div>
          </div>
          <div class="row">
            <a class="btn primary" href="#study/${lang}">${todayDone ? "추가 복습" : "오늘 학습"}${c.due + c.newLeft ? ` (${c.due + c.newLeft})` : ""}</a>
            <a class="btn" href="#quiz/${lang}">문장 퀴즈</a>
            <a class="btn" href="#chat/${lang}">AI 대화</a>
            <a class="btn ghost small right" href="#words/${lang}">단어장</a>
          </div>
          ${todayDone ? `<p class="help">✅ 오늘 분량 끝. 퀴즈나 대화로 이어가세요.</p>` : ""}
        </section>`;
    }).join("");

    $app.innerHTML = `
      <h1>오늘의 학습</h1>
      <p class="sub">🔥 연속 ${streak}일 · 언어당 새 단어 ${Store.state.settings.newPerDay}개 + 복습 · 하루 약 30분</p>
      ${tiles}`;
  }

  // ---------- 학습 (플래시카드) ----------
  function renderStudy(lang) {
    if (!LANGS[lang]) return renderHome();
    const L = LANGS[lang];
    let queue = buildQueue(lang);
    const total = queue.length;
    let idx = 0;
    const doneIds = [];

    if (total === 0) {
      $app.innerHTML = `
        <h1>${L.flag} ${L.name}</h1>
        <section class="card">
          <p>지금은 복습할 카드도, 오늘 배울 새 단어도 없어요. 🎉</p>
          <div class="row">
            <a class="btn primary" href="#quiz/${lang}">문장 퀴즈로 다지기</a>
            <a class="btn" href="#chat/${lang}">AI 대화</a>
            <button class="btn ghost" id="extra">새 단어 5개 더</button>
          </div>
        </section>`;
      document.getElementById("extra").onclick = () => {
        Store.state.settings.newPerDay = (Store.state.settings.newPerDay || 5);
        const log = Store.todayLog(lang);
        log.new = Math.max(0, log.new - 5); // 오늘 한도를 5개 늘리는 효과
        Store.save();
        renderStudy(lang);
      };
      return;
    }

    function showCard() {
      if (idx >= queue.length) return showSummary();
      const { word, isNew } = queue[idx];
      $app.innerHTML = `
        <div class="row"><a class="btn ghost small" href="#home">← 홈</a><span class="grow"></span><span class="help">${idx + 1} / ${queue.length}</span></div>
        <div class="progress"><div style="width:${(idx / queue.length) * 100}%"></div></div>
        <section class="card flash" id="flash">
          <div class="topic">${L.flag} ${esc(word.t)} ${isNew ? '<span class="pill new">NEW</span>' : '<span class="pill due">복습</span>'}</div>
          <div class="word">${esc(word.w)} <button class="btn icon small" data-say="${esc(word.w)}" title="듣기">🔊</button></div>
          <div class="reading ${isNew ? "" : "hidden"}" id="reading">${esc(word.r)}</div>
          <div id="back" class="${isNew ? "" : "hidden"}">
            <div class="meaning">${esc(word.m)}</div>
            <div class="example">
              <div>${esc(word.ex)} <button class="btn icon small" data-say="${esc(word.ex)}" title="듣기">🔊</button></div>
              <div class="ko">${esc(word.exKo)}</div>
            </div>
          </div>
        </section>
        <div id="controls">
          ${isNew ? "" : `<button class="btn primary block" id="reveal">답 보기</button>`}
          <div class="grades ${isNew ? "" : "hidden"}" id="grades">
            <button class="btn again" data-q="0">다시<small>10분 후</small></button>
            <button class="btn" data-q="3">어려움<small>${intervalLabel(word, lang, 3)}</small></button>
            <button class="btn" data-q="4">좋음<small>${intervalLabel(word, lang, 4)}</small></button>
            <button class="btn easy" data-q="5">쉬움<small>${intervalLabel(word, lang, 5)}</small></button>
          </div>
        </div>`;

      $app.querySelectorAll("[data-say]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); speak(b.dataset.say, lang); }));
      const reveal = document.getElementById("reveal");
      if (reveal) {
        const open = () => {
          document.getElementById("back").classList.remove("hidden");
          document.getElementById("reading").classList.remove("hidden");
          document.getElementById("grades").classList.remove("hidden");
          reveal.classList.add("hidden");
          speak(word.w, lang);
        };
        reveal.onclick = open;
        document.getElementById("flash").onclick = open;
      } else {
        speak(word.w, lang);
      }
      $app.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => gradeCard(word, isNew, Number(b.dataset.q))));
    }

    function intervalLabel(word, lang, q) {
      const next = SRS.grade(Store.getCard(lang, word.id) || {}, q);
      return next.interval <= 0 ? "10분 후" : `${next.interval}일 후`;
    }

    function gradeCard(word, isNew, q) {
      const prev = Store.getCard(lang, word.id) || {};
      const wasNew = !prev.seen;
      Store.setCard(lang, word.id, SRS.grade(prev, q));
      Store.recordStudy(lang, word.id, wasNew);
      if (!doneIds.includes(word.id)) doneIds.push(word.id);
      if (q < 3) queue.push({ word, isNew: false }); // 틀린 카드는 이번 세션 끝에 다시
      Store.save();
      idx += 1;
      showCard();
    }

    function showSummary() {
      const log = Store.todayLog(lang);
      $app.innerHTML = `
        <h1>${L.flag} ${L.name} 학습 완료</h1>
        <section class="card">
          <div class="stats">
            <div class="stat"><b>${doneIds.length}</b><span>이번 세션</span></div>
            <div class="stat"><b>${log.new}</b><span>오늘 새 단어</span></div>
            <div class="stat"><b>${log.review}</b><span>오늘 복습</span></div>
            <div class="stat"><b>${Store.streak()}</b><span>연속 일</span></div>
          </div>
          <p>방금 본 단어로 문장 퀴즈를 풀면 기억이 더 오래 갑니다.</p>
          <div class="row">
            <a class="btn primary" href="#quiz/${lang}">문장 퀴즈 (${Math.min(10, doneIds.length)}문제)</a>
            <a class="btn" href="#chat/${lang}">AI 대화</a>
            <a class="btn ghost" href="#home">홈</a>
          </div>
        </section>`;
    }

    showCard();
  }

  // ---------- 문장 퀴즈 ----------
  function renderQuiz(lang) {
    if (!LANGS[lang]) return renderHome();
    const L = LANGS[lang];
    const words = vocab(lang);
    const studiedToday = (Store.todayLog(lang).studied || []).map((id) => findWord(lang, id)).filter(Boolean);
    const seen = words.filter((w) => Store.getCard(lang, w.id)?.seen);
    let pool = studiedToday.length >= 4 ? studiedToday : seen.length >= 4 ? seen : words;
    const source = studiedToday.length >= 4 ? "오늘 학습한 단어" : seen.length >= 4 ? "학습한 단어 전체" : "전체 단어";
    const questions = shuffle(pool).slice(0, 10).map((w, i) => ({ w, type: i % 2 === 0 ? "blank" : "translate" }));
    let qi = 0, score = 0;
    const wrong = [];

    function blankSentence(w) {
      const form = w.f || w.w;
      const i = w.ex.indexOf(form);
      if (i < 0) return { html: esc(w.ex), form };
      return { html: `${esc(w.ex.slice(0, i))}<span class="blank">____</span>${esc(w.ex.slice(i + form.length))}`, form };
    }
    function distractors(w, key, n = 3) {
      return shuffle(words.filter((x) => x.id !== w.id)).slice(0, n).map((x) => x[key]);
    }

    function show() {
      if (qi >= questions.length) return summary();
      const { w, type } = questions[qi];
      let questionHtml, hint, choices, answer;
      if (type === "blank") {
        const b = blankSentence(w);
        questionHtml = b.html;
        hint = `뜻: ${esc(w.exKo)}`;
        answer = b.form;
        const alts = shuffle(words.filter((x) => x.id !== w.id)).slice(0, 3).map((x) => x.f || x.w);
        choices = shuffle([answer, ...alts]);
      } else {
        questionHtml = `🇰🇷 ${esc(w.exKo)}`;
        hint = `${L.name}로 알맞은 문장을 고르세요`;
        answer = w.ex;
        choices = shuffle([answer, ...distractors(w, "ex")]);
      }
      $app.innerHTML = `
        <div class="row"><a class="btn ghost small" href="#home">← 홈</a><span class="grow"></span><span class="help">${qi + 1} / ${questions.length} · ${source}</span></div>
        <div class="progress"><div style="width:${(qi / questions.length) * 100}%"></div></div>
        <section class="card quiz">
          <div class="help">${type === "blank" ? "빈칸에 알맞은 말은?" : "번역 고르기"}</div>
          <div class="question">${questionHtml}</div>
          <div class="hint">${hint}</div>
          <div class="choices">
            ${choices.map((c) => `<button class="btn" data-c="${esc(c)}">${esc(c)}</button>`).join("")}
          </div>
          <div id="after" class="hidden" style="margin-top:14px">
            <div id="explain"></div>
            <button class="btn primary block" id="next" style="margin-top:10px">다음</button>
          </div>
        </section>`;
      $app.querySelectorAll("[data-c]").forEach((b) => {
        b.onclick = () => {
          const ok = b.dataset.c === answer;
          $app.querySelectorAll("[data-c]").forEach((x) => {
            x.disabled = true;
            if (x.dataset.c === answer) x.classList.add("correct");
          });
          if (!ok) {
            b.classList.add("wrong");
            wrong.push(w);
            const c = Store.getCard(lang, w.id);
            if (c && c.seen) Store.setCard(lang, w.id, { due: Date.now(), u: Date.now() });
          } else score += 1;
          document.getElementById("explain").innerHTML = `
            <div><b>${esc(w.w)}</b> <span class="help">${esc(w.r)}</span> — ${esc(w.m)}</div>
            <div>${esc(w.ex)} <button class="btn icon small" id="say">🔊</button></div>`;
          document.getElementById("say").onclick = () => speak(w.ex, lang);
          document.getElementById("after").classList.remove("hidden");
          speak(w.ex, lang);
          document.getElementById("next").onclick = () => { qi += 1; show(); };
        };
      });
    }

    function summary() {
      Store.save();
      $app.innerHTML = `
        <h1>${L.flag} 퀴즈 결과</h1>
        <section class="card">
          <div class="stats"><div class="stat"><b>${score}/${questions.length}</b><span>정답</span></div></div>
          ${wrong.length ? `<h2>다시 볼 단어</h2><ul>${wrong.map((w) => `<li><b>${esc(w.w)}</b> ${esc(w.r)} — ${esc(w.m)}</li>`).join("")}</ul><p class="help">틀린 단어는 복습 대기열 맨 앞으로 옮겨졌어요.</p>` : "<p>전부 맞혔어요! 🎉</p>"}
          <div class="row">
            <a class="btn primary" href="#quiz/${lang}" onclick="location.hash='';setTimeout(()=>location.hash='#quiz/${lang}',0);return false;">한 번 더</a>
            <a class="btn" href="#chat/${lang}">AI 대화</a>
            <a class="btn ghost" href="#home">홈</a>
          </div>
        </section>`;
    }

    if (words.length < 4) {
      $app.innerHTML = `<section class="card">단어가 4개 이상 필요해요.</section>`;
      return;
    }
    show();
  }

  // ---------- AI 대화 ----------
  const chatHistory = { zh: [], ru: [], en: [] };
  let chatAvailable = null; // null = 모름, true/false

  function renderChat(lang) {
    if (!LANGS[lang]) return renderHome();
    const L = LANGS[lang];
    const history = chatHistory[lang];
    const starters = {
      zh: ["你好！今天上什么课？", "我想练习和家长说话。", "怎么用汉语说“请安静”？"],
      ru: ["Привет! Какой сегодня урок?", "Я хочу поговорить с родителями ученика.", "Как сказать по-русски «тихо, пожалуйста»?"],
      en: ["Hi! Let's practice a parent-teacher conference.", "How do I gently tell a student to focus?", "Can you correct my sentences as we talk?"],
    };

    $app.innerHTML = `
      <div class="row"><a class="btn ghost small" href="#home">← 홈</a><h1 class="grow" style="margin:0 10px">${L.flag} ${L.name} 대화</h1><button class="btn ghost small" id="clear">지우기</button></div>
      <p class="sub">${L.name}로 말하면 AI가 답하고, 한국어 번역과 교정을 붙여 줘요.</p>
      <div id="notice"></div>
      <section class="card">
        <div class="chat-log" id="log"></div>
        <div class="row" id="starters" style="margin-top:10px"></div>
        <div class="chat-input">
          <textarea id="input" rows="2" placeholder="${L.name}로 입력하세요 (Enter = 보내기, Shift+Enter = 줄바꿈)"></textarea>
          <button class="btn primary" id="send">보내기</button>
        </div>
      </section>`;

    const $log = document.getElementById("log");
    const $input = document.getElementById("input");
    const $send = document.getElementById("send");
    const $notice = document.getElementById("notice");
    const $starters = document.getElementById("starters");

    function paint() {
      $log.innerHTML = history.length
        ? history.map((m) => `<div class="msg ${m.role === "user" ? "user" : "ai"}">${esc(m.content)}${m.role === "assistant" ? ` <button class="btn icon small" data-say="${esc(firstLine(m.content))}">🔊</button>` : ""}</div>`).join("")
        : `<div class="msg sys">아래 예시를 누르거나 직접 입력해 보세요.</div>`;
      $log.querySelectorAll("[data-say]").forEach((b) => (b.onclick = () => speak(b.dataset.say, lang)));
      $log.scrollTop = $log.scrollHeight;
      $starters.innerHTML = history.length ? "" : starters[lang].map((s) => `<button class="btn small" data-s="${esc(s)}">${esc(s)}</button>`).join("");
      $starters.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => send(b.dataset.s)));
    }
    const firstLine = (t) => t.split("\n").find((l) => l.trim() && !l.startsWith("🇰🇷") && !l.startsWith("✏️")) || t;

    function setUnavailable(reason) {
      chatAvailable = false;
      $notice.innerHTML = `<div class="notice">🔑 AI 대화는 아직 꺼져 있어요. ${reason}<br>Vercel → Settings → Environment Variables 에 <b>ANTHROPIC_API_KEY</b> 를 넣고 다시 배포하면 켜집니다. (README 참고)</div>`;
      $send.disabled = true;
      $input.disabled = true;
    }

    async function send(text) {
      text = (text || $input.value).trim();
      if (!text) return;
      $input.value = "";
      history.push({ role: "user", content: text });
      paint();
      $send.disabled = true;
      const thinking = document.createElement("div");
      thinking.className = "msg sys";
      thinking.textContent = "생각 중…";
      $log.appendChild(thinking);
      $log.scrollTop = $log.scrollHeight;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang, messages: history }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 503) {
          history.pop();
          return setUnavailable(data.error === "bad_api_key" ? "API 키가 잘못됐어요." : "API 키가 설정되지 않았어요.");
        }
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        chatAvailable = true;
        history.push({ role: "assistant", content: data.reply });
        speak(firstLine(data.reply), lang);
      } catch (e) {
        history.push({ role: "assistant", content: `(오류: ${e.message}) 잠시 후 다시 시도해 주세요.` });
      } finally {
        $send.disabled = false;
        paint();
        $input.focus();
      }
    }

    $send.onclick = () => send();
    $input.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    };
    document.getElementById("clear").onclick = () => { history.length = 0; paint(); };
    if (chatAvailable === false) setUnavailable("API 키가 설정되지 않았어요.");
    paint();
  }

  // ---------- 단어장 ----------
  function renderWords(lang) {
    if (!LANGS[lang]) return renderHome();
    const L = LANGS[lang];
    const words = vocab(lang);
    const topics = Array.from(new Set(words.map((w) => w.t)));
    let filter = "all";
    function paint() {
      const rows = words.filter((w) => filter === "all" || w.t === filter || SRS.status(Store.getCard(lang, w.id)) === filter);
      $app.innerHTML = `
        <div class="row"><a class="btn ghost small" href="#home">← 홈</a><h1 class="grow" style="margin:0 10px">${L.flag} ${L.name} 단어장</h1></div>
        <div class="filter">
          ${[["all", "전체"], ["new", "안 배움"], ["learning", "학습 중"], ["known", "익힘"], ...topics.map((t) => [t, t])]
            .map(([k, label]) => `<button class="btn small ${filter === k ? "primary" : ""}" data-f="${esc(k)}">${esc(label)}</button>`).join("")}
        </div>
        <section class="card" style="overflow-x:auto">
          <table class="words">
            <thead><tr><th>단어</th><th>뜻</th><th>예문</th><th>상태</th></tr></thead>
            <tbody>
              ${rows.map((w) => {
                const st = SRS.status(Store.getCard(lang, w.id));
                const pill = st === "new" ? '<span class="pill new">안 배움</span>' : st === "known" ? '<span class="pill ok">익힘</span>' : '<span class="pill">학습 중</span>';
                return `<tr>
                  <td><b>${esc(w.w)}</b> <button class="btn icon small" data-say="${esc(w.w)}">🔊</button><div class="r">${esc(w.r)}</div></td>
                  <td>${esc(w.m)}</td>
                  <td>${esc(w.ex)}<div class="r">${esc(w.exKo)}</div></td>
                  <td>${pill}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </section>`;
      $app.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { filter = b.dataset.f; paint(); }));
      $app.querySelectorAll("[data-say]").forEach((b) => (b.onclick = () => speak(b.dataset.say, lang)));
    }
    paint();
  }

  // ---------- 설정 ----------
  function renderSettings() {
    const s = Store.state.settings;
    const cloud = Store.configured
      ? Store.user
        ? `<p>✅ <b>${esc(Store.user.displayName || Store.user.email)}</b> 로 로그인됨. 기기 간 자동 동기화 중.</p><button class="btn" id="logout">로그아웃</button>`
        : `<p>구글 계정으로 로그인하면 휴대폰·PC 어디서든 진도가 이어져요.</p><button class="btn primary" id="login">Google 로그인</button>`
      : `<p class="help">Firebase 가 아직 설정되지 않았어요. 지금은 이 브라우저에만 저장됩니다.<br><code>public/firebase-config.js</code> 를 채우면 로그인 버튼이 나타나요. (README 참고)</p>`;

    $app.innerHTML = `
      <h1>설정</h1>
      <section class="card">
        <h2 style="margin-top:0">☁️ 클라우드 동기화</h2>
        ${cloud}
      </section>
      <section class="card">
        <h2 style="margin-top:0">📅 하루 학습량</h2>
        <label for="npd">언어당 새 단어 수</label>
        <div class="row"><input type="number" id="npd" min="1" max="30" value="${s.newPerDay}" style="width:90px" /><button class="btn" id="save-npd">저장</button></div>
        <p class="help">5개 ≈ 언어당 10분, 세 언어 30분. 복습 카드는 별도로 추가됩니다.</p>
      </section>
      <section class="card">
        <h2 style="margin-top:0">💾 백업</h2>
        <div class="row">
          <button class="btn" id="export">JSON 내보내기</button>
          <label class="btn" style="margin:0"><input type="file" id="import" accept="application/json" style="display:none" />JSON 가져오기</label>
        </div>
        <p class="help">가져오기는 기존 기록과 합쳐집니다(더 최근 기록 우선).</p>
      </section>
      <section class="card">
        <h2 style="margin-top:0">⚠️ 초기화</h2>
        <button class="btn" id="reset" style="border-color:var(--bad);color:var(--bad)">모든 학습 기록 삭제</button>
      </section>
      <section class="card">
        <h2 style="margin-top:0">ℹ️ 정보</h2>
        <p class="help">단어 ${LANG_KEYS.map((l) => `${LANGS[l].name} ${vocab(l).length}`).join(" · ")}개. 중·러 예문은 AI가 만든 것이라 오류가 있을 수 있어요. 이상한 문장은 단어장에서 확인 후 알려 주세요.</p>
      </section>`;

    document.getElementById("save-npd").onclick = () => {
      const v = Math.max(1, Math.min(30, Number(document.getElementById("npd").value) || 5));
      Store.state.settings.newPerDay = v;
      Store.state.settings.u = Date.now();
      Store.save();
      alert(`언어당 새 단어 ${v}개로 저장했어요.`);
    };
    document.getElementById("export").onclick = () => {
      const blob = new Blob([Store.exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `trilingo-backup-${Store.today()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    document.getElementById("import").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        Store.importJSON(await f.text());
        alert("가져오기 완료.");
        renderSettings();
      } catch (err) {
        alert("가져오기 실패: " + err.message);
      }
    };
    document.getElementById("reset").onclick = () => {
      if (confirm("정말 모든 학습 기록을 지울까요? 되돌릴 수 없어요.")) {
        Store.reset();
        renderSettings();
      }
    };
    const login = document.getElementById("login");
    if (login) login.onclick = () => Store.signIn().catch((e) => alert("로그인 실패: " + e.message));
    const logout = document.getElementById("logout");
    if (logout) logout.onclick = () => Store.signOut().then(renderSettings);
  }

  // ---------- 시작 ----------
  function updateSync() {
    $sync.textContent = Store.user ? `저장: 클라우드 (${Store.user.email})` : Store.configured ? "저장: 이 브라우저 (로그인하면 동기화)" : "저장: 이 브라우저";
  }
  Store.load();
  Store.onChange(updateSync);
  Store.initFirebase().then(() => {
    updateSync();
    if (!location.hash || location.hash === "#home") renderHome();
  });
  route();
})();

/* 러시아어 글자 단계 (#abc). 33글자를 5단계로 나누고, 각 단계는
   ① 글자 익히기 → ② 지금까지 배운 글자만으로 된 쉬운 단어 읽기 순서로 진행한다.
   진도는 SRS 카드로 저장한다: 글자 "rua:L1".., 단어 "ruw:W1".. (클라우드 동기화에도 그대로 실림) */
(function () {
  // s: 소리(라틴), k: 한국어 근사 발음, tip: 외우는 요령
  const LEVELS = [
    {
      id: 1,
      title: "영어와 똑같은 글자",
      desc: "모양도 소리도 영어와 같아요. 바로 읽을 수 있어요.",
      letters: [
        { c: "А а", s: "a", k: "아", tip: "영어 a 와 같아요." },
        { c: "К к", s: "k", k: "ㄲ/ㅋ", tip: "영어 k. 힘을 빼면 ㄲ에 가까워요." },
        { c: "М м", s: "m", k: "ㅁ", tip: "영어 m. 소문자도 м 모양이에요." },
        { c: "О о", s: "o", k: "오", tip: "강세가 있으면 '오', 강세가 없으면 '아'처럼 들려요." },
        { c: "Т т", s: "t", k: "ㄸ/ㅌ", tip: "영어 t. 소문자는 작은 т 예요." },
      ],
      words: [
        { w: "мама", st: "ма́ма", m: "엄마", k: "마마" },
        { w: "кот", st: "кот", m: "고양이", k: "꼬트" },
        { w: "кто", st: "кто", m: "누구", k: "크또" },
        { w: "там", st: "там", m: "거기", k: "땀" },
        { w: "так", st: "так", m: "그렇게", k: "딱" },
        { w: "мак", st: "мак", m: "양귀비꽃", k: "막" },
      ],
    },
    {
      id: 2,
      title: "모양은 같은데 소리가 다른 글자",
      desc: "영어처럼 생겼지만 소리가 달라요. 가장 헷갈리는 단계예요.",
      letters: [
        { c: "В в", s: "v", k: "ㅂ(v)", tip: "B 처럼 생겼지만 소리는 v 예요." },
        { c: "Е е", s: "ye", k: "예", tip: "E 처럼 생겼지만 '예'에 가까워요." },
        { c: "Н н", s: "n", k: "ㄴ", tip: "H 처럼 생겼지만 소리는 n 이에요." },
        { c: "Р р", s: "r", k: "ㄹ(굴림)", tip: "P 처럼 생겼지만 혀를 굴리는 r 이에요." },
        { c: "С с", s: "s", k: "ㅅ", tip: "C 처럼 생겼지만 소리는 s 예요." },
        { c: "У у", s: "u", k: "우", tip: "y 처럼 생겼지만 소리는 '우'예요." },
        { c: "Х х", s: "kh", k: "ㅎ(거칠게)", tip: "X 처럼 생겼지만 목에서 긁는 'ㅎ' 소리예요." },
      ],
      words: [
        { w: "нет", st: "нет", m: "아니요", k: "녜트" },
        { w: "он", st: "он", m: "그(남자)", k: "온" },
        { w: "она", st: "она́", m: "그녀", k: "아나" },
        { w: "вот", st: "вот", m: "여기 있어요", k: "보트" },
        { w: "нос", st: "нос", m: "코", k: "노스" },
        { w: "рот", st: "рот", m: "입", k: "로트" },
        { w: "сок", st: "сок", m: "주스", k: "속" },
        { w: "утро", st: "у́тро", m: "아침", k: "우뜨라" },
        { w: "окно", st: "окно́", m: "창문", k: "아크노" },
        { w: "море", st: "мо́ре", m: "바다", k: "모례" },
      ],
    },
    {
      id: 3,
      title: "새 모양 ① 자음과 이",
      desc: "처음 보는 모양이지만 소리는 쉬워요.",
      letters: [
        { c: "Б б", s: "b", k: "ㅂ", tip: "영어 b. 6 처럼 생긴 모양을 기억하세요." },
        { c: "Г г", s: "g", k: "ㄱ", tip: "뒤집힌 ㄱ 모양! 소리도 ㄱ 이에요." },
        { c: "Д д", s: "d", k: "ㄷ", tip: "집 모양. 소리는 d 예요." },
        { c: "Л л", s: "l", k: "ㄹ", tip: "영어 l. 혀끝을 윗니 뒤에 대요." },
        { c: "П п", s: "p", k: "ㅃ/ㅍ", tip: "수학의 π 모양. 소리는 p 예요." },
        { c: "И и", s: "i", k: "이", tip: "N 을 뒤집은 모양. 소리는 '이'예요." },
        { c: "З з", s: "z", k: "ㅈ(z)", tip: "숫자 3 모양. 소리는 z 예요." },
        { c: "Ф ф", s: "f", k: "ㅍ(f)", tip: "윗니로 아랫입술을 살짝 물고 f." },
      ],
      words: [
        { w: "да", st: "да", m: "네", k: "다" },
        { w: "дом", st: "дом", m: "집", k: "돔" },
        { w: "папа", st: "па́па", m: "아빠", k: "빠빠" },
        { w: "брат", st: "брат", m: "형제", k: "브라트" },
        { w: "суп", st: "суп", m: "수프", k: "숩" },
        { w: "друг", st: "друг", m: "친구", k: "드룩" },
        { w: "глаз", st: "глаз", m: "눈(신체)", k: "글라스" },
        { w: "зуб", st: "зуб", m: "이(치아)", k: "줍" },
        { w: "лампа", st: "ла́мпа", m: "램프", k: "람빠" },
        { w: "игра", st: "игра́", m: "놀이, 게임", k: "이그라" },
        { w: "фото", st: "фо́то", m: "사진", k: "포따" },
      ],
    },
    {
      id: 4,
      title: "새 모양 ② 모음",
      desc: "야·유·요·에 소리와, 한국어에 없는 ы 를 배워요.",
      letters: [
        { c: "Я я", s: "ya", k: "야", tip: "R 을 뒤집은 모양. 혼자 쓰면 '나'라는 뜻이에요." },
        { c: "Ю ю", s: "yu", k: "유", tip: "IO 를 붙인 모양. 소리는 '유'예요." },
        { c: "Ё ё", s: "yo", k: "요", tip: "е 위에 점 두 개. 늘 강세가 와요." },
        { c: "Э э", s: "e", k: "에", tip: "C 를 뒤집은 모양. 소리는 '에'예요." },
        { c: "Ы ы", s: "y", k: "으이", tip: "'으'와 '이' 사이. 입을 옆으로 벌리고 '으이'." },
        { c: "Й й", s: "y", k: "짧은 이", tip: "и 위에 반달. 모음 뒤에서 짧게 '-이'." },
      ],
      words: [
        { w: "я", st: "я", m: "나", k: "야" },
        { w: "мы", st: "мы", m: "우리", k: "므이" },
        { w: "ты", st: "ты", m: "너", k: "뜨이" },
        { w: "вы", st: "вы", m: "당신(들)", k: "브이" },
        { w: "это", st: "э́то", m: "이것", k: "에따" },
        { w: "мой", st: "мой", m: "나의(남성)", k: "모이" },
        { w: "моя", st: "моя́", m: "나의(여성)", k: "마야" },
        { w: "твой", st: "твой", m: "너의", k: "뜨보이" },
        { w: "сыр", st: "сыр", m: "치즈", k: "스이르" },
        { w: "ёлка", st: "ёлка", m: "전나무, 트리", k: "욜까" },
        { w: "юбка", st: "ю́бка", m: "치마", k: "윱까" },
      ],
    },
    {
      id: 5,
      title: "새 모양 ③ 쉬·치 소리와 부호",
      desc: "마지막 단계! 이제 모든 러시아어 단어를 읽을 수 있어요.",
      letters: [
        { c: "Ж ж", s: "zh", k: "ㅈ(쥐)", tip: "벌레 모양. 혀를 뒤로 당겨 떨리는 '쥐'." },
        { c: "Ц ц", s: "ts", k: "ㅉ", tip: "꼬리 달린 ц. 소리는 'ㅉ'." },
        { c: "Ч ч", s: "ch", k: "ㅊ", tip: "숫자 4 를 뒤집은 모양. 소리는 'ㅊ'." },
        { c: "Ш ш", s: "sh", k: "쉬", tip: "빗 모양. 혀를 뒤로 당긴 '쉬'." },
        { c: "Щ щ", s: "shch", k: "부드러운 쉬", tip: "ш 에 꼬리. 길고 부드러운 '쉬'." },
        { c: "Ь ь", s: "'", k: "(소리 없음)", tip: "연음 부호. 앞 자음을 부드럽게 해요." },
        { c: "Ъ ъ", s: "-", k: "(소리 없음)", tip: "경음 부호. 앞뒤를 끊어 읽게 해요. 아주 드물어요." },
      ],
      words: [
        { w: "школа", st: "шко́ла", m: "학교", k: "쉬꼴라" },
        { w: "чай", st: "чай", m: "차(마시는)", k: "차이" },
        { w: "хорошо", st: "хорошо́", m: "좋아요", k: "하라쇼" },
        { w: "шапка", st: "ша́пка", m: "모자", k: "샤프까" },
        { w: "мяч", st: "мяч", m: "공", k: "먀치" },
        { w: "улица", st: "у́лица", m: "거리", k: "울리짜" },
        { w: "борщ", st: "борщ", m: "보르시(수프)", k: "보르쉬" },
        { w: "жук", st: "жук", m: "딱정벌레", k: "주크" },
        { w: "день", st: "день", m: "날, 낮", k: "졘" },
        { w: "семья", st: "семья́", m: "가족", k: "시미야" },
        { w: "ночь", st: "ночь", m: "밤", k: "노치" },
        { w: "подъезд", st: "подъе́зд", m: "현관", k: "빠드예스트" },
      ],
    },
  ];

  // 카드 id 부여: 글자 L1..L33, 단어 W1..
  let li = 0, wi = 0;
  for (const lv of LEVELS) {
    for (const l of lv.letters) l.id = `L${++li}`;
    for (const w of lv.words) w.id = `W${++wi}`;
  }

  const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "'", э: "e", ю: "yu", я: "ya" };
  // 키릴 문자 → 라틴 문자. 강세 부호(U+0301)는 그대로 둔다.
  function translit(text) {
    let out = "";
    for (const ch of String(text || "")) {
      const low = ch.toLowerCase();
      if (low in TR) {
        const t = TR[low];
        out += ch !== low && t ? t[0].toUpperCase() + t.slice(1) : t;
      } else out += ch;
    }
    return out;
  }

  const allLetters = () => LEVELS.flatMap((lv) => lv.letters);
  const allWords = () => LEVELS.flatMap((lv) => lv.words);
  const keyOf = (item) => (item.id[0] === "L" ? "rua" : "ruw");

  function progress(lv) {
    const seenL = lv.letters.filter((l) => Store.getCard("rua", l.id)?.seen).length;
    const seenW = lv.words.filter((w) => Store.getCard("ruw", w.id)?.seen).length;
    return { seenL, seenW, done: seenL === lv.letters.length && seenW === lv.words.length };
  }
  function dueItems() {
    const now = Date.now();
    return [...allLetters(), ...allWords()].filter((it) => SRS.isDue(Store.getCard(keyOf(it), it.id), now));
  }
  function allLettersSeen() {
    return allLetters().every((l) => Store.getCard("rua", l.id)?.seen);
  }

  // ---------- 개요 ----------
  function renderOverview($app, U) {
    const due = dueItems();
    const nextLv = LEVELS.find((lv) => !progress(lv).done);
    $app.innerHTML = `
      <div class="row"><a class="btn ghost small" href="#home">← 홈</a><h1 class="grow" style="margin:0 10px">🇷🇺 러시아어 글자 단계</h1></div>
      <p class="sub">글자를 익히고, 배운 글자로만 된 쉬운 단어를 읽어요. 1단계부터 차례로 가세요.</p>
      ${due.length ? `<section class="card"><div class="row"><div class="grow"><b>복습할 글자·단어 ${due.length}개</b><div class="help">잊어버리기 전에 다시 봐요.</div></div><a class="btn primary" href="#abc/review">복습하기</a></div></section>` : ""}
      ${LEVELS.map((lv) => {
        const p = progress(lv);
        const isNext = nextLv && nextLv.id === lv.id;
        return `<section class="card abc-level ${p.done ? "done" : ""}">
          <div class="row">
            <div class="grow"><b>${lv.id}단계 · ${U.esc(lv.title)}</b> ${p.done ? '<span class="pill ok">완료</span>' : isNext ? '<span class="pill new">지금 할 차례</span>' : ""}</div>
          </div>
          <div class="abc-preview">${lv.letters.map((l) => `<span>${U.esc(l.c.split(" ")[0])}</span>`).join("")}</div>
          <div class="help">${U.esc(lv.desc)}</div>
          <div class="row" style="margin-top:8px">
            <span class="help grow">글자 ${p.seenL}/${lv.letters.length} · 단어 ${p.seenW}/${lv.words.length}</span>
            <a class="btn ${isNext ? "primary" : ""}" href="#abc/${lv.id}">${p.done ? "다시 보기" : p.seenL || p.seenW ? "이어 하기" : "시작"}</a>
          </div>
        </section>`;
      }).join("")}
      <p class="help">한국어 발음은 근사치예요. 🔊 듣기로 실제 소리를 꼭 확인하세요.</p>`;
  }

  // ---------- 학습 세션 ----------
  function renderSession($app, U, items, title, backHref, nextHref) {
    const queue = items.slice();
    let idx = 0;
    let done = 0;

    function show() {
      if (idx >= queue.length) return summary();
      const it = queue[idx];
      const isLetter = it.id[0] === "L";
      const front = isLetter
        ? `<div class="abc-big">${U.esc(it.c)}</div>`
        : `<div class="abc-word">${U.esc(it.w)}</div><div class="help">소리 내어 읽어 보세요</div>`;
      const back = isLetter
        ? `<div class="abc-sound"><b>${U.esc(it.s)}</b> · ${U.esc(it.k)}</div><div class="abc-tip">${U.esc(it.tip)}</div>`
        : `<div class="abc-sound"><b>${U.esc(it.st)}</b> · ${U.esc(translit(it.st))}</div>
           <div class="abc-tip">발음: ${U.esc(it.k)}</div>
           <div class="meaning">${U.esc(it.m)}</div>`;
      const say = isLetter ? it.c.split(" ")[0] : it.w;
      $app.innerHTML = `
        <div class="row"><a class="btn ghost small" href="${backHref}">← 단계</a><span class="grow"></span><span class="help">${U.esc(title)} · ${idx + 1} / ${queue.length}</span></div>
        <div class="progress"><div style="width:${(idx / queue.length) * 100}%"></div></div>
        <section class="card flash" id="flash">
          <div class="topic">${isLetter ? "글자" : "단어 읽기"}</div>
          ${front}
          <div><button class="btn icon small" id="say" title="듣기">🔊</button></div>
          <div id="back" class="hidden">${back}</div>
        </section>
        <button class="btn primary block" id="reveal">${isLetter ? "소리 보기" : "정답 보기"}</button>
        <div class="grades two hidden" id="grades">
          <button class="btn again" data-q="0">다시<small>조금 뒤에 또</small></button>
          <button class="btn easy" data-q="4">알겠어요<small>다음으로</small></button>
        </div>`;
      document.getElementById("say").onclick = (e) => { e.stopPropagation(); U.speak(say, "ru"); };
      const open = () => {
        document.getElementById("back").classList.remove("hidden");
        document.getElementById("grades").classList.remove("hidden");
        document.getElementById("reveal").classList.add("hidden");
        U.speak(say, "ru");
      };
      document.getElementById("reveal").onclick = open;
      document.getElementById("flash").onclick = open;
      $app.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => grade(it, Number(b.dataset.q))));
    }

    function grade(it, q) {
      const key = keyOf(it);
      const prev = Store.getCard(key, it.id) || {};
      Store.setCard(key, it.id, SRS.grade(prev, q));
      Store.recordStudy(key, it.id, !prev.seen);
      Store.save();
      if (q < 3) queue.push(it);
      else done += 1;
      idx += 1;
      show();
    }

    function summary() {
      $app.innerHTML = `
        <h1>🇷🇺 ${U.esc(title)} 끝!</h1>
        <section class="card">
          <p>글자·단어 ${done}개를 익혔어요.</p>
          <div class="row">
            ${nextHref ? `<a class="btn primary" href="${nextHref}">다음 단계</a>` : ""}
            <a class="btn" href="#abc">단계 목록</a>
            <a class="btn ghost" href="#home">홈</a>
          </div>
        </section>`;
    }

    if (!queue.length) {
      $app.innerHTML = `<section class="card"><p>지금은 복습할 게 없어요. 🎉</p><a class="btn" href="#abc">단계 목록</a></section>`;
      return;
    }
    show();
  }

  function render($app, arg, U) {
    if (arg === "review") return renderSession($app, U, dueItems(), "복습", "#abc", null);
    const lv = LEVELS.find((x) => String(x.id) === String(arg));
    if (!lv) return renderOverview($app, U);
    const next = LEVELS.find((x) => x.id === lv.id + 1);
    // 글자 먼저, 그다음 그 단계 단어
    renderSession($app, U, [...lv.letters, ...lv.words], `${lv.id}단계`, "#abc", next ? `#abc/${next.id}` : null);
  }

  window.RuAbc = { LEVELS, render, translit, progress, allLettersSeen };
})();

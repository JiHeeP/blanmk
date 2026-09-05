// 학습 기록 저장소. 항상 localStorage 에 저장하고, Firebase 가 설정돼 있으면 Firestore 와 동기화한다.
// 상태 구조:
// {
//   cards: { "zh:12": { ease, interval, reps, lapses, due, seen, u } },
//   settings: { newPerDay: 5, u },
//   log: { "2026-09-05": { zh: { new: 3, review: 7, studied: [12, 15] }, ru: {...}, en: {...} } },
//   u: 마지막 수정 시각
// }
window.Store = {
  KEY: "trilingo-state-v1",
  state: null,
  user: null,
  db: null,
  ready: false, // Firebase 초기화 완료 여부
  configured: false,
  listeners: [],
  _pushTimer: null,

  defaults() {
    return { cards: {}, settings: { newPerDay: 5, u: 0 }, log: {}, u: 0 };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      this.state = raw ? this.merge(this.defaults(), JSON.parse(raw)) : this.defaults();
    } catch {
      this.state = this.defaults();
    }
    return this.state;
  },

  save() {
    this.state.u = Date.now();
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("localStorage 저장 실패", e);
    }
    this.schedulePush();
    this.emit();
  },

  onChange(fn) {
    this.listeners.push(fn);
  },
  emit() {
    this.listeners.forEach((fn) => fn(this.state));
  },

  // ---- 카드 / 로그 헬퍼 ----
  cardKey(lang, id) {
    return `${lang}:${id}`;
  },
  getCard(lang, id) {
    return this.state.cards[this.cardKey(lang, id)] || null;
  },
  setCard(lang, id, data) {
    this.state.cards[this.cardKey(lang, id)] = { ...(this.getCard(lang, id) || {}), ...data };
  },

  today() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
  todayLog(lang) {
    const day = this.today();
    this.state.log[day] = this.state.log[day] || {};
    this.state.log[day][lang] = this.state.log[day][lang] || { new: 0, review: 0, studied: [] };
    return this.state.log[day][lang];
  },
  recordStudy(lang, id, wasNew) {
    const l = this.todayLog(lang);
    if (wasNew) l.new += 1;
    else l.review += 1;
    if (!l.studied.includes(id)) l.studied.push(id);
    this.state.log[this.today()].u = Date.now();
  },

  streak() {
    let n = 0;
    const d = new Date();
    for (;;) {
      const pad = (x) => String(x).padStart(2, "0");
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const day = this.state.log[key];
      const total = day ? Object.values(day).reduce((s, v) => s + (v && typeof v === "object" ? (v.new || 0) + (v.review || 0) : 0), 0) : 0;
      if (total > 0) n += 1;
      else if (n > 0 || key !== this.today()) break; // 오늘 아직 안 했으면 어제부터 센다
      d.setDate(d.getDate() - 1);
      if (n > 3650) break;
    }
    return n;
  },

  // ---- 병합 (로컬 vs 클라우드). 카드는 u 가 큰 쪽, 로그는 합집합 ----
  merge(base, incoming) {
    const out = { cards: { ...base.cards }, settings: { ...base.settings }, log: { ...base.log }, u: Math.max(base.u || 0, incoming.u || 0) };
    for (const [k, v] of Object.entries(incoming.cards || {})) {
      if (!out.cards[k] || (v.u || 0) >= (out.cards[k].u || 0)) out.cards[k] = v;
    }
    if ((incoming.settings?.u || 0) >= (out.settings.u || 0)) out.settings = { ...out.settings, ...incoming.settings };
    for (const [day, langs] of Object.entries(incoming.log || {})) {
      if (!out.log[day]) {
        out.log[day] = langs;
        continue;
      }
      for (const [lang, v] of Object.entries(langs)) {
        if (lang === "u") {
          out.log[day].u = Math.max(out.log[day].u || 0, v || 0);
          continue;
        }
        const cur = out.log[day][lang];
        if (!cur) out.log[day][lang] = v;
        else {
          out.log[day][lang] = {
            new: Math.max(cur.new || 0, v.new || 0),
            review: Math.max(cur.review || 0, v.review || 0),
            studied: Array.from(new Set([...(cur.studied || []), ...(v.studied || [])])),
          };
        }
      }
    }
    return out;
  },

  exportJSON() {
    return JSON.stringify(this.state, null, 2);
  },
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !parsed.cards) throw new Error("형식이 맞지 않는 파일입니다.");
    this.state = this.merge(this.state, parsed);
    this.save();
  },
  reset() {
    this.state = this.defaults();
    this.save();
    if (this.user && this.db) this.db.collection("users").doc(this.user.uid).delete().catch(() => {});
  },

  // ---- Firebase ----
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("스크립트 로드 실패: " + src));
      document.head.appendChild(s);
    });
  },

  async initFirebase() {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) {
      this.ready = true;
      return false;
    }
    this.configured = true;
    const v = "10.14.1";
    try {
      await this.loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
      await this.loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`);
      await this.loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`);
      firebase.initializeApp(cfg);
      this.db = firebase.firestore();
      firebase.auth().onAuthStateChanged(async (user) => {
        this.user = user;
        if (user) await this.pullCloud();
        this.ready = true;
        this.emit();
      });
      return true;
    } catch (e) {
      console.warn("Firebase 초기화 실패", e);
      this.ready = true;
      return false;
    }
  },

  async signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await firebase.auth().signInWithPopup(provider);
    } catch (e) {
      // 모바일 브라우저 등 팝업이 막히면 리디렉트로 재시도
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
        await firebase.auth().signInWithRedirect(provider);
      } else {
        throw e;
      }
    }
  },
  async signOut() {
    await firebase.auth().signOut();
    this.user = null;
    this.emit();
  },

  async pullCloud() {
    if (!this.user || !this.db) return;
    try {
      const snap = await this.db.collection("users").doc(this.user.uid).get();
      if (snap.exists) {
        const remote = snap.data();
        this.state = this.merge(this.state, remote);
        localStorage.setItem(this.KEY, JSON.stringify(this.state));
      }
      await this.pushCloud();
    } catch (e) {
      console.warn("클라우드 불러오기 실패", e);
    }
  },
  schedulePush() {
    if (!this.user || !this.db) return;
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this.pushCloud(), 1500);
  },
  async pushCloud() {
    if (!this.user || !this.db) return;
    try {
      await this.db.collection("users").doc(this.user.uid).set(this.state);
    } catch (e) {
      console.warn("클라우드 저장 실패", e);
    }
  },
};

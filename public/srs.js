// 간격 반복(SRS) 계산. SM-2 를 단순화한 버전.
// grade: 0 = 다시(모름), 3 = 어려움, 4 = 좋음, 5 = 쉬움
window.SRS = {
  DAY: 24 * 60 * 60 * 1000,

  grade(card, q) {
    const now = Date.now();
    let ease = card.ease ?? 2.5;
    let interval = card.interval ?? 0; // 일 단위
    let reps = card.reps ?? 0;
    let lapses = card.lapses ?? 0;

    if (q < 3) {
      reps = 0;
      lapses += 1;
      interval = 0;
      ease = Math.max(1.3, ease - 0.2);
    } else {
      if (reps === 0) interval = 1;
      else if (reps === 1) interval = 3;
      else interval = Math.round(interval * ease);
      if (q === 3) interval = Math.max(1, Math.round(interval * 0.7));
      if (q === 5) interval = Math.max(interval + 1, Math.round(interval * 1.3));
      ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
      reps += 1;
    }

    const due = q < 3 ? now + 10 * 60 * 1000 : now + interval * this.DAY;
    return { ease, interval, reps, lapses, due, seen: true, u: now };
  },

  isDue(card, now = Date.now()) {
    return !!card && card.seen && (card.due ?? 0) <= now;
  },

  status(card) {
    if (!card || !card.seen) return "new";
    if ((card.interval ?? 0) >= 21) return "known";
    return "learning";
  },
};

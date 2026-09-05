# Trilingo — 나를 위한 영어·중국어·러시아어 학습 앱

교사 한 명이 매일 30분씩 세 언어를 이어 가기 위한 작은 웹앱입니다.
설치 없이 브라우저(휴대폰·PC)에서 쓰고, Vercel 에 무료로 배포합니다.

| 언어 | 목표 수준 | 초기 단어 |
|---|---|---|
| 중국어 | HSK 1~2 (듀오링고 6단계) | 60개 |
| 러시아어 | A1~A2 (듀오링고 10단계) | 60개 |
| 영어 | B1~B2 중급 | 60개 |

주제는 **교실·학생·학부모 소통**(인사, 지시, 격려, 생활지도, 상담)입니다.

## 기능

- **플래시카드 + 간격 반복(SRS)** — 다시/어려움/좋음/쉬움 4단계. 틀린 카드는 10분 뒤 다시.
- **문장 퀴즈** — 빈칸 채우기와 번역 고르기. 틀린 단어는 복습 대기열 맨 앞으로.
- **AI 대화** — 목표 언어로 대화하면 번역·교정을 붙여 줌. API 키가 있어야 켜짐.
- **듣기(TTS)** — 단어·예문을 브라우저 음성으로 읽어 줌.
- **하루 학습량** — 언어당 새 단어 5개(설정에서 1~30 조절) + 복습.
- **저장** — 기본은 이 브라우저. Firebase 를 설정하면 구글 로그인으로 기기 간 동기화.
- **백업** — JSON 내보내기/가져오기.

## 1. 바로 써 보기 (설정 없이)

```bash
node server.js
```

브라우저에서 <http://localhost:3000>. 이 상태로도 플래시카드·퀴즈·듣기는 전부 동작합니다.
AI 대화만 "API 키 없음"으로 꺼져 있습니다.

## 2. Vercel 에 배포

1. GitHub 에 이 저장소를 올립니다.
2. <https://vercel.com> → **Add New Project** → 이 저장소 선택 → 그대로 **Deploy**.
   (설정 건드릴 것 없음. `public/` 이 정적 사이트, `api/` 가 서버 함수로 자동 인식됩니다.)
3. 배포 주소를 휴대폰 홈 화면에 추가하면 앱처럼 씁니다.

## 3. AI 대화 켜기 (선택)

1. <https://console.anthropic.com> 에서 API 키 발급.
2. Vercel → 프로젝트 → **Settings → Environment Variables** 에 추가:
   - Name: `ANTHROPIC_API_KEY`
   - Value: 발급받은 키
3. **Deployments → 최신 항목 → Redeploy**.

로컬에서 켜려면:

```bash
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

비용: 대화 한 턴에 대략 1~3원 수준(2026-09 기준, Claude Opus 5, 짧은 답변 기준). 키는 절대 코드나 GitHub 에 넣지 마세요.

## 4. 클라우드 동기화 켜기 (선택, Firebase)

1. <https://console.firebase.google.com> → **프로젝트 추가** (이름 자유, 애널리틱스 끄기).
2. 왼쪽 **빌드 → Authentication → 시작하기 → 로그인 방법 → Google** 사용 설정.
3. **빌드 → Firestore Database → 데이터베이스 만들기** → 프로덕션 모드 → 지역 `asia-northeast3`(서울).
4. Firestore **규칙** 탭에 아래를 붙여 넣고 게시:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

5. **프로젝트 설정(톱니) → 일반 → 내 앱 → 웹 앱 추가(</>)** → 나오는 `firebaseConfig` 값을
   `public/firebase-config.js` 의 `window.FIREBASE_CONFIG = { ... }` 에 붙여 넣습니다.
6. **Authentication → 설정 → 승인된 도메인** 에 Vercel 배포 도메인(`xxx.vercel.app`)을 추가합니다.
7. 커밋·푸시하면 Vercel 이 다시 배포하고, 설정 화면에 **Google 로그인** 버튼이 나타납니다.

동기화 규칙: 카드별로 더 최근 기록이 이기고, 학습 로그는 합집합입니다. 로그인 전 브라우저 기록도 로그인하면 합쳐집니다.

## 단어 추가·수정

`public/data/zh.js`, `ru.js`, `en.js` 를 직접 고치면 됩니다. 한 줄이 한 단어입니다.

```js
{ id: 61, w: "黑板", r: "hēibǎn", m: "칠판", ex: "请看黑板。", exKo: "칠판을 보세요.", t: "수업" },
```

- `id` 는 겹치지 않게 (학습 기록이 id 로 연결됩니다. 기존 id 를 바꾸면 그 단어 기록이 끊깁니다).
- 예문 속 형태가 표제어와 다르면 `f: "예문 속 형태"` 를 추가하세요 (러시아어 격변화, 영어 시제 등). 빈칸 퀴즈가 이 값을 찾습니다.
- `t` 는 주제 필터에 그대로 나옵니다.

> 중국어·러시아어 예문은 AI 가 작성했습니다. 어색하거나 틀린 문장이 있을 수 있으니 단어장에서 확인하세요.

## 구조

```
public/            정적 사이트 (Vercel 이 그대로 서빙)
  index.html
  app.js           화면·학습 흐름
  srs.js           간격 반복 계산
  store.js         저장(localStorage) + Firebase 동기화
  firebase-config.js
  data/zh.js ru.js en.js   단어 데이터
api/chat.js        AI 대화 서버 함수 (Anthropic SDK)
server.js          로컬 실행용 서버
```

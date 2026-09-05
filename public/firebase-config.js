// Firebase 설정. 비워 두면(null) 브라우저 저장만 사용하고, 채우면 구글 로그인 + 클라우드 동기화가 켜진다.
// Firebase 콘솔 → 프로젝트 설정 → 내 앱 → "SDK 설정 및 구성" 에서 복사해 붙여 넣는다.
// 이 값들은 공개돼도 되는 값이다(비밀키가 아님). 보안은 Firestore 규칙으로 잡는다(README 참고).
window.FIREBASE_CONFIG = null;

// 예시:
// window.FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "trilingo-xxxx.firebaseapp.com",
//   projectId: "trilingo-xxxx",
//   storageBucket: "trilingo-xxxx.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abcdef",
// };

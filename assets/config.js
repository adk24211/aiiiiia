/* 손가락 마일리지 — 운영자 설정
 * 수익화 요소는 전부 여기서 켠다. 값이 비어 있으면 그 블록은 화면에 아예 나오지 않는다.
 * (빈 값으로 두고 배포해도 사이트는 완전히 동작한다.)
 */
(typeof window !== "undefined" ? window : globalThis).KM_CONFIG = {
  // 사이트 주소. 커스텀 도메인을 붙였다면 여기에. 공유 카드 워터마크와 canonical에 쓰인다.
  siteUrl: "",

  // --- 쿠팡 파트너스 -------------------------------------------------
  // 파트너스 가입 후 발급받는 트래킹 코드. 예: "AF1234567"
  // 값을 넣으면 추천 블록과 법정 대가성 문구, 개인정보처리방침의 제휴 조항이 함께 켜진다.
  // (이 값은 전체 스위치를 겸하므로, 아래 coupangLinks 만 채우고 비워 두면 안 된다.)
  coupangPartnerId: "",
  // 파트너스 '링크 생성'에서 직접 발급받은 링크가 있으면 여기에.
  // key 는 render.js 의 추천 분기 이름: split / palmrest / tkl / keycap
  // 비워 두면 키워드 검색 링크(AFFSRP)로 대신한다.
  coupangLinks: [
    // { key: "palmrest", url: "https://link.coupang.com/a/XXXXXX" }
  ],

  // --- Google AdSense ------------------------------------------------
  // 예: "ca-pub-0000000000000000". *.github.io 로는 승인되지 않는다(커스텀 도메인 필요).
  adsenseClient: "",
  adsenseSlotTop: "",
  adsenseSlotBottom: "",

  // --- 고해상도 포스터 언락 -------------------------------------------
  // 결제 링크(Gumroad / Lemon Squeezy / BuyMeACoffee / 토스 결제링크 등).
  unlockUrl: "",
  unlockPrice: "4,900원",
  // 결제 후 구매자에게 주는 코드의 SHA-256 앞 12자리 목록. tools/make-codes.mjs 로 생성.
  unlockHashes: [],

  // --- 후원 -----------------------------------------------------------
  sponsorUrl: "",

  // 소스 저장소 (이슈로 자판표 정정 제안 받는 곳)
  repoUrl: "https://github.com/adk24211/aiiiiia",

  // --- 개인정보처리방침·소개 페이지에 들어갈 정보 ---------------------
  // 광고를 켜면 개인정보처리방침에 보호책임자와 연락처를 적어야 합니다(개인정보 보호법 제30조).
  // 비워 두면 GitHub 이슈 링크로 대체되며, 광고를 켠 상태에서는 빌드가 경고합니다.
  ownerName: "",
  contactEmail: "",
  // 방침 시행일. 비우면 "사이트 공개일"로 표기합니다.
  policyDate: ""
};

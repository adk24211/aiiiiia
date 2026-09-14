// KeyMiles — assets/kakao.js 자체 테스트
// 실행: node tools/test-kakao.mjs   (실패하면 종료 코드 1)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "assets", "kakao.js"), "utf8");
vm.runInThisContext(src, { filename: "assets/kakao.js" });
const K = globalThis.KM_KAKAO;

/* ------------------------------------------------------------ 테스트 뼈대 */

let pass = 0;
const fails = [];

function ok(cond, name, extra) {
  if (cond) { pass++; return; }
  fails.push(name + (extra === undefined ? "" : "\n      " + extra));
}
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  ok(a === b, name, "기대: " + b + "\n      실제: " + a);
}
function ms(y, mo, d, h, mi) { return new Date(y, mo - 1, d, h, mi, 0, 0).getTime(); }
function bodies(p) { return p.messages.map((m) => m.body); }

/* ------------------------------------------------------------ 샘플 1: 안드로이드 */

const ANDROID = `홍길동님과 카카오톡 대화
저장한 날짜 : 2024-01-03 15:04:05

2024년 1월 3일 오전 9:05, 홍길동 : 안녕하세요
2024년 1월 3일 오전 9:06, 김철수 : 네 안녕하세요
여러 줄로 쓰면
이렇게 이어집니다
2024년 1월 3일 오후 12:00, 홍길동 : 점심 먹으러 가요
2024년 1월 3일 오전 12:00, 김철수 : 자정 테스트
2024년 1월 3일 오후 1:30, 홍길동 : 사진
2024년 1월 3일 오후 1:31, 홍길동 : 사진 3장
2024년 1월 3일 오후 1:32, 김철수 : 이모티콘
2024년 1월 3일 오후 2:00, 홍길동 : 여기 봐 https://example.com/abc?x=1 재밌어
2024년 1월 3일 오후 2:01, 김철수 : 파일: 보고서.pdf
2024년 1월 3일 오후 2:02, 김철수님이 나갔습니다.
2024년 1월 3일 오후 2:03, 박영희님이 들어왔습니다.
`;

{
  const p = K.parse(ANDROID);
  eq(K.detect(ANDROID), "android", "android: detect");
  ok(p.ok === true, "android: ok");
  eq(p.format, "android", "android: format");
  eq(p.room, "홍길동", "android: 방 이름");
  eq(p.speakers, ["홍길동", "김철수"], "android: 화자 등장 순서");
  eq(p.noticeCount, 2, "android: 시스템 알림 수");
  eq(p.filteredCount, 4, "android: 걸러낸 수(사진/사진 3장/이모티콘/파일:)");
  eq(bodies(p), [
    "안녕하세요",
    "네 안녕하세요\n여러 줄로 쓰면\n이렇게 이어집니다",
    "점심 먹으러 가요",
    "자정 테스트",
    "여기 봐 재밌어"
  ], "android: 본문(여러 줄 이어붙이기 + URL 제거)");
  eq(p.messages[0].t, ms(2024, 1, 3, 9, 5), "android: 오전 9:05");
  eq(p.messages[2].t, ms(2024, 1, 3, 12, 0), "android: 오후 12시 = 12시");
  eq(p.messages[3].t, ms(2024, 1, 3, 0, 0), "android: 오전 12시 = 0시");
  eq(p.first, ms(2024, 1, 3, 0, 0), "android: first");
  eq(p.last, ms(2024, 1, 3, 14, 1), "android: last");
}

/* ------------------------------------------------------------ 샘플 2: iOS */

const IOS = "﻿" + `우리 스터디방 카카오톡 대화
저장한 날짜 : 2024년 1월 3일 오후 3:04

2024년 1월 3일 수요일
오전 9:05, 홍길동 : 좋은 아침
오후 12:00, 김철수 : 점심시간입니다
오전 12:00, 김철수 : 자정 테스트
2024년 1월 4일 목요일
오전 8:00, 박영희 : 새 날이 밝았어요
줄바꿈 있는
메시지
오전 8:01, 박영희 : 삭제된 메시지입니다.
오전 8:02, 박영희 : 음성메시지
오전 8:03, 홍길동님이 나갔습니다.
Jan 5, 2024 at 9:30, 홍길동 : english locale line
`;

{
  const p = K.parse(IOS);
  eq(K.detect(IOS), "ios", "ios: detect");
  eq(p.format, "ios", "ios: format");
  eq(p.room, "우리 스터디방", "ios: 방 이름");
  eq(p.speakers, ["홍길동", "김철수", "박영희"], "ios: 화자 등장 순서");
  eq(p.noticeCount, 1, "ios: 시스템 알림 수");
  eq(p.filteredCount, 2, "ios: 걸러낸 수(삭제된 메시지/음성메시지)");
  eq(bodies(p), [
    "좋은 아침",
    "점심시간입니다",
    "자정 테스트",
    "새 날이 밝았어요\n줄바꿈 있는\n메시지",
    "english locale line"
  ], "ios: 본문");
  eq(p.messages[0].t, ms(2024, 1, 3, 9, 5), "ios: 날짜 헤더 + 오전 9:05");
  eq(p.messages[1].t, ms(2024, 1, 3, 12, 0), "ios: 오후 12시");
  eq(p.messages[2].t, ms(2024, 1, 3, 0, 0), "ios: 오전 12시");
  eq(p.messages[3].t, ms(2024, 1, 4, 8, 0), "ios: 날짜 헤더가 바뀐다");
  eq(p.messages[4].t, ms(2024, 1, 5, 9, 30), "ios: 영문 로케일 줄");
  eq(p.first, ms(2024, 1, 3, 0, 0), "ios: first");
  eq(p.last, ms(2024, 1, 5, 9, 30), "ios: last");
}

/* ------------------------------------------------------------ 샘플 3: 윈도우 PC */

const WINDOWS = `우리 스터디방
저장한 날짜 : 2024-01-03 15:04:05

--------------- 2024년 1월 3일 수요일 ---------------
[홍길동] [오전 9:05] 안녕하세요
[김철수] [오후 12:00] 점심 먹으러 갑시다
[김철수] [오전 12:00] 자정 테스트
[박영희] [오후 2:00] 여러 줄 메시지
두 번째 줄입니다
[박영희] [오후 2:01] 이모티콘
[박영희] [오후 2:02] 샵검색: 오늘 날씨
[홍길동] [오후 2:03] 링크 https://kakao.com/x 확인해줘
김철수님이 나갔습니다.
--------------- 2024년 1월 4일 목요일 ---------------
[홍길동] [오전 7:00] 새 아침
`;

{
  const p = K.parse(WINDOWS);
  eq(K.detect(WINDOWS), "windows", "windows: detect");
  eq(p.format, "windows", "windows: format");
  eq(p.room, "우리 스터디방", "windows: 방 이름(1행 그대로)");
  eq(p.speakers, ["홍길동", "김철수", "박영희"], "windows: 화자 등장 순서");
  eq(p.noticeCount, 1, "windows: 시스템 알림 수");
  eq(p.filteredCount, 2, "windows: 걸러낸 수(이모티콘/샵검색)");
  eq(bodies(p), [
    "안녕하세요",
    "점심 먹으러 갑시다",
    "자정 테스트",
    "여러 줄 메시지\n두 번째 줄입니다",
    "링크 확인해줘",
    "새 아침"
  ], "windows: 본문");
  eq(p.messages[0].t, ms(2024, 1, 3, 9, 5), "windows: 날짜 구분선 + 오전 9:05");
  eq(p.messages[1].t, ms(2024, 1, 3, 12, 0), "windows: 오후 12시");
  eq(p.messages[2].t, ms(2024, 1, 3, 0, 0), "windows: 오전 12시");
  eq(p.messages[5].t, ms(2024, 1, 4, 7, 0), "windows: 구분선이 바뀐다");
  eq(p.last, ms(2024, 1, 4, 7, 0), "windows: last");
}

/* ------------------------------------------------------------ 샘플 4: macOS CSV */

const MACOS = `Date,User,Message
"2024-01-03 09:05:00","홍길동","안녕하세요"
"2024-01-03 09:06:00","김철수","쉼표, 가 들어간 메시지"
"2024-01-03 09:07:00","김철수","따옴표 ""인용"" 테스트"
"2024-01-03 09:08:00","박영희","여러 줄
메시지입니다"
"2024-01-03 12:00:00","박영희","사진"
"2024-01-03 13:00:00","박영희","사진 5장"
"2024-01-03 14:00:00","홍길동","링크 https://example.com/q?a=1,b=2 끝"
"2024-01-03 15:00:00","","박영희님이 나갔습니다."
2024-01-03 16:00:00,홍길동,따옴표 없는 줄`;

{
  const p = K.parse(MACOS);
  eq(K.detect(MACOS), "macos", "macos: detect");
  eq(p.format, "macos", "macos: format");
  eq(p.room, null, "macos: 방 이름 없음");
  eq(p.speakers, ["홍길동", "김철수", "박영희"], "macos: 화자 등장 순서");
  eq(p.noticeCount, 1, "macos: 화자 없는 줄 = 알림");
  eq(p.filteredCount, 2, "macos: 걸러낸 수(사진/사진 5장)");
  eq(bodies(p), [
    "안녕하세요",
    "쉼표, 가 들어간 메시지",
    '따옴표 "인용" 테스트',
    "여러 줄\n메시지입니다",
    "링크 끝",
    "따옴표 없는 줄"
  ], "macos: CSV 안의 쉼표·따옴표·개행");
  eq(p.messages[0].t, ms(2024, 1, 3, 9, 5), "macos: Date 칸 파싱");
  eq(p.last, ms(2024, 1, 3, 16, 0), "macos: 마지막 줄(개행 없이 끝나는 행)");
}

/* CSV 파서 단독 검사 */
{
  const rows = K.parseCsv('a,"b,c","d""e"\r\n"여러\n줄",2,3\n');
  eq(rows, [["a", "b,c", 'd"e'], ["여러\n줄", "2", "3"]], "csv: 상태 기계");
  eq(K.parseCsv("x"), [["x"]], "csv: 한 칸짜리");
  eq(K.parseCsv(""), [], "csv: 빈 문자열");
}

/* ------------------------------------------------------------ 카톡이 아닌 입력 */

{
  const plain = "그냥 평범한 한국어 문장입니다.\n두 번째 줄도 있습니다.";
  eq(K.detect(plain), null, "평문: detect null");
  eq(K.parse(plain).ok, false, "평문: ok false");
  eq(K.parse("").ok, false, "빈 문자열: ok false");
  eq(K.parse(null).ok, false, "null: ok false");
  eq(K.parse(undefined).ok, false, "undefined: ok false");
  eq(K.parse(12345).ok, false, "숫자: ok false");
  eq(K.parse(" ��").ok, false, "쓰레기 바이트: ok false");
  const p = K.parse(plain);
  eq([p.format, p.messages.length, p.speakers.length], [null, 0, 0], "평문: 빈 결과 모양");
  ok(K.textOf(p, {}) === "", "평문: textOf 빈 문자열");
}

/* ------------------------------------------------------------ 날짜 없는 대화 */

{
  const noDate = `테스트방
저장한 날짜 : 2024-01-03 15:04:05

[홍길동] [오전 9:05] 날짜 구분선이 없다
[김철수] [오전 9:06] 그래도 읽혀야 한다`;
  const p = K.parse(noDate);
  eq(p.format, "windows", "날짜 없음: format");
  eq(p.messages.map((m) => m.t), [null, null], "날짜 없음: t 는 null");
  eq(p.first, null, "날짜 없음: first null");
  eq(K.textOf(p, { from: ms(2024, 1, 1, 0, 0), to: ms(2024, 1, 2, 0, 0) }),
    "날짜 구분선이 없다\n그래도 읽혀야 한다", "날짜 없음: 기간 필터를 통과");
}

/* ------------------------------------------------------------ textOf 필터 */

{
  const p = K.parse(ANDROID);
  eq(K.textOf(p, {}),
    "안녕하세요\n네 안녕하세요\n여러 줄로 쓰면\n이렇게 이어집니다\n점심 먹으러 가요\n자정 테스트\n여기 봐 재밌어",
    "textOf: 전체");
  eq(K.textOf(p, { speakers: new Set(["홍길동"]) }),
    "안녕하세요\n점심 먹으러 가요\n여기 봐 재밌어", "textOf: 화자 Set 필터");
  eq(K.textOf(p, { speakers: ["김철수"] }),
    "네 안녕하세요\n여러 줄로 쓰면\n이렇게 이어집니다\n자정 테스트", "textOf: 화자 배열 필터");
  eq(K.textOf(p, { from: ms(2024, 1, 3, 9, 6), to: ms(2024, 1, 3, 12, 0) }),
    "네 안녕하세요\n여러 줄로 쓰면\n이렇게 이어집니다\n점심 먹으러 가요", "textOf: 기간 필터");
  eq(K.textOf(p, { speakers: new Set(["홍길동"]), from: ms(2024, 1, 3, 13, 0), to: null }),
    "여기 봐 재밌어", "textOf: 화자 + 기간");
  eq(K.textOf(p, { speakers: new Set([]) }), "", "textOf: 빈 Set 이면 아무것도 안 나온다");
  eq(K.textOf(null, {}), "", "textOf: null 방어");
}

/* ------------------------------------------------------------ 방 이름 변형 */

{
  const g = `우리 4인방 카카오톡 대화
저장한 날짜 : 2024-01-03 15:04:05

2024년 1월 3일 오전 9:05, 홍길동 : 하이`;
  eq(K.parse(g).room, "우리 4인방", "방 이름: OOO 카카오톡 대화");
  const h = `김과장님과의 카카오톡 대화
저장한 날짜 : 2024-01-03 15:04:05

2024년 1월 3일 오전 9:05, 홍길동 : 하이`;
  eq(K.parse(h).room, "김과장", "방 이름: OOO님과의 카카오톡 대화");
}

/* ------------------------------------------------------------ 본문 필터 목록 */

{
  const items = ["사진", "동영상", "이모티콘", "음성메시지", "삭제된 메시지입니다.",
    "보이스룸이 종료되었습니다.", "사진 1장", "사진 12장", "파일: a.zip", "샵검색: 맛집"];
  const lines = items.map((s, i) =>
    "2024년 1월 3일 오전 9:" + String(10 + i).padStart(2, "0") + ", 홍길동 : " + s);
  const t = "홍길동님과 카카오톡 대화\n저장한 날짜 : 2024-01-03 15:04:05\n\n" +
    lines.join("\n") + "\n2024년 1월 3일 오전 9:59, 홍길동 : 남는 문장";
  const p = K.parse(t);
  eq(p.filteredCount, items.length, "필터: 목록 전부 걸러진다");
  eq(bodies(p), ["남는 문장"], "필터: 진짜 문장만 남는다");
  const t2 = "홍길동님과 카카오톡 대화\n저장한 날짜 : x\n\n2024년 1월 3일 오전 9:05, 홍길동 : 사진첩 정리했어";
  eq(bodies(K.parse(t2)), ["사진첩 정리했어"], "필터: 부분 일치는 통과");
}

/* ------------------------------------------------------------ URL 제거 */

{
  const t = `홍길동님과 카카오톡 대화
저장한 날짜 : 2024-01-03 15:04:05

2024년 1월 3일 오전 9:05, 홍길동 : http://a.com/1 https://b.co/2 여러 개
2024년 1월 3일 오전 9:06, 홍길동 : https://only-url.example.com/path
2024년 1월 3일 오전 9:07, 홍길동 : httpsss 는 안 지운다`;
  const p = K.parse(t);
  eq(bodies(p), ["여러 개", "httpsss 는 안 지운다"], "URL: 제거 + URL만 있으면 걸러짐");
  eq(p.filteredCount, 1, "URL: URL만 있던 메시지는 filteredCount 로");
}

/* ------------------------------------------------------------ CRLF / 큰 입력 */

{
  const p = K.parse(ANDROID.replace(/\n/g, "\r\n"));
  eq(p.format, "android", "CRLF: format");
  eq(bodies(p), bodies(K.parse(ANDROID)), "CRLF: LF 결과와 같다");
}

{
  // 대략 12MB 짜리 입력도 선형 시간에 끝나야 한다
  const one = "2024년 1월 3일 오전 9:05, 홍길동 : 가나다라마바사아자차카타파하 오늘도 좋은 하루\n";
  const big = "홍길동님과 카카오톡 대화\n저장한 날짜 : x\n\n" + one.repeat(120000);
  const t0 = Date.now();
  const p = K.parse(big);
  const dt = Date.now() - t0;
  eq(p.messages.length, 120000, "대용량: 메시지 수");
  ok(dt < 15000, "대용량: " + dt + "ms 안에 끝난다");
}

/* ------------------------------------------------------------ 기타 API */

{
  eq(Object.keys(K.FORMATS).sort(), ["android", "ios", "macos", "windows"], "FORMATS 키 4종");
  ok(typeof K.readFile === "function", "readFile 존재");
  ok(K.MAX_BYTES === 50 * 1024 * 1024, "MAX_BYTES 50MB");
}

/* ------------------------------------------------------------ readFile (FileReader 흉내) */

// "홍길동님과 카카오톡 대화 안녕하세요" 를 euc-kr 로 인코딩한 바이트.
// utf-8 로 읽으면 U+FFFD 투성이가 되므로 euc-kr 재시도 경로를 탄다.
const EUC_KR_BYTES = Uint8Array.from([
  200, 171, 177, 230, 181, 191, 180, 212, 176, 250, 32, 196, 171, 196, 171,
  191, 192, 197, 229, 32, 180, 235, 200, 173, 32, 190, 200, 179, 231, 199,
  207, 188, 188, 191, 228
]);
const EXPECT_KR = "홍길동님과 카카오톡 대화 안녕하세요";

function installFileReader() {
  function FR() { this.onload = null; this.onerror = null; this.result = null; }
  FR.prototype.readAsArrayBuffer = function (f) {
    const self = this;
    setTimeout(function () {
      self.result = f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength);
      self.onload();
    }, 0);
  };
  FR.prototype.readAsText = function (f, enc) {
    const self = this;
    setTimeout(function () {
      self.result = new TextDecoder(enc).decode(f.bytes);
      self.onload();
    }, 0);
  };
  globalThis.FileReader = FR;
}
function fakeFile(bytes) { return { size: bytes.length, bytes: bytes }; }

async function readFileTests() {
  installFileReader();
  const utf8 = new TextEncoder().encode("홍길동님과 카카오톡 대화\n안녕");

  eq(await K.readFile(fakeFile(utf8)), "홍길동님과 카카오톡 대화\n안녕", "readFile: utf-8 그대로");

  const bom = new Uint8Array(3 + utf8.length);
  bom.set([0xEF, 0xBB, 0xBF]); bom.set(utf8, 3);
  eq(await K.readFile(fakeFile(bom)), "홍길동님과 카카오톡 대화\n안녕", "readFile: BOM 제거");

  eq(await K.readFile(fakeFile(EUC_KR_BYTES)), EXPECT_KR, "readFile: euc-kr 재디코딩");

  // TextDecoder 없는 낡은 브라우저 경로 (readAsText 두 번)
  const saved = globalThis.TextDecoder;
  const Real = saved;
  globalThis.TextDecoder = undefined;
  globalThis.FileReader.prototype.readAsText = function (f, enc) {
    const self = this;
    setTimeout(function () { self.result = new Real(enc).decode(f.bytes); self.onload(); }, 0);
  };
  try {
    eq(await K.readFile(fakeFile(EUC_KR_BYTES)), EXPECT_KR, "readFile: TextDecoder 없을 때 readAsText 경로");
  } finally {
    globalThis.TextDecoder = saved;
  }

  let err = null;
  try { await K.readFile({ size: 60 * 1024 * 1024 }); } catch (e) { err = e; }
  ok(err instanceof Error && err.message === "파일이 너무 큽니다", "readFile: 50MB 초과 거절",
    "실제: " + (err && err.message));

  err = null;
  try { await K.readFile(null); } catch (e) { err = e; }
  ok(err instanceof Error, "readFile: 빈 인자 거절");
}

await readFileTests();

/* ------------------------------------------------------------ 결과 */

if (fails.length) {
  console.error("실패 " + fails.length + "건 / 통과 " + pass + "건");
  fails.forEach((f, i) => console.error("  " + (i + 1) + ") " + f));
  process.exit(1);
}
console.log("통과 " + pass + "건 — 전부 성공");

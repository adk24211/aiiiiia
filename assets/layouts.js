/* KeyMiles — 자판 데이터
 * 자판표 3종과 자모 조합 규칙은 libhangul 원본 소스에서 기계 추출했습니다.
 *   https://github.com/libhangul/libhangul  hangul/hangulkeyboard.h
 *   hangul_keyboard_table_2 / _390 / _3final, hangul_combination_table_default
 * 사람 손으로 옮겨 적은 값은 하나도 없습니다. 정정 제안은 GitHub 이슈로.
 *
 * 인덱스 규약: 초성 19 (U+1100~), 중성 21 (U+1161~), 종성 27 (U+11A8~).
 * 문자열의 i번째 글자 = 그 자모를 내는 키. 공백이면 그 자판에 없는 자모(조합으로 침).
 */
(function (root) {
  "use strict";

  var LAYOUTS = {
    dubeol: {
      id: "dubeol", name: "두벌식 표준", short: "두벌식", note: "KS X 5002 · 국가표준",
      twoSet: true,
      cho:  "rRseEfaqQtTdwWczxvg",
      jung: "koiOjpuPh   yn   bm l",
      jong: "                           ",
      jungLead: null
    },
    s390: {
      id: "s390", name: "세벌식 390", short: "390", note: "공병우 3-90",
      twoSet: false,
      cho:  "k hu yi; n jl o0'pm",
      jung: "fr6Rtce7v   4b   5g8d",
      jong: "xF s SAwDC    Vz3Xq2a!ZEWQ1",
      // 겹모음의 앞 자모일 때만 쓰는 오른손 자리 (ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ)
      jungLead: { 8: "/", 13: "9" }
    },
    sfinal: {
      id: "sfinal", name: "세벌식 최종", short: "최종", note: "공병우 3-91 최종",
      twoSet: false,
      cho:  "k hu yi; n jl o0'pm",
      jung: "fr6Gtce7v   4b   5g8d",
      jong: "x!VsESAw@FDT%$Rz3Xq2a#ZCWQ1",
      // 겹모음의 앞 자모일 때만 쓰는 오른손 자리 (ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ)
      jungLead: { 8: "/", 13: "9" }
    }
  };

  root.KM_DATA = {
    LAYOUTS: LAYOUTS,
    ORDER: ["dubeol", "s390", "sfinal"],
    // 조합 규칙: i번째 자모 = 두 자모의 조합. "  "이면 조합 불가(단일 자모).
    COMB_CHO:  "  00    33      77  99    cc          ",
    COMB_JUNG: "                  80818k    d4d5dk    ik  ",
    COMB_JONG: "  000i  3l3q    707f7g7i7o7p7q    gi  ii              ",
    // 두벌식용: 종성 27개 -> 초성 키 순서 (겹받침은 초성 두 번)
    JONG2CHO: ["0","1","09","2","2c","2i","3","5","50","56","57","59","5g","5h","5i","6","7","79","9","a","b","c","e","f","g","h","i"],
    // 호환 자모 U+3131~U+314E (ㄱ~ㅎ 30개) -> 초성 인덱스 (ㅋㅋㅋ, ㅇㅇ 같은 입력용)
    COMPAT_CONS: ["0","1","09","2","2c","2i","3","4","5","50","56","57","59","5g","5h","5i","6","7","8","79","9","a","b","c","d","e","f","g","h","i"],
    // 화면 표시용 호환 자모 (조합용 자모는 단독으로 그리면 깨져 보인다)
    SHOW_CHO:  "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",
    SHOW_JUNG: "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ",
    SHOW_JONG: "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"
  };
})(typeof window !== "undefined" ? window : globalThis);

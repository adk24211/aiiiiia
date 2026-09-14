/* 손가락 마일리지 — 골든 벡터. 브라우저(test.html)와 node(tools/test-engine.mjs) 양쪽에서 돈다. */
(function (root) {
  "use strict";
  var D = root.KM_DATA, E = root.KM_ENGINE;
  var L = function (id) { return D.LAYOUTS[id]; };

  var DEMO = "안녕하세요 오늘 날씨가 참 좋네요 밖에 나가서 산책이라도 할까요 값싼 물건도 많이 샀어요\n" +
             "읽던 책을 다시 펼쳤다 ㅋㅋㅋ ㅠㅠ 넓은 하늘 아래 우리는 웃었다 의사 선생님께 여쭤봤어요";

  /* A. 타건열 — 자판표에서 유일하게 결정되는 값 */
  var STROKES = [
    ["한글 자판 실험", "dubeol", "gksrmf wkvks tlfgja"],
    ["한글 자판 실험", "s390",   "mfskgw lfpfs ndwmtz"],
    ["한글 자판 실험", "sfinal", "mfskgw lfpfs ndwmtz"],
    ["밖", "dubeol", "qkR"],   ["밖", "sfinal", ";f!"],   ["밖", "s390", ";fF"],
    ["값", "dubeol", "rkqt"],  ["값", "s390",   "kfX"],   ["값", "sfinal", "kfX"],
    ["읽", "s390",   "jdD"],   ["읽", "sfinal", "jd@"],
    ["늴", "dubeol", "smlf"],  ["늴", "sfinal", "h8w"],
    ["과", "dubeol", "rhk"],   ["과", "sfinal", "k/f"],
    ["뭬", "dubeol", "anp"],   ["뭬", "sfinal", "i9c"],
    ["앉", "s390",   "jfs!"],  ["앉", "sfinal", "jfE"],
    ["ㅋㅋㅋ", "dubeol", "zzz"], ["ㅠㅠ", "dubeol", "bb"],
    ["쌌", "dubeol", "TkT"],   ["쌌", "sfinal", "nnf2"]
  ];

  /* B. 지표 — 기본 모형(kla), 키 간격 19.05㎜.
     "한" = gks 는 손으로 계산해 검증: LI f→g 1.0u, 되돌아오기 1.0u, 나머지 0 → 2.000u = 38.10㎜ */
  var METRICS = [
    ["한", "dubeol", { totalStrokes: 3, mm: 38.1, shifts: 0 }],
    ["한글 자판 실험", "dubeol", { totalStrokes: 19, mm: 287.6, shifts: 0 }],
    ["한글 자판 실험", "s390",   { totalStrokes: 19, mm: 373.9, shifts: 0 }],
    ["한글 자판 실험", "sfinal", { totalStrokes: 19, mm: 373.9, shifts: 0 }],
    [DEMO, "dubeol", { totalStrokes: 218, mm: 4461.8, shifts: 10, sfbPct: 1.82, altPct: 78.2, homePct: 53.3, numRowPct: 0.0 }],
    [DEMO, "s390",   { totalStrokes: 213, mm: 5288.2, shifts: 4,  sfbPct: 1.25, altPct: 74.4, homePct: 42.1, numRowPct: 9.8 }],
    [DEMO, "sfinal", { totalStrokes: 213, mm: 5428.5, shifts: 5,  sfbPct: 1.25, altPct: 75.6, homePct: 41.8, numRowPct: 10.4 }]
  ];

  function one(layout, text, opt) {
    var o = { layouts: [L(layout)], unit: (opt && opt.unit) || 19.05 };
    if (opt && opt.model) o.model = opt.model;      // 지정하지 않으면 기본 모형을 쓴다
    return E.analyze(text, o).results[0];
  }

  function run() {
    var rows = [], i;

    for (i = 0; i < STROKES.length; i++) {
      var s = STROKES[i], got = E.strokeString(L(s[1]), s[0]);
      rows.push({ name: "타건열 · " + s[0] + " · " + L(s[1]).short, want: s[2], got: got, ok: got === s[2] });
    }

    for (i = 0; i < METRICS.length; i++) {
      var m = METRICS[i], r = one(m[1], m[0]);
      var label = (m[0] === DEMO ? "예시문 140자" : m[0]) + " · " + L(m[1]).short;
      for (var k in m[2]) {
        var want = m[2][k], gotv = r[k];
        var tol = k === "mm" ? 0.15 : (k.slice(-3) === "Pct" ? 0.06 : 0);
        var ok = Math.abs(gotv - want) <= tol;
        rows.push({ name: label + " · " + k, want: String(want), got: (Math.round(gotv * 100) / 100).toString(), ok: ok });
      }
    }

    /* C. 불변식 */
    function inv(name, want, got) { rows.push({ name: name, want: String(want), got: String(got), ok: String(want) === String(got) }); }

    var empty = E.analyze("");
    inv("빈 입력 · 이동거리 0", 0, empty.results[0].mm);
    inv("빈 입력 · SFB NaN 없음", "false", String(isNaN(empty.results[0].sfbPct)));
    var ascii = E.analyze("abc123!");
    inv("영문만 · 한글 0자", 0, ascii.text.syllables);
    inv("영문만 · 제외 7자", 7, ascii.text.skipped);

    var nfc = E.analyze("한글 자판 실험").results.map(function (r) { return r.mm.toFixed(4); }).join("|");
    var nfd = E.analyze("한글 자판 실험".normalize("NFD")).results.map(function (r) { return r.mm.toFixed(4); }).join("|");
    inv("NFD 입력도 같은 결과", nfc, nfd);

    D.ORDER.forEach(function (id) {
      inv("자모 67개 전부 입력 가능 · " + L(id).short, 0, E.compiledFor(L(id)).missing.length);
    });

    // 같은 입력이면 항상 같은 결과 (난수·시각 의존 없음)
    var d1 = E.analyze(DEMO).results.map(function (r) { return r.mm; }).join("|");
    var d2 = E.analyze(DEMO).results.map(function (r) { return r.mm; }).join("|");
    inv("결정론 · 두 번 돌려도 같은 값", d1, d2);

    // 자판을 하나만 넘기든 셋을 넘기든 각 자판의 결과는 같아야 한다
    inv("자판 목록 순서 무관", one("sfinal", DEMO).mm.toFixed(4),
        E.analyze(DEMO).results[2].mm.toFixed(4));

    // 이상한 입력에서도 유한한 값이 나와야 한다
    var weird = ["", " ", "\n\n", "😀🙃", "漢字", "ＡＢＣ", "\u3164", "\u111b\u1161",
                 "ㄱ", "ㅢ", "ㅘ", "ㄳ", "\\", "가".repeat(5000)];
    var bad = weird.filter(function (t) {
      return E.analyze(t).results.some(function (r) {
        return !isFinite(r.mm) || r.mm < 0 || !isFinite(r.sfbPct) || !isFinite(r.altPct) || !isFinite(r.homePct);
      });
    });
    inv("이상 입력 12종 · NaN/무한/음수 없음", 0, bad.length);

    // 세벌식 겹모음 타법 토글이 실제로 키열을 바꾸는가
    inv("겹모음 앞자리 · 오른손 자리", "k/f", E.strokeString(L("sfinal"), "과"));
    E.setLeadStyle(false);
    inv("겹모음 앞자리 · 항상 왼손 자리", "kvf", E.strokeString(L("sfinal"), "과"));
    E.setLeadStyle(true);
    inv("토글을 되돌리면 원래대로", "k/f", E.strokeString(L("sfinal"), "과"));
    // ㅢ(=ㅡ+ㅣ)는 겹모음 자리 규칙을 타지 않는다
    inv("ㅢ 는 겹모음 자리 규칙 밖", "h8w", E.strokeString(L("sfinal"), "늴"));

    // 백슬래시 글쇠가 손가락에 배정되어 있는가 (이스케이프 사고 회귀 방지)
    inv("백슬래시 = 오른손 새끼", 7, E.GEOM.ansi.finger[92]);
    inv("백슬래시 중심 = 14.25u (폭 1.5u)", 14.25, E.GEOM.ansi.x[92]);

    // 스페이스도 엄지 타건으로 집계된다
    var sp = one("dubeol", "가 나 다");
    inv("엄지 부담이 0이 아니다", "true", String(sp.fingerPct[8] > 0));
    inv("좌우 합계 100 (엄지 제외)", 100, Math.round(sp.leftPct + sp.rightPct));

    // 이모지는 한 글자로 센다
    inv("서러게이트 쌍 · 제외 3자", 3, E.analyze("😀😀😀").text.skipped);
    // 옛한글은 뒤따르는 모음까지 함께 버린다 (유령 통계 방지)
    inv("옛한글 자모열 · 전부 제외", 2, E.analyze("\u111b\u1161").text.skipped);

    var half = E.analyze(DEMO, { unit: 9.525 }).results[0].mm;
    inv("키 간격 절반 → 거리 절반", (4461.8 / 2).toFixed(1), half.toFixed(1));

    var home = one("dubeol", DEMO, { model: "home" });
    inv("홈 복귀 모형이 기본보다 멀거나 같다", "true", String(home.mm >= 4461.8));

    var kk = one("dubeol", "ㅋㅋㅋㅋ");
    inv("같은 키 연타 · SFB 0%", 0, Math.round(kk.sfbPct));
    inv("같은 키 연타 · 연타 100%", 100, Math.round(kk.repeatPct));

    // 기본 모형은 글이 길어지면 거리도 길어져야 한다 (예전 keep 모형은 여기서 포화됐다)
    var s10 = one("dubeol", "세".repeat(10)).mm, s30 = one("dubeol", "세".repeat(30)).mm;
    inv("반복이 많은 글도 거리가 늘어난다", (s10 * 3).toFixed(0), s30.toFixed(0));
    var keep30 = one("dubeol", "세".repeat(30), { model: "keep" }).mm;
    inv("손가락 유지 모형은 반복에서 포화된다(의도된 성질)", "true",
        String(keep30 < one("dubeol", "세".repeat(10), { model: "keep" }).mm * 1.01));

    // 시프트는 누르고 있는다 — 연속 시프트를 매번 새로 누르지 않는다
    inv("ㅆㅆㅆ · 시프트 1회", 1, one("dubeol", "ㅆㅆㅆ").shifts);
    inv("있따 · 연속 시프트 1회", 1, one("dubeol", "있따").shifts);
    // 시프트도 손가락을 쓰므로 같은 손가락 연속에 잡혀야 한다 (두벌식 ㅔ=p, ㅃ=shift+q → 오른새끼 연속)
    inv("시프트가 만드는 같은 손가락 연속을 잡는다", "true", String(one("dubeol", "ㅔㅃ").sfb === 1));

    // analyze()가 돌려주는 옵션은 실제로 쓴 값이어야 한다
    var badOpt = E.analyze("가", { unit: -5, model: "HOME" }).options;
    inv("잘못된 옵션은 기본값으로 보고", "19.05|kla", badOpt.unit + "|" + badOpt.model);

    var pass = 0, fail = 0;
    rows.forEach(function (r) { if (r.ok) pass++; else fail++; });
    return { rows: rows, pass: pass, fail: fail };
  }

  root.KM_TESTS = { run: run, DEMO: DEMO };
})(typeof window !== "undefined" ? window : globalThis);

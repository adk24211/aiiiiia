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

  /* B. 지표 — 손으로 계산해 검증한 값 (키 간격 19.05㎜, 손가락 유지 모델) */
  var METRICS = [
    ["한글 자판 실험", "dubeol", { totalStrokes: 19, mm: 253.6, shifts: 0 }],
    ["한글 자판 실험", "s390",   { totalStrokes: 19, mm: 221.2, shifts: 0 }],
    ["한글 자판 실험", "sfinal", { totalStrokes: 19, mm: 221.2, shifts: 0 }],
    [DEMO, "dubeol", { totalStrokes: 218, mm: 2710.2, shifts: 10, sfbPct: 3.23, altPct: 78.1, homePct: 53.3, numRowPct: 0.0 }],
    [DEMO, "s390",   { totalStrokes: 213, mm: 3603.3, shifts: 4,  sfbPct: 1.28, altPct: 71.2, homePct: 42.1, numRowPct: 9.8 }],
    [DEMO, "sfinal", { totalStrokes: 213, mm: 3651.6, shifts: 5,  sfbPct: 1.29, altPct: 71.6, homePct: 41.8, numRowPct: 10.4 }]
  ];

  function one(layout, text, opt) {
    return E.analyze(text, { layouts: [L(layout)], model: (opt && opt.model) || "keep",
                             unit: (opt && opt.unit) || 19.05 }).results[0];
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
                 "ㄱ", "ㅢ", "ㅘ", "가".repeat(5000)];
    var bad = weird.filter(function (t) {
      return E.analyze(t).results.some(function (r) {
        return !isFinite(r.mm) || r.mm < 0 || !isFinite(r.sfbPct) || !isFinite(r.altPct) || !isFinite(r.homePct);
      });
    });
    inv("이상 입력 12종 · NaN/무한/음수 없음", 0, bad.length);

    // 대안 기하·모델도 죽지 않는다
    var mob = E.analyze(DEMO, { geometry: "mobile" }).results[0];
    inv("스마트폰 기하 · 유한한 거리", "true", String(isFinite(mob.mm) && mob.mm > 0));

    var half = E.analyze(DEMO, { unit: 9.525 }).results[0].mm;
    inv("키 간격 절반 → 거리 절반", (2710.2 / 2).toFixed(1), half.toFixed(1));

    var home = one("dubeol", "한글 자판 실험", { model: "home" });
    inv("홈 복귀 모델이 더 멀거나 같다", "true", String(home.mm >= 253.6));

    var kk = one("dubeol", "ㅋㅋㅋㅋ");
    inv("같은 키 연타 · SFB 0%", 0, Math.round(kk.sfbPct));
    inv("같은 키 연타 · 연타 100%", 100, Math.round(kk.repeatPct));

    var pass = 0, fail = 0;
    rows.forEach(function (r) { if (r.ok) pass++; else fail++; });
    return { rows: rows, pass: pass, fail: fail };
  }

  root.KM_TESTS = { run: run, DEMO: DEMO };
})(typeof window !== "undefined" ? window : globalThis);

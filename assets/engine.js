/* KeyMiles — 계산 엔진
 * 한국어 텍스트 -> 자모열 -> 자판별 실제 타건열 -> 손가락 이동거리와 지표.
 * DOM에 손대지 않는 순수 함수 모음. 난수 없음 — 같은 입력이면 항상 같은 결과.
 */
(function (root) {
  "use strict";

  var D = root.KM_DATA;

  /* ---------------------------------------------------------------- 기하 */

  var U_DEFAULT = 19.05;                 // 1u = 19.05mm (0.75인치, 표준 키캡 피치)

  // ANSI 104키. xoff = 각 줄 왼쪽 모디파이어 폭(Tab 1.5u, Caps 1.75u, LShift 2.25u)
  var ANSI_ROWS = [
    { keys: "`1234567890-=",   xoff: 0.00 },
    { keys: "qwertyuiop[]\\",  xoff: 1.50 },
    { keys: "asdfghjkl;'",     xoff: 1.75 },
    { keys: "zxcvbnm,./",      xoff: 2.25 }
  ];

  var FINGERS = ["LP", "LR", "LM", "LI", "RI", "RM", "RR", "RP"];
  var FINGER_KO = ["왼손 새끼", "왼손 약지", "왼손 중지", "왼손 검지",
                   "오른손 검지", "오른손 중지", "오른손 약지", "오른손 새끼"];
  var FINGER_KEYS = ["`1qaz", "2wsx", "3edc", "45rtfgvb",
                     "67yuhjnm", "8ik,", "9ol.", "0-=p[]\;'/"];
  var HOME_KEYS = "asdfjkl;";            // 손가락 인덱스 순서와 동일

  var SHIFT_PAIRS = [
    "~`", "!1", "@2", "#3", "$4", "%5", "^6", "&7", "*8", "(9", ")0", "_-", "+=",
    "QqWwEeRrTtYyUuIiOoPp", "{[", "}]", "|\\",
    "AaSsDdFfGgHhJjKkLl", ":;", "\"'",
    "ZzXxCcVvBbNnMm", "<,", ">.", "?/"
  ].join("");

  function buildGeometry(kind) {
    var g = {
      x: new Float64Array(128), y: new Float64Array(128),
      finger: new Int8Array(128), row: new Int8Array(128),
      shiftBase: new Int8Array(128), homeX: new Float64Array(8), homeY: new Float64Array(8),
      shiftX: new Float64Array(2), shiftY: new Float64Array(2), kind: kind
    };
    g.finger.fill(-1); g.row.fill(-1); g.shiftBase.fill(-1);

    var i, j, c;
    if (kind === "mobile") {
      // 스마트폰 세로 쿼티: 균일 10열 격자, 좌 5열 왼엄지 / 우 5열 오른엄지.
      var MROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
      var moff = [0, 0.5, 1.5];
      for (i = 0; i < MROWS.length; i++) {
        for (j = 0; j < MROWS[i].length; j++) {
          c = MROWS[i].charCodeAt(j);
          g.x[c] = moff[i] + j + 0.5; g.y[c] = i + 0.5;
          g.finger[c] = (moff[i] + j) < 5 ? 3 : 4;   // 왼엄지=LI 슬롯, 오른엄지=RI 슬롯
          g.row[c] = i + 1;
        }
      }
      // 숫자·기호는 별도 레이어(한 번 더 탭). 자리는 첫 줄 위 가상 행으로 둔다.
      var MNUM = "1234567890";
      for (j = 0; j < 10; j++) { c = MNUM.charCodeAt(j); g.x[c] = j + 0.5; g.y[c] = -0.5; g.finger[c] = j < 5 ? 3 : 4; g.row[c] = 0; }
      var MSYM = "-=[]\;',./`";
      for (j = 0; j < MSYM.length; j++) { c = MSYM.charCodeAt(j); if (g.finger[c] === -1) { g.x[c] = 9.5; g.y[c] = 3.5; g.finger[c] = 4; g.row[c] = 3; } }
      g.homeX[3] = 2.5; g.homeY[3] = 1.5; g.homeX[4] = 7.5; g.homeY[4] = 1.5;
      for (i = 0; i < 8; i++) if (i !== 3 && i !== 4) { g.homeX[i] = i < 4 ? 2.5 : 7.5; g.homeY[i] = 1.5; }
      g.shiftX[0] = 0.5; g.shiftY[0] = 3.5; g.shiftX[1] = 9.5; g.shiftY[1] = 3.5;
    } else {
      for (i = 0; i < ANSI_ROWS.length; i++) {
        var r = ANSI_ROWS[i];
        for (j = 0; j < r.keys.length; j++) {
          c = r.keys.charCodeAt(j);
          g.x[c] = r.xoff + j + 0.5;
          g.y[c] = i + 0.5;
          g.row[c] = i;
        }
      }
      for (i = 0; i < FINGER_KEYS.length; i++)
        for (j = 0; j < FINGER_KEYS[i].length; j++)
          g.finger[FINGER_KEYS[i].charCodeAt(j)] = i;
      for (i = 0; i < 8; i++) {
        c = HOME_KEYS.charCodeAt(i);
        g.homeX[i] = g.x[c]; g.homeY[i] = g.y[c];
      }
      // 왼쪽 시프트 폭 2.25u -> 중심 1.125 / 오른쪽 시프트는 '/' 뒤 폭 2.75u -> 중심 13.625
      g.shiftX[0] = 1.125; g.shiftY[0] = 3.5;
      g.shiftX[1] = 13.625; g.shiftY[1] = 3.5;
    }

    for (i = 0; i < SHIFT_PAIRS.length; i += 2)
      g.shiftBase[SHIFT_PAIRS.charCodeAt(i)] = SHIFT_PAIRS.charCodeAt(i + 1);

    return g;
  }

  var GEOM = { ansi: buildGeometry("ansi"), mobile: buildGeometry("mobile") };

  /* ------------------------------------------------- 자모 -> 키열 사전화 */

  var SPACE = -1, UNMAPPED = -2;
  var T_CHO = 0, T_JUNG = 100, T_JONG = 200;   // 토큰 = 종류 오프셋 + 인덱스

  function combOf(s, i) {
    var a = s.charAt(i * 2), b = s.charAt(i * 2 + 1);
    return a === " " ? null : [parseInt(a, 36), parseInt(b, 36)];
  }

  /* 한 자모를 치는 키 문자열. lead=true면 겹모음의 앞 자모(세벌식 오른손 자리). */
  function keysFor(L, kind, idx, lead, depth) {
    if (depth > 4) return "?";
    var direct;
    if (kind === "jung" && lead && L.jungLead && L.jungLead[idx]) return L.jungLead[idx];
    direct = L[kind].charAt(idx);
    if (direct && direct !== " ") return direct;

    if (kind === "jong" && L.twoSet) {          // 두벌식: 종성 전용 키가 없다
      var seq = D.JONG2CHO[idx], out = "", k;
      for (var i = 0; i < seq.length; i++) {
        k = keysFor(L, "cho", parseInt(seq.charAt(i), 36), false, depth + 1);
        if (k === "?") return "?";
        out += k;
      }
      return out;
    }

    var table = kind === "cho" ? D.COMB_CHO : kind === "jung" ? D.COMB_JUNG : D.COMB_JONG;
    var c = combOf(table, idx);
    if (c) {
      var a = keysFor(L, kind, c[0], true, depth + 1);
      var b = keysFor(L, kind, c[1], false, depth + 1);
      if (a !== "?" && b !== "?") return a + b;
    }
    return "?";
  }

  /* 자판 하나당 67개 자모의 키열을 미리 만들어 둔다 (분석 루프를 O(1)로). */
  function compile(L) {
    var t = { cho: [], jung: [], jong: [], layout: L, missing: [] };
    var i;
    for (i = 0; i < 19; i++) t.cho[i] = keysFor(L, "cho", i, false, 0);
    for (i = 0; i < 21; i++) t.jung[i] = keysFor(L, "jung", i, false, 0);
    for (i = 0; i < 27; i++) t.jong[i] = keysFor(L, "jong", i, false, 0);
    ["cho", "jung", "jong"].forEach(function (k) {
      t[k].forEach(function (v, ix) { if (v === "?") t.missing.push(k + ix); });
    });
    return t;
  }

  /* ------------------------------------------------------ 텍스트 -> 자모 */

  var S_BASE = 0xAC00, S_LAST = 0xD7A3, N_COUNT = 588, T_COUNT = 28, V_COUNT = 21;

  function decompose(text) {
    text = String(text).normalize("NFC");
    var n = text.length;
    var buf = new Int32Array(Math.max(16, n * 3 + 8));
    var len = 0, syllables = 0, skipped = 0, jamoChars = 0;

    function push(v) {
      if (len >= buf.length) { var nb = new Int32Array(buf.length * 2); nb.set(buf); buf = nb; }
      buf[len++] = v;
    }

    for (var i = 0; i < n; i++) {
      var cp = text.charCodeAt(i);
      if (cp >= S_BASE && cp <= S_LAST) {                       // 완성형 음절
        var s = cp - S_BASE;
        push(T_CHO + ((s / N_COUNT) | 0));
        push(T_JUNG + (((s % N_COUNT) / T_COUNT) | 0));
        var tj = s % T_COUNT;
        if (tj > 0) push(T_JONG + (tj - 1));
        syllables++;
      } else if (cp >= 0x1100 && cp <= 0x1112) { push(T_CHO + (cp - 0x1100)); jamoChars++; }
      else if (cp >= 0x1161 && cp <= 0x1175) { push(T_JUNG + (cp - 0x1161)); jamoChars++; }
      else if (cp >= 0x11A8 && cp <= 0x11C2) { push(T_JONG + (cp - 0x11A8)); jamoChars++; }
      else if (cp >= 0x3131 && cp <= 0x314E) {                  // 호환 자음 ㄱ~ㅎ (ㅋㅋㅋ)
        var seq = D.COMPAT_CONS[cp - 0x3131];
        for (var q = 0; q < seq.length; q++) push(T_CHO + parseInt(seq.charAt(q), 36));
        jamoChars++;
      }
      else if (cp >= 0x314F && cp <= 0x3163) { push(T_JUNG + (cp - 0x314F)); jamoChars++; }   // ㅏ~ㅣ (ㅠㅠ)
      else if (cp === 32 || cp === 9 || cp === 10 || cp === 13) { push(SPACE); }
      else { skipped++; }
    }
    return { tokens: buf, length: len, syllables: syllables, jamoChars: jamoChars, skipped: skipped };
  }

  /* ------------------------------------------------------------- 측정 */

  /* 이동거리 모델 세 가지.
   *
   *  kla  (기본)  한 손가락이 키로 가는 동안, 이번에 쓰지 않는 손가락들은 홈으로 돌아온다.
   *               영문 자판 분석에서 널리 쓰이는 방식(patorjk/stevep99 keyboard-layout-analyzer)과
   *               같은 규칙이다. 같은 키를 연달아 치면 그 손가락은 제자리에 있으므로 추가 거리가
   *               붙지 않고, 손을 옮겨 다니면 되돌아오는 거리까지 계산된다.
   *  keep         친 자리에 손가락이 계속 머문다. 순수한 좌우 이동만 잰다. 같은 키 반복은 0이라
   *               ㅋㅋㅋ 같은 글에서 거리가 포화된다(장점이자 함정).
   *  home         타건마다 홈에서 왕복한다. 가장 엄격한 교본식.
   *
   * 시프트는 셋 모두에서 "누르고 있는" 것으로 본다 — 연속으로 시프트가 필요한 글자를 칠 때
   * 새끼손가락이 매번 왕복하지 않는다. 실제 타자가 그렇다.
   */
  function measure(compiled, dec, opt) {
    opt = opt || {};
    var g = GEOM[opt.geometry === "mobile" ? "mobile" : "ansi"];
    var unit = typeof opt.unit === "number" && opt.unit > 0 ? opt.unit : U_DEFAULT;
    var model = opt.model === "home" ? "home" : opt.model === "keep" ? "keep" : "kla";

    var cx = new Float64Array(8), cy = new Float64Array(8);
    for (var i = 0; i < 8; i++) { cx[i] = g.homeX[i]; cy[i] = g.homeY[i]; }

    var keyCount = new Int32Array(128), fingerLoad = new Int32Array(8), rowCount = new Int32Array(5);
    var dist = 0, keyStrokes = 0, spaces = 0, shifts = 0, unmapped = 0, shiftL = 0, shiftR = 0;
    var bigrams = 0, sfb = 0, alt = 0, repeats = 0, homeHits = 0;
    var prevFinger = -1, prevBase = -1;
    var heldShift = -1;                       // 지금 시프트를 누르고 있는 손가락 (-1 = 안 누름)

    function goTo(f, x, y) {                  // 손가락 f 를 (x,y)로. 이동한 거리를 돌려준다.
      var dx = cx[f] - x, dy = cy[f] - y;
      cx[f] = x; cy[f] = y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function homeExcept(a, b) {               // kla: 이번에 안 쓰는 손가락을 홈으로
      for (var q = 0; q < 8; q++) {
        if (q === a || q === b) continue;
        if (cx[q] !== g.homeX[q] || cy[q] !== g.homeY[q]) dist += goTo(q, g.homeX[q], g.homeY[q]);
      }
    }
    function chain(f, baseId) {               // 바이그램 사슬에 한 타건을 넣는다
      if (prevFinger >= 0) {
        bigrams++;
        if (prevBase === baseId) repeats++;
        else if (prevFinger === f) sfb++;
        if ((prevFinger < 4) !== (f < 4)) alt++;
      }
      prevFinger = f; prevBase = baseId;
    }

    var toks = dec.tokens, N = dec.length;
    var cho = compiled.cho, jung = compiled.jung, jong = compiled.jong;

    for (var t = 0; t < N; t++) {
      var v = toks[t];
      if (v === SPACE) {
        // 스페이스는 엄지가 친다 — 이동거리 0. kla에서는 이때 나머지 손가락이 홈으로 돌아온다.
        if (model === "kla") homeExcept(-1, -1);
        heldShift = -1;
        spaces++; prevFinger = -1; prevBase = -1;
        continue;
      }
      var keys = v >= T_JONG ? jong[v - T_JONG] : v >= T_JUNG ? jung[v - T_JUNG] : cho[v];
      for (var k = 0; k < keys.length; k++) {
        var code = keys.charCodeAt(k);
        if (code === 63) { unmapped++; prevFinger = -1; prevBase = -1; heldShift = -1; continue; }   // '?'
        var sb = g.shiftBase[code];
        var shifted = sb >= 0;
        var base = shifted ? sb : code;
        var f = g.finger[base];
        if (f < 0) { unmapped++; prevFinger = -1; prevBase = -1; heldShift = -1; continue; }

        var sf = -1, si = 0;
        if (shifted) { sf = f < 4 ? 7 : 0; si = f < 4 ? 1 : 0; }   // 반대손 새끼로 시프트

        if (model === "kla") homeExcept(f, sf);

        /* ── 시프트 (새로 누를 때만) ── */
        if (shifted && heldShift !== sf) {
          if (model === "home") {
            var hsx = g.homeX[sf] - g.shiftX[si], hsy = g.homeY[sf] - g.shiftY[si];
            dist += 2 * Math.sqrt(hsx * hsx + hsy * hsy);
          } else {
            dist += goTo(sf, g.shiftX[si], g.shiftY[si]);
          }
          shifts++; fingerLoad[sf]++;
          if (si) shiftR++; else shiftL++;
          chain(sf, -2 - si);                 // 시프트도 손가락을 쓰는 타건이다
          heldShift = sf;
        } else if (!shifted) {
          heldShift = -1;                     // 시프트를 뗀다
        }

        /* ── 글쇠 ── */
        var px = g.x[base], py = g.y[base];
        if (model === "home") {
          var hdx = g.homeX[f] - px, hdy = g.homeY[f] - py;
          dist += 2 * Math.sqrt(hdx * hdx + hdy * hdy);
        } else {
          dist += goTo(f, px, py);
        }
        keyStrokes++; keyCount[base]++; fingerLoad[f]++; rowCount[g.row[base] + 1]++;
        if (HOME_KEYS.charCodeAt(f) === base) homeHits++;
        chain(f, base);
      }
    }
    if (model === "kla") homeExcept(-1, -1);  // 다 치고 나면 손을 제자리로

    var d1 = Math.max(1, bigrams), d2 = Math.max(1, keyStrokes);
    var left = 0; for (i = 0; i < 4; i++) left += fingerLoad[i];
    var right = 0; for (i = 4; i < 8; i++) right += fingerLoad[i];
    var loadTotal = Math.max(1, left + right);

    var keys10 = [];
    for (i = 0; i < 128; i++) if (keyCount[i]) keys10.push({ key: String.fromCharCode(i), n: keyCount[i] });
    keys10.sort(function (a, b) { return b.n - a.n || (a.key < b.key ? -1 : 1); });

    return {
      layout: compiled.layout,
      model: model, unit: unit, geometry: g.kind,
      mm: dist * unit,
      units: dist,
      keyStrokes: keyStrokes, spaces: spaces, shifts: shifts,
      shiftLeft: shiftL, shiftRight: shiftR,
      totalStrokes: keyStrokes + spaces + shifts,
      unmapped: unmapped,
      bigrams: bigrams, sfb: sfb, alt: alt, repeats: repeats,
      sfbPct: 100 * sfb / d1,
      altPct: 100 * alt / d1,
      repeatPct: 100 * repeats / d1,
      shiftPct: 100 * shifts / d2,
      homePct: 100 * homeHits / d2,
      numRowPct: 100 * rowCount[1] / d2,
      rowPct: [0, 1, 2, 3].map(function (r) { return 100 * rowCount[r + 1] / d2; }),
      fingerLoad: Array.prototype.slice.call(fingerLoad),
      fingerPct: Array.prototype.slice.call(fingerLoad).map(function (v) { return 100 * v / loadTotal; }),
      leftPct: 100 * left / loadTotal, rightPct: 100 * right / loadTotal,
      keyCount: keyCount, topKeys: keys10.slice(0, 10),
      mmPerSyllable: dec.syllables ? dist * unit / dec.syllables : 0
    };
  }

  /* -------------------------------------------------------------- 공개 */

  var compiledCache = {};
  function compiledFor(L) {
    if (L.id && compiledCache[L.id] && compiledCache[L.id].layout === L) return compiledCache[L.id];
    var c = compile(L);
    if (L.id) compiledCache[L.id] = c;
    return c;
  }

  function analyze(text, opt) {
    opt = opt || {};
    var layouts = opt.layouts || D.ORDER.map(function (id) { return D.LAYOUTS[id]; });
    var dec = decompose(text);
    var results = layouts.map(function (L) { return measure(compiledFor(L), dec, opt); });
    return {
      text: { syllables: dec.syllables, jamoChars: dec.jamoChars, skipped: dec.skipped, jamoTokens: dec.length },
      results: results,
      // 실제로 계산에 쓰인 값 (요청값이 아니라). 화면 라벨과 계산이 어긋나지 않게 한다.
      options: results.length
        ? { unit: results[0].unit, model: results[0].model, geometry: results[0].geometry }
        : { unit: U_DEFAULT, model: "kla", geometry: "ansi" }
    };
  }

  /* 한 문자열을 한 자판으로 쳤을 때의 키열 (테스트·치트시트용) */
  function strokeString(L, text) {
    var c = compiledFor(L), dec = decompose(text), out = "";
    for (var i = 0; i < dec.length; i++) {
      var v = dec.tokens[i];
      out += v === SPACE ? " " : v >= T_JONG ? c.jong[v - T_JONG] : v >= T_JUNG ? c.jung[v - T_JUNG] : c.cho[v];
    }
    return out;
  }

  // 기본 키 -> 시프트 키 (배열 편집기의 키 맞바꾸기에 쓴다)
  var SHIFT_OF = {};
  for (var sp = 0; sp < SHIFT_PAIRS.length; sp += 2)
    SHIFT_OF[SHIFT_PAIRS.charAt(sp + 1)] = SHIFT_PAIRS.charAt(sp);

  root.KM_ENGINE = {
    SHIFT_OF: SHIFT_OF,
    analyze: analyze, decompose: decompose, measure: measure,
    compile: compile, compiledFor: compiledFor, strokeString: strokeString,
    keysFor: keysFor, buildGeometry: buildGeometry,
    GEOM: GEOM, FINGERS: FINGERS, FINGER_KO: FINGER_KO, HOME_KEYS: HOME_KEYS,
    ANSI_ROWS: ANSI_ROWS, U_DEFAULT: U_DEFAULT,
    ROW_KO: ["숫자행", "윗줄", "가운뎃줄(홈)", "아랫줄"]
  };
})(typeof window !== "undefined" ? window : globalThis);

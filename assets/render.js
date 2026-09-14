/* 손가락 마일리지 — 화면 그리기와 상호작용 */
(function () {
  "use strict";

  var D = window.KM_DATA, E = window.KM_ENGINE, C = window.KM_CONTENT;
  var CFG = window.KM_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var S = {
    text: C.presets[0][1],
    source: "demo",              // demo | typed | kakao
    kakao: null,
    kakaoLabel: "",
    opts: { model: "kla", unit: 19.05, leadStyle: true },
    custom: null,                // { baseId, swaps: [[a,b], ...] }
    last: null
  };

  /* ----------------------------------------------------------- 유틸 */

  var MODEL_KO = { kla: "표준", keep: "손가락 유지", home: "매번 홈 복귀" };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }
    catch (e) { return null; }
  }
  function nf(n, d) {
    return n.toLocaleString("ko-KR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  /* 이동거리를 사람이 읽는 단위로 */
  function dist(mm) {
    if (mm < 1000) return { v: nf(mm, 1), u: "㎜" };
    if (mm < 1000000) return { v: nf(mm / 1000, 2), u: "m" };
    return { v: nf(mm / 1000000, 2), u: "km" };
  }
  function distStr(mm) { var d = dist(mm); return d.v + d.u; }
  function pct(n, d) { return nf(n, d === undefined ? 1 : d) + "%"; }
  /* 조사 붙이기. 낱자(ㄱ=기역, ㅏ=아)와 숫자(390=삼구공)의 끝소리까지 본다. */
  function lastJong(w) {
    var DIGIT = [1, 8, 0, 1, 0, 0, 1, 8, 8, 0];   // 영 일 이 삼 사 오 육 칠 팔 구
    for (var i = String(w).length - 1; i >= 0; i--) {
      var c = String(w).charCodeAt(i);
      if (c >= 0xAC00 && c <= 0xD7A3) { var t = (c - 0xAC00) % 28; return t === 0 ? 0 : (t === 8 ? 8 : 1); }
      if (c >= 0x3131 && c <= 0x314E) return 1;    // 자음 이름은 모두 받침으로 끝난다 (기역, 쌍기역…)
      if (c >= 0x314F && c <= 0x3163) return 0;    // 모음 이름은 받침이 없다 (아, 야, 의…)
      if (c >= 0x30 && c <= 0x39) return DIGIT[c - 0x30];
      if (c === 32 || c === 41 || c === 93) continue;   // 공백·닫는 괄호는 건너뛴다
      return 1;
    }
    return 1;
  }
  var JOSA = {
    "을": ["를", "을"], "와": ["와", "과"], "은": ["는", "은"], "이": ["가", "이"],
    "이었": ["였", "이었"], "으로": ["로", "으로"]
  };
  function J(w, kind) {
    var j = lastJong(w);
    if (kind === "으로") return w + (j === 0 || j === 8 ? "로" : "으로");
    return w + JOSA[kind][j ? 1 : 0];
  }

  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  /* ------------------------------------------------- 자판 목록 만들기 */

  function applySwaps(base, swaps) {
    var map = {}, i, a, b, sa, sb;
    for (i = 0; i < swaps.length; i++) {
      a = swaps[i][0]; b = swaps[i][1];
      map[a] = b; map[b] = a;
      sa = E.SHIFT_OF[a]; sb = E.SHIFT_OF[b];
      if (sa && sb) { map[sa] = sb; map[sb] = sa; }
    }
    function tr(str) {
      var out = "", ch;
      for (var j = 0; j < str.length; j++) { ch = str.charAt(j); out += (map[ch] || ch); }
      return out;
    }
    var lead = null;
    if (base.jungLead) {
      lead = {};
      for (var k in base.jungLead) lead[k] = map[base.jungLead[k]] || base.jungLead[k];
    }
    return {
      id: "custom", name: "내 배열", short: "내 배열",
      note: base.name + " 바탕 · " + swaps.length + "곳 교환",
      twoSet: base.twoSet, cho: tr(base.cho), jung: tr(base.jung), jong: tr(base.jong),
      jungLead: lead
    };
  }

  function layoutList() {
    var out = D.ORDER.map(function (id) { return D.LAYOUTS[id]; });
    if (S.custom && S.custom.swaps.length)
      out.push(applySwaps(D.LAYOUTS[S.custom.baseId], S.custom.swaps));
    return out;
  }

  /* --------------------------------------------- 키 -> 표시 자모 사전 */

  function keyLabels(L) {
    var info = {};
    function add(key, ch) {
      if (!key || key === " ") return;
      var sb = E.GEOM.ansi.shiftBase[key.charCodeAt(0)];
      var base = sb >= 0 ? String.fromCharCode(sb) : key;
      var slot = info[base] || (info[base] = { base: [], shift: [] });
      var arr = sb >= 0 ? slot.shift : slot.base;
      if (arr.indexOf(ch) < 0) arr.push(ch);
    }
    for (var i = 0; i < 19; i++) add(L.cho.charAt(i), D.SHOW_CHO.charAt(i));
    for (i = 0; i < 21; i++) add(L.jung.charAt(i), D.SHOW_JUNG.charAt(i));
    for (i = 0; i < 27; i++) add(L.jong.charAt(i), D.SHOW_JONG.charAt(i));
    if (L.jungLead) for (var k in L.jungLead) add(L.jungLead[k], D.SHOW_JUNG.charAt(+k));
    return info;
  }

  /* ------------------------------------------------------- 계산 실행 */

  var MAX_CHARS = 1500000;      // 이 이상은 메모리·시간 모두 위험하다
  function compute() {
    S.truncated = 0;
    if (S.text.length > MAX_CHARS) {
      S.truncated = S.text.length;
      S.text = S.text.slice(0, MAX_CHARS);
    }
    S.last = E.analyze(S.text, {
      layouts: layoutList(), model: S.opts.model,
      unit: S.opts.unit, leadStyle: S.opts.leadStyle
    });
    return S.last;
  }

  /* --------------------------------------------------------- 헤드라인 */

  function renderHeadline(a) {
    var base = a.results[0], rest = a.results.slice(1, 3);
    var d = dist(base.mm);
    $("#bigValue").textContent = d.v;
    $("#bigUnit").textContent = d.u;
    $("#headlineEyebrow").textContent = base.layout.name + " 기준 · 손가락이 움직인 거리";

    var v;
    if (a.text.syllables === 0) {
      v = "한글이 없습니다. 위에 한국어 문장을 넣어 주세요.";
      $("#bigValue").textContent = "0"; $("#bigUnit").textContent = "㎜";
    } else {
      var cmp = rest.map(function (r) {
        var diff = (r.mm - base.mm) / Math.max(1, base.mm) * 100;
        return J(r.layout.short, "은") + " " + distStr(r.mm) +
          " <strong>(" + (diff >= 0 ? "+" : "") + nf(diff, 0) + "%)</strong>";
      }).join(", ");
      v = "같은 글을 " + cmp + ".";
    }
    $("#verdict").innerHTML = v;

    var chips = [
      "한글 " + nf(a.text.syllables) + "자",
      "총 타건 " + nf(base.totalStrokes) + "회",
      "시프트 " + nf(base.shifts) + "회"
    ];
    if (a.text.skipped) chips.push("계산 제외 " + nf(a.text.skipped) + "자");
    if (S.truncated) chips.push("너무 길어 앞 " + nf(MAX_CHARS) + "자만 계산 (전체 " + nf(S.truncated) + "자)");
    if (S.kakaoLabel) chips.unshift(S.kakaoLabel);
    $("#chips").innerHTML = chips.map(function (c, i) {
      return '<span class="badge' + (i === 0 && S.kakaoLabel ? " badge-live" : "") + '">' + esc(c) + "</span>";
    }).join("");
  }

  /* ------------------------------------------------------------- 표 */

  var METRICS = [
    { k: "mm",      lower: true,  get: function (r) { return r.mm; },        fmt: function (r) { return distStr(r.mm); } },
    { k: "strokes", lower: true,  get: function (r) { return r.totalStrokes; }, fmt: function (r) { return nf(r.totalStrokes) + "회"; } },
    { k: "shifts",  lower: true,  get: function (r) { return r.shifts; },    fmt: function (r) { return nf(r.shifts) + "회 (" + pct(r.shiftPct) + ")"; } },
    { k: "sfb",     lower: true,  get: function (r) { return r.sfbPct; },    fmt: function (r) { return pct(r.sfbPct, 2); } },
    { k: "alt",     lower: false, get: function (r) { return r.altPct; },    fmt: function (r) { return pct(r.altPct); } },
    { k: "home",    lower: false, get: function (r) { return r.homePct; },   fmt: function (r) { return pct(r.homePct); } },
    { k: "numrow",  lower: true,  get: function (r) { return r.numRowPct; }, fmt: function (r) { return pct(r.numRowPct); } },
    { k: "hands",   lower: true,  get: function (r) { return Math.abs(50 - r.leftPct); },
      fmt: function (r) { return nf(r.leftPct, 0) + " : " + nf(r.rightPct, 0); } }
  ];

  function renderTable(a) {
    var rs = a.results;
    $("#compareCaption").textContent =
      "한글 " + nf(a.text.syllables) + "자를 각 자판으로 쳤을 때의 지표 " + METRICS.length + "가지" +
      " (키 간격 " + S.opts.unit + "㎜, " + MODEL_KO[a.options.model] + " 모형)";
    $("#compareHead").innerHTML = '<th scope="col">지표</th>' + rs.map(function (r) {
      return '<th scope="col">' + esc(r.layout.short) + "</th>";
    }).join("");

    $("#compareBody").innerHTML = METRICS.map(function (m) {
      var info = C.metrics[m.k];
      var vals = rs.map(m.get);
      var shown = rs.map(m.fmt);
      var best = m.lower ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
      var bestShown = shown[vals.indexOf(best)];
      // 화면에 같은 값으로 보이는데 한쪽만 '가장 유리'로 찍히면 오류처럼 읽힌다.
      var anyDiff = shown.some(function (v) { return v !== shown[0]; });
      return '<tr><th scope="row">' + esc(info[0]) +
        '<span class="visually-hidden"> — ' + esc(info[1]) + "</span></th>" +
        rs.map(function (r, i) {
          var isBest = anyDiff && shown[i] === bestShown;
          return '<td class="num' + (isBest ? " best" : "") + '">' + shown[i] +
            (isBest ? '<span class="visually-hidden"> (가장 유리)</span>' : "") + "</td>";
        }).join("") + "</tr>";
    }).join("");
  }

  function renderDistBars(a) {
    var max = Math.max.apply(null, a.results.map(function (r) { return r.mm; })) || 1;
    $("#distBars").innerHTML = a.results.map(function (r, i) {
      var w = Math.max(0.6, r.mm / max * 100);
      return '<div class="bar-row">' +
        "<span>" + esc(r.layout.short) + "</span>" +
        '<span class="bar-track"><span class="bar-fill' + (i === 0 ? " is-accent" : "") +
        '" style="width:' + w.toFixed(2) + '%"></span></span>' +
        '<span class="bar-val">' + distStr(r.mm) + "</span></div>";
    }).join("");
  }

  /* --------------------------------------------------------- 히트맵 */

  var UPX = 20, PAD = 3;

  /* 순차 색 스케일.
     파랑 한 색으로 가되, 글자 대비가 4.5:1 아래로 떨어지는 중간 명도 구간을 건너뛴다.
     t <= 0.62 구간은 어두운 글자, 그 위는 흰 글자를 쓰고, 두 구간 사이에서 명도를 점프시킨다.
     이렇게 하면 어느 칸에서도 숫자가 4.7:1 이상으로 읽힌다. (계산: tools/check-contrast.mjs) */
  var HEAT_SPLIT = 0.62;
  function heatColor(t, forceLight) {
    if (t < 0) t = 0; else if (t > 1) t = 1;
    if (!forceLight && isDark()) {
      var Ld = t <= HEAT_SPLIT
        ? 15 + 22 * Math.pow(t / HEAT_SPLIT, 0.75)
        : 47 + 19 * ((t - HEAT_SPLIT) / (1 - HEAT_SPLIT));
      return { fill: "hsl(205 62% " + Ld.toFixed(1) + "%)", ink: t <= HEAT_SPLIT ? "#eaf0f6" : "#0a0f14" };
    }
    var L = t <= HEAT_SPLIT
      ? 96 - 46 * Math.pow(t / HEAT_SPLIT, 0.75)
      : 42 - 12 * ((t - HEAT_SPLIT) / (1 - HEAT_SPLIT));
    return { fill: "hsl(205 72% " + L.toFixed(1) + "%)", ink: t <= HEAT_SPLIT ? "#0d1218" : "#ffffff" };
  }

  function heatSvg(L, res, idBase) {
    var info = keyLabels(L), rows = E.ANSI_ROWS;
    var counts = res.keyCount;
    var max = 1, i, j;
    for (i = 0; i < 128; i++) if (counts[i] > max) max = counts[i];
    var hot = res.topKeys.slice(0, 5).map(function (k) { return k.key; });

    var parts = [], W = 15.5 * UPX + PAD * 2, H = 5 * UPX + PAD * 2;

    function cap(x, y, w, cls, fill, extra) {
      parts.push('<rect class="kcap ' + cls + '" x="' + (PAD + x * UPX + .6).toFixed(2) +
        '" y="' + (PAD + y * UPX + .6).toFixed(2) + '" width="' + (w * UPX - 1.2).toFixed(2) +
        '" height="' + (UPX - 1.2).toFixed(2) + '" rx="2.4"' +
        (fill ? ' fill="' + fill + '"' : "") + (extra || "") + "></rect>");
    }
    function txt(x, y, s, size, fill, weight) {
      parts.push('<text x="' + (PAD + x * UPX).toFixed(2) + '" y="' + (PAD + y * UPX).toFixed(2) +
        '" text-anchor="middle" font-size="' + size + '" fill="' + fill +
        '" font-weight="' + (weight || 400) + '">' + esc(s) + "</text>");
    }

    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      for (j = 0; j < r.keys.length; j++) {
        var key = r.keys.charAt(j), code = key.charCodeAt(0);
        var n = counts[code] || 0, t = n / max;
        var col = n ? heatColor(t) : { fill: "var(--surface)", ink: "var(--ink-3)" };
        var x = r.xoff + j;
        cap(x, i, 1, hot.indexOf(key) >= 0 ? "khot" : "", col.fill);
        var lab = info[key];
        if (lab) {
          var head = lab.base.join("") || "·";
          var sh = lab.shift.join("");
          txt(x + .5, i + .58, head, 6.4, col.ink, 700);
          if (sh) txt(x + .5, i + .26, sh, 3.9, col.ink, 600);
          txt(x + .5, i + .92, n ? String(n) : "0", 4.1, col.ink, 500);
        } else {
          txt(x + .5, i + .62, key === "\\" ? "\\" : key, 4.6, "var(--ink-3)", 400);
        }
      }
    }
    // 시프트와 스페이스
    var shL = res.shiftLeft || 0, shR = res.shiftRight || 0;
    cap(0, 3, 2.25, "kmod", shL ? heatColor(Math.min(1, shL / max)).fill : "var(--surface-2)");
    txt(1.125, 3.5, "Shift", 4.6, "var(--ink-2)", 600);
    txt(1.125, 3.88, nf(shL), 4.0, "var(--ink-2)");
    cap(12.25, 3, 2.75, "kmod", shR ? heatColor(Math.min(1, shR / max)).fill : "var(--surface-2)");
    txt(13.625, 3.5, "Shift", 4.6, "var(--ink-2)", 600);
    txt(13.625, 3.88, nf(shR), 4.0, "var(--ink-2)");
    cap(3.75, 4, 6.25, "kmod", "var(--surface-2)");
    txt(6.875, 4.55, "스페이스 " + nf(res.spaces), 5, "var(--ink-2)", 600);

    var desc = L.name + ": 가장 많이 누른 키는 " + res.topKeys.slice(0, 3).map(function (k) {
      return k.key + " " + k.n + "회";
    }).join(", ") + ". 총 " + nf(res.keyStrokes) + "회 타건.";

    return '<svg viewBox="0 0 ' + W.toFixed(1) + " " + H.toFixed(1) + '" role="img" ' +
      'aria-labelledby="' + idBase + 't ' + idBase + 'd"><title id="' + idBase + 't">' +
      esc(L.name) + ' 키별 타건 히트맵</title><desc id="' + idBase + 'd">' + esc(desc) + "</desc>" +
      parts.join("") + "</svg>";
  }

  function renderHeatmaps(a) {
    $("#heatmaps").innerHTML = a.results.map(function (res, i) {
      var L = res.layout, id = "hm" + i;
      var rows = [];
      for (var c = 0; c < 128; c++) if (res.keyCount[c]) rows.push([String.fromCharCode(c), res.keyCount[c]]);
      rows.sort(function (p, q) { return q[1] - p[1]; });
      var info = keyLabels(L);
      var g = E.GEOM.ansi;
      var tbl = '<div class="table-scroll"><table><caption>' + esc(L.name) +
        ' 키별 타건 수</caption><thead><tr><th scope="col">키</th><th scope="col">자모</th>' +
        '<th scope="col">손가락</th><th scope="col">줄</th><th scope="col">타건</th></tr></thead><tbody>' +
        rows.map(function (p) {
          var lab = info[p[0]] || { base: [], shift: [] };
          var f = g.finger[p[0].charCodeAt(0)];
          return "<tr><th scope=\"row\" class=\"mono\">" + esc(p[0]) + "</th><td>" +
            esc(lab.base.join(" ") + (lab.shift.length ? " / " + lab.shift.join(" ") : "")) + "</td><td>" +
            esc(E.FINGER_KO[f] || "—") + "</td><td>" + esc(E.ROW_KO[g.row[p[0].charCodeAt(0)]] || "—") +
            '</td><td class="num">' + nf(p[1]) + "</td></tr>";
        }).join("") + "</tbody></table></div>";

      return '<div class="kbd-block"><div class="kbd-head"><h3>' + esc(L.name) + "</h3>" +
        '<span class="small">' + esc(L.note || "") + " · 타건 " + nf(res.keyStrokes) +
        "회 · 이동 " + distStr(res.mm) + "</span></div>" +
        '<div class="kbd">' + heatSvg(L, res, id) + "</div>" +
        '<p class="legend"><span>적게</span><span class="swatches">' +
        [0, .25, .5, .75, 1].map(function (t) {
          return '<span class="sw" style="background:' + heatColor(t).fill + '"></span>';
        }).join("") + "</span><span>많이</span>" +
        '<span>· 굵은 테두리 = 가장 많이 누른 5개 키</span></p>' +
        "<details><summary>이 자판 숫자로 보기</summary>" + tbl + "</details></div>";
    }).join("");
  }

  /* ------------------------------------------------------ 손가락 부담 */

  function renderFingers(a) {
    var rs = a.results;
    var head = '<th scope="col">손가락</th>' + rs.map(function (r) {
      return '<th scope="col">' + esc(r.layout.short) + "</th>";
    }).join("");
    var body = E.FINGER_KO.map(function (name, f) {
      return '<tr><th scope="row">' + esc(name) + "</th>" + rs.map(function (r) {
        var p = r.fingerPct[f];
        var heavy = p >= 20;
        return '<td class="num"' + (heavy ? ' style="color:var(--accent);font-weight:700"' : "") + ">" +
          pct(p) + "</td>";
      }).join("") + "</tr>";
    }).join("") +
      '<tr><th scope="row">왼손 합계</th>' + rs.map(function (r) {
        return '<td class="num">' + pct(r.leftPct) + "</td>"; }).join("") + "</tr>" +
      '<tr><th scope="row">오른손 합계</th>' + rs.map(function (r) {
        return '<td class="num">' + pct(r.rightPct) + "</td>"; }).join("") + "</tr>";

    var base = rs[0];
    var bars = '<h3 style="margin-top:1.2rem">' + esc(base.layout.short) + ' 손가락 부담</h3><div class="bars">' +
      E.FINGER_KO.map(function (name, f) {
        var p = base.fingerPct[f];
        return '<div class="bar-row"><span>' + esc(name.replace("손 ", "")) + "</span>" +
          '<span class="bar-track"><span class="bar-fill' + (p >= 20 ? " is-accent" : "") +
          '" style="width:' + Math.min(100, p * 3).toFixed(1) + '%"></span></span>' +
          '<span class="bar-val">' + pct(p) + "</span></div>";
      }).join("") + "</div>";

    $("#fingerBlock").innerHTML =
      '<div class="table-scroll"><table><caption>손가락이 나눠 가진 타건 비율 (시프트와 스페이스 포함). ' +
      '좌우 합계는 엄지를 뺀 여덟 손가락 기준입니다.</caption>' +
      "<thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></div>" + bars;
  }

  /* ------------------------------------------------------------ 요약문 */

  function renderFindings(a) {
    var rs = a.results, base = rs[0], out = [];
    if (a.text.syllables === 0) {
      $("#findings").innerHTML = '<li data-mark="—">계산할 한글이 없습니다.</li>';
      return;
    }
    function other(pick) {
      var best = rs[1] || rs[0];
      for (var i = 2; i < rs.length; i++) if (pick(rs[i], best)) best = rs[i];
      return best;
    }
    var far = other(function (r, b) { return r.mm > b.mm; });
    var near = other(function (r, b) { return r.mm < b.mm; });

    if (rs.length > 1) {
      var diff = (far.mm - base.mm) / Math.max(1, base.mm) * 100;
      out.push([J(base.layout.short, "으로") + " 이 글을 치면 손가락이 " + distStr(base.mm) + " 움직입니다. " +
        J(far.layout.short, "이었") + "다면 " + distStr(far.mm) + " — " + nf(Math.abs(diff), 0) + "% " +
        (diff >= 0 ? "더 멉니다" : "덜 갑니다") + ".", "1"]);
    }
    var minShift = rs.reduce(function (p, c) { return c.shifts < p.shifts ? c : p; });
    if (base.shifts - minShift.shifts >= 3)
      out.push([J(minShift.layout.short, "은") + " 시프트를 " + nf(base.shifts) + "회에서 " +
        nf(minShift.shifts) + "회로 줄입니다. 새끼손가락이 그만큼 덜 뻗습니다.", "2"]);

    var maxNum = rs.reduce(function (p, c) { return c.numRowPct > p.numRowPct ? c : p; });
    if (maxNum.numRowPct - base.numRowPct >= 3)
      out.push(["대신 " + J(maxNum.layout.short, "은") + " 숫자행 타건이 " + pct(base.numRowPct) + " → " +
        pct(maxNum.numRowPct) + "로 늘어, 손이 위로 더 자주 올라갑니다. 이동거리가 늘어나는 주범입니다.", "3"]);

    var minSfb = rs.reduce(function (p, c) { return c.sfbPct < p.sfbPct ? c : p; });
    if (base.sfbPct - minSfb.sfbPct >= 0.5) {
      var ratio = minSfb.sfbPct > 0 ? base.sfbPct / minSfb.sfbPct : 0;
      out.push(["같은 손가락이 연달아 걸리는 비율은 " + pct(base.sfbPct, 2) + " → " + pct(minSfb.sfbPct, 2) +
        (ratio >= 1.5 ? "로, " + nf(ratio, 1) + "배 낮아집니다." : "로 줄어듭니다."), "4"]);
    }
    var maxAlt = rs.reduce(function (p, c) { return c.altPct > p.altPct ? c : p; });
    out.push([J(maxAlt.layout.short, "이") + " 손 교대율 " + pct(maxAlt.altPct) + "로 가장 높습니다. " +
      (maxAlt.layout.id === "dubeol" ? "자음은 왼손, 모음은 오른손이라는 구조 때문입니다." :
       "초성·중성·종성이 손을 번갈아 쓰도록 배치된 결과입니다."), "5"]);

    var worst = 0;
    for (var f = 1; f < 8; f++) if (base.fingerPct[f] > base.fingerPct[worst]) worst = f;
    if (base.fingerPct[worst] >= 22)
      out.push([base.layout.short + "에서는 " + E.FINGER_KO[worst] + " 하나가 전체 타건의 " +
        pct(base.fingerPct[worst]) + "를 감당합니다.", "6"]);

    if (base.repeatPct >= 3)
      out.push(["같은 키를 연달아 누른 비율이 " + pct(base.repeatPct) +
        "입니다. ㅋㅋㅋ, ㅠㅠ 같은 반복이 많은 글입니다.", "7"]);

    if (S.kakaoLabel)
      out.push([esc(S.kakaoLabel) + " 기준입니다.", "8"]);   // 화자 이름은 사용자 파일에서 온다

    $("#findings").innerHTML = out.slice(0, 7).map(function (p) {
      return '<li data-mark="' + p[1] + '">' + p[0] + "</li>";
    }).join("");
  }

  /* ------------------------------------------------------------ 카드 */

  function drawCard() {
    var cv = $("#cardCanvas"), a = S.last;
    if (!cv || !a) return;
    var g = cv.getContext("2d"), W = cv.width, H = cv.height;
    var FONT = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif';

    g.fillStyle = "#f7f4ee"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#b03a12"; g.fillRect(0, 0, W, 10);

    var base = a.results[0], d = dist(base.mm);
    g.fillStyle = "#6f6f79"; g.font = "600 26px " + FONT;
    g.fillText("손가락 마일리지", 64, 84);
    g.fillStyle = "#16161a"; g.font = "700 34px " + FONT;
    g.fillText(J(base.layout.name, "으로") + " 이 글을 치면", 64, 148);

    g.font = "800 152px " + FONT; g.fillStyle = "#16161a";
    g.fillText(d.v, 64, 292);
    var wv = g.measureText(d.v).width;
    g.font = "700 54px " + FONT; g.fillStyle = "#b03a12";
    g.fillText(d.u, 64 + wv + 14, 292);

    g.fillStyle = "#4a4a52"; g.font = "400 28px " + FONT;
    g.fillText("한글 " + nf(a.text.syllables) + "자 · 타건 " + nf(base.totalStrokes) +
      "회 · 시프트 " + nf(base.shifts) + "회", 64, 344);

    var max = Math.max.apply(null, a.results.map(function (r) { return r.mm; })) || 1;
    var y = 404;
    a.results.slice(0, 4).forEach(function (r, i) {
      g.fillStyle = "#16161a"; g.font = "600 25px " + FONT;
      g.fillText(r.layout.short, 64, y + 22);
      g.fillStyle = "#e6e0d4"; g.fillRect(240, y, 700, 30);
      g.fillStyle = i === 0 ? "#b03a12" : "#14507f";
      g.fillRect(240, y, Math.max(6, 700 * r.mm / max), 30);
      g.fillStyle = "#4a4a52"; g.font = "500 23px " + FONT;
      g.fillText(distStr(r.mm), 958, y + 23);
      y += 44;
    });

    g.fillStyle = "#6f6f79"; g.font = "400 22px " + FONT;
    var cap = S.kakaoLabel || "직접 붙여 넣은 글";
    g.fillText(cap, 64, H - 40);
    g.textAlign = "right";
    g.fillStyle = "#16161a"; g.font = "700 24px " + FONT;
    g.fillText(CFG.siteUrl ? CFG.siteUrl.replace(/^https?:\/\//, "") : "손가락 마일리지", W - 64, H - 40);
    g.textAlign = "left";
  }

  /* ------------------------------------------------------------ 추천 */

  function renderPromo(a) {
    var slot = $("#promoSlot"), sec = $("#promoSection");
    if (!CFG.coupangPartnerId) { sec.hidden = true; slot.innerHTML = ""; return; }
    var base = a.results[0], items = [];
    function link(q, why) {
      var url = "https://link.coupang.com/re/AFFSDP?lptag=" + encodeURIComponent(CFG.coupangPartnerId) +
        "&pageKey=" + encodeURIComponent(q);
      return { url: url, q: q, why: why };
    }
    if (base.sfbPct > 3) items.push(link("스플릿 키보드", "같은 손가락 연속이 " + pct(base.sfbPct, 2) +
      "로 높습니다. 좌우가 갈라진 자판은 이 겹침을 줄이는 쪽으로 설계돼 있습니다."));
    if (base.fingerPct[0] + base.fingerPct[7] > 24 || base.shiftPct > 5)
      items.push(link("팜레스트", "새끼손가락과 시프트 부담이 큰 편입니다. 손목 받침은 그 자세를 덜 무리하게 만듭니다."));
    if (base.numRowPct > 8) items.push(link("텐키리스 키보드", "숫자행을 " + pct(base.numRowPct) +
      " 쓰고 있습니다. 폭이 좁은 자판은 오른손이 마우스까지 가는 거리도 함께 줄여 줍니다."));
    if (S.custom) items.push(link("무각인 키캡", "직접 배열을 바꾸셨네요. 각인이 없는 키캡이면 인쇄와 실제가 어긋나지 않습니다."));
    if (!items.length) items.push(link("키보드 팜레스트", "오래 치는 분들이 가장 먼저 바꾸는 물건입니다."));

    sec.hidden = false;
    slot.innerHTML = '<div class="promo"><h2 style="margin:0"><span class="promo-label">광고</span> 이런 게 도움이 될 수 있습니다</h2>' +
      '<p class="tiny" style="margin:.5rem 0 0">이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p><ul>' +
      items.slice(0, 3).map(function (it) {
        return '<li><a href="' + esc(it.url) + '" rel="nofollow sponsored noopener" target="_blank"><strong>' +
          esc(it.q) + "</strong></a><br><span class=\"tiny\">" + esc(it.why) + "</span></li>";
      }).join("") + "</ul></div>";
  }

  var unlockState = null;
  function renderUnlock() {
    var slot = $("#unlockSlot");
    if (!CFG.unlockUrl) { if (unlockState !== "off") { slot.innerHTML = ""; unlockState = "off"; } return; }
    var open = store("km.unlock") === "1";
    if (unlockState === String(open)) return;      // 입력 중인 코드를 지우지 않는다
    unlockState = String(open);
    slot.innerHTML = '<div class="promo" style="margin-top:1rem"><h3 style="margin:0">고해상도 포스터 (' +
      esc(CFG.unlockPrice || "") + ")</h3>" +
      "<p class=\"small\">A3 300dpi 포스터 PNG, 키별·손가락별 전체 CSV, 키캡 각인용 치트시트를 받습니다.</p>" +
      (open
        ? '<p class="small"><strong>열려 있습니다.</strong> 아래 버튼으로 내려받으세요.</p>' +
          '<div class="row-actions"><button class="btn btn-primary" type="button" id="posterBtn">A3 포스터 내려받기</button>' +
          '<button class="btn" type="button" id="csvBtn">CSV 내려받기</button>' +
          '<button class="btn" type="button" id="sheetBtn">키캡 치트시트 SVG</button>' +
          '<span class="tiny" id="unlockMsg" role="status"></span></div>'
        : '<div class="row-actions"><a class="btn btn-primary" href="' + esc(CFG.unlockUrl) +
          '" rel="noopener" target="_blank">결제하고 코드 받기</a>' +
          '<label class="small">코드 <input type="text" id="unlockCode" size="12" autocomplete="off"></label>' +
          '<button class="btn" type="button" id="unlockBtn">확인</button></div>' +
          '<p class="tiny">이 잠금은 브라우저 안에서만 확인합니다. 마음먹으면 우회할 수 있다는 뜻입니다. ' +
          "도구가 쓸모 있었다면 정직하게 결제해 주세요.</p>") + "</div>";
  }

  /* -------------------------------------------------------- 전체 갱신 */

  var liveTimer = null, lastLive = "";
  function render() {
    var a = compute();
    renderHeadline(a);
    renderTable(a);
    renderDistBars(a);
    renderHeatmaps(a);
    renderFingers(a);
    renderFindings(a);
    renderPromo(a);
    renderUnlock();
    drawCard();

    var msg = a.text.syllables === 0 ? "한글이 없어 결과가 비어 있습니다." :
      a.results[0].layout.short + " 기준 " + distStr(a.results[0].mm) + ", 한글 " + nf(a.text.syllables) + "자.";
    if (msg !== lastLive) {
      lastLive = msg;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(function () { $("#liveRegion").textContent = msg; }, 700);
    }
    $("#srcStatus").textContent = S.text.length
      ? nf(S.text.length) + "자 입력됨 · 한글 " + nf(a.text.syllables) + "자"
      : "";
    $("#sourceBadge").textContent =
      S.source === "demo" ? "예시 문장으로 보는 중" :
      S.source === "kakao" ? "카카오톡 대화 기준" : "직접 넣은 글 기준";
  }

  var renderTimer = null;
  function renderSoon(ms) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, ms === undefined ? 250 : ms);
  }

  /* 자판 배열만 그린 SVG (키캡 각인용 치트시트). 타건 수 없이 배열만. */
  function layoutSheetSvg(L) {
    var info = keyLabels(L), rows = E.ANSI_ROWS, parts = [], i, j;
    var W = 15.5 * UPX + PAD * 2, H = 4 * UPX + PAD * 2;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      for (j = 0; j < r.keys.length; j++) {
        var key = r.keys.charAt(j), x = r.xoff + j, lab = info[key];
        parts.push('<rect x="' + (PAD + x * UPX + .6).toFixed(2) + '" y="' + (PAD + i * UPX + .6).toFixed(2) +
          '" width="' + (UPX - 1.2).toFixed(2) + '" height="' + (UPX - 1.2).toFixed(2) +
          '" rx="2.4" fill="none" stroke="#999" stroke-width=".5"></rect>');
        var tx = (PAD + (x + .5) * UPX).toFixed(2);
        parts.push('<text x="' + tx + '" y="' + (PAD + (i + .86) * UPX).toFixed(2) +
          '" text-anchor="middle" font-size="4" fill="#999">' + esc(key) + "</text>");
        if (lab) {
          if (lab.shift.length) parts.push('<text x="' + tx + '" y="' + (PAD + (i + .3) * UPX).toFixed(2) +
            '" text-anchor="middle" font-size="4.4" font-weight="600" fill="#555">' + esc(lab.shift.join("")) + "</text>");
          parts.push('<text x="' + tx + '" y="' + (PAD + (i + .64) * UPX).toFixed(2) +
            '" text-anchor="middle" font-size="7" font-weight="700" fill="#111">' + esc(lab.base.join("")) + "</text>");
        }
      }
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      W.toFixed(1) + " " + H.toFixed(1) + '" width="' + (W * 4).toFixed(0) + '" height="' + (H * 4).toFixed(0) +
      '"><title>' + esc(L.name) + ' 배열</title><rect width="100%" height="100%" fill="#fff"></rect>' +
      parts.join("") + "</svg>";
  }

  /* 고해상도 포스터 (세로). 남은 높이에 맞춰 자판 그림 크기를 계산하므로 자판이 4개여도 넘치지 않는다. */
  function drawPoster(cv, W, H) {
    var a = S.last; if (!a) return false;
    var g = cv.getContext("2d");
    if (!g) return false;
    cv.width = W; cv.height = H;
    var k = W / 3508;                       // A3 세로 300dpi 기준 배율
    var FONT = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif';
    var px = function (n) { return (n * k).toFixed(1) + "px "; };
    var M = 220 * k, IW = W - M * 2;
    var n = a.results.length;

    g.fillStyle = "#f7f4ee"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#b03a12"; g.fillRect(0, 0, W, 30 * k);

    /* ── 머리 ── */
    var base = a.results[0], d = dist(base.mm);
    var y = M + 70 * k;
    g.fillStyle = "#8a8780"; g.font = "700 " + px(58) + FONT;
    g.fillText("손가락 마일리지", M, y);
    y += 320 * k;
    g.fillStyle = "#16161a"; g.font = "800 " + px(360) + FONT;
    g.fillText(d.v, M, y);
    var wv = g.measureText(d.v).width;
    g.font = "700 " + px(128) + FONT; g.fillStyle = "#b03a12";
    g.fillText(d.u, M + wv + 24 * k, y);
    y += 92 * k;
    g.fillStyle = "#4a4a52"; g.font = "500 " + px(66) + FONT;
    g.fillText(J(base.layout.name, "으로") + " 이 글을 칠 때 손가락이 움직이는 거리", M, y);
    y += 72 * k;
    g.fillStyle = "#6f6f79"; g.font = "400 " + px(54) + FONT;
    g.fillText("한글 " + nf(a.text.syllables) + "자 · 총 타건 " + nf(base.totalStrokes) +
      "회 · 시프트 " + nf(base.shifts) + "회" + (S.kakaoLabel ? " · " + S.kakaoLabel : ""), M, y);
    y += 90 * k;

    /* ── 남은 높이에 맞춰 자판 그림 크기 결정 ── */
    var footH = 90 * k;
    var rowH = 86 * k, tableH = rowH * (METRICS.length + 1) + 60 * k;
    var titleH = 74 * k, gapH = 54 * k;
    var avail = H - M - footH - tableH - y;
    var ku = Math.min(IW / 15.5, (avail / n - titleH - gapH) / 4);
    var kbW = ku * 15.5, kbX = M + (IW - kbW) / 2;
    // 자판이 폭에 걸려 더 못 커질 때 남는 높이를 위아래로 나눠 균형을 맞춘다
    y += Math.max(0, avail - n * (titleH + gapH + ku * 4)) * 0.4;

    a.results.forEach(function (res) {
      var maxc = 1, c;
      for (c = 0; c < 128; c++) if (res.keyCount[c] > maxc) maxc = res.keyCount[c];
      g.fillStyle = "#16161a"; g.font = "700 " + px(58) + FONT;
      g.fillText(res.layout.name + "  ·  " + distStr(res.mm) + "  ·  타건 " + nf(res.keyStrokes) + "회", kbX, y + titleH * 0.7);
      var top = y + titleH, info = keyLabels(res.layout);
      E.ANSI_ROWS.forEach(function (row, ri) {
        for (var j = 0; j < row.keys.length; j++) {
          var key = row.keys.charAt(j), code = key.charCodeAt(0);
          var cnt = res.keyCount[code] || 0, t = cnt / maxc;
          var hc = heatColor(t, true);
          var x = kbX + (row.xoff + j) * ku, ky = top + ri * ku;
          g.fillStyle = cnt ? hc.fill : "#fffdf9";
          g.strokeStyle = "#ded7c9"; g.lineWidth = Math.max(1, 2 * k);
          g.beginPath();
          if (g.roundRect) g.roundRect(x + ku * .03, ky + ku * .03, ku * .94, ku * .94, ku * .1);
          else g.rect(x + ku * .03, ky + ku * .03, ku * .94, ku * .94);
          g.fill(); g.stroke();
          var ink = cnt ? hc.ink : "#10161c";
          var lab = info[key];
          g.textAlign = "center";
          if (lab) {
            g.fillStyle = ink;
            if (lab.shift.length) {
              g.font = "600 " + (ku * .2).toFixed(1) + "px " + FONT;
              g.fillText(lab.shift.join(""), x + ku / 2, ky + ku * .3);
            }
            g.font = "700 " + (ku * .33).toFixed(1) + "px " + FONT;
            g.fillText(lab.base.join("") || "·", x + ku / 2, ky + ku * (lab.shift.length ? .64 : .58));
            g.font = "500 " + (ku * .19).toFixed(1) + "px " + FONT;
            g.fillText(String(cnt), x + ku / 2, ky + ku * .89);
          } else {
            g.fillStyle = "#b3aea7"; g.font = "400 " + (ku * .22).toFixed(1) + "px " + FONT;
            g.fillText(key, x + ku / 2, ky + ku * .62);
          }
          g.textAlign = "left";
        }
      });
      y = top + ku * 4 + gapH;
    });

    /* ── 지표 표 ── */
    y += 20 * k;
    var labelW = IW * 0.34, colW = (IW - labelW) / n;
    g.font = "700 " + px(50) + FONT; g.fillStyle = "#8a8780";
    a.results.forEach(function (r, i) {
      g.textAlign = "right";
      g.fillText(r.layout.short, M + labelW + colW * (i + 1) - 10 * k, y);
      g.textAlign = "left";
    });
    METRICS.forEach(function (m, mi) {
      var ry = y + (mi + 1) * rowH;
      g.strokeStyle = "#e2dbcd"; g.lineWidth = Math.max(1, 2 * k);
      g.beginPath(); g.moveTo(M, ry - rowH * .62); g.lineTo(W - M, ry - rowH * .62); g.stroke();
      g.fillStyle = "#16161a"; g.font = "600 " + px(50) + FONT;
      g.fillText(C.metrics[m.k][0], M, ry);
      g.font = "400 " + px(50) + FONT; g.fillStyle = "#4a4a52";
      a.results.forEach(function (r, i) {
        g.textAlign = "right";
        g.fillText(m.fmt(r), M + labelW + colW * (i + 1) - 10 * k, ry);
        g.textAlign = "left";
      });
    });

    /* ── 꼬리 ── */
    g.fillStyle = "#8a8780"; g.font = "400 " + px(44) + FONT;
    g.fillText("자판 데이터: libhangul · 키 간격 " + a.options.unit + "㎜ · " +
      MODEL_KO[a.options.model] + " 모형", M, H - M * .55);
    g.textAlign = "right"; g.fillStyle = "#16161a"; g.font = "700 " + px(50) + FONT;
    g.fillText(CFG.siteUrl ? CFG.siteUrl.replace(/^https?:\/\//, "") : "손가락 마일리지", W - M, H - M * .55);
    g.textAlign = "left";
    return true;
  }

  window.KM_APP = { S: S, render: render, J: J, layoutSheetSvg: layoutSheetSvg, drawPoster: drawPoster,
                    layoutList: layoutList, renderSoon: renderSoon, dist: dist, distStr: distStr, nf: nf, esc: esc, store: store };
})();

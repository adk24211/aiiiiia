/* 손가락 마일리지 — 상호작용, 파일 입력, 배열 편집기, 공유, 긴 글 */
(function () {
  "use strict";

  var D = window.KM_DATA, E = window.KM_ENGINE, C = window.KM_CONTENT;
  var CFG = window.KM_CONFIG || {};
  var A = window.KM_APP, S = A.S;

  /* 긴 글은 계산이 수백 ms 걸린다. 멈춘 것처럼 보이지 않게 먼저 알린다. */
  function busy() {
    if (S.text.length < 40000) return;
    var el = $("#srcStatus");
    if (el) el.textContent = "계산 중… (" + A.nf(S.text.length) + "자)";
  }

  /* prefers-reduced-motion 을 켠 사람에게는 부드러운 스크롤을 쓰지 않는다 */
  function scrollTo(el) {
    if (!el) return;
    var reduce = false;
    try { reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) {}
    el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = A.esc, nf = A.nf, store = A.store;

  /* ------------------------------------------------------------ 테마 */

  function prefersDark() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
    catch (e) { return false; }
  }

  function applyTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    var dark = t === "dark" || (!t && prefersDark());
    var btn = $("#themeToggle");
    // 토글 버튼의 접근 이름은 '무엇을 켜고 끄는가'여야 한다.
    // 이름을 동작('밝은 화면으로')으로 두면 aria-pressed 와 앞뒤가 맞지 않는다.
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    $("#themeLabel").textContent = "어두운 화면";
  }
  $("#themeToggle").addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme");
    var dark = cur ? cur === "dark" : prefersDark();
    var next = dark ? "light" : "dark";
    store("km.theme", next);
    applyTheme(next);
    busy();
    A.renderSoon(20);
  });

  /* ------------------------------------------------------------ 입력 */

  var src = $("#src");
  src.addEventListener("input", function () {
    S.text = src.value;
    S.fromFile = false;                      // 직접 친 글만 링크에 담는다
    S.source = src.value.trim() ? "typed" : "demo";
    if (!src.value.trim()) S.text = DEMO_TEXT();
    S.kakaoLabel = ""; S.kakao = null;
    $("#kakaoPanel").hidden = true;
    busy();
    A.renderSoon(260);
    writeHash();
  });
  function DEMO_TEXT() { return C.presets[0][1]; }

  /* 예시 글 버튼들 */
  (function () {
    var row = $("#presetRow");
    C.presets.forEach(function (p, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = p[0];
      b.addEventListener("click", function () {
        src.value = p[1]; S.text = p[1]; S.source = i === 0 ? "demo" : "typed";
        S.kakaoLabel = ""; S.kakao = null; $("#kakaoPanel").hidden = true;
        A.render(); writeHash();
        scrollTo(document.getElementById("results"));
      });
      row.appendChild(b);
    });
  })();
  $("#clearBtn").addEventListener("click", function () {
    src.value = ""; S.text = DEMO_TEXT(); S.source = "demo";
    S.kakaoLabel = ""; S.kakao = null; $("#kakaoPanel").hidden = true;
    A.render(); writeHash(); src.focus();
  });

  /* ------------------------------------------------------- 파일·카톡 */

  var dz = $("#dropzone"), fileInput = $("#fileInput");
  ["dragenter", "dragover"].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("is-over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("is-over"); });
  });
  dz.addEventListener("drop", function (e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) takeFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files[0]) takeFile(fileInput.files[0]);
  });

  function takeFile(file) {
    var status = $("#srcStatus");
    status.textContent = "파일 읽는 중…";
    var reader = window.KM_KAKAO && window.KM_KAKAO.readFile
      ? window.KM_KAKAO.readFile(file)
      : new Promise(function (res, rej) {
          var fr = new FileReader();
          fr.onload = function () { res(String(fr.result)); };
          fr.onerror = function () { rej(new Error("파일을 읽지 못했습니다")); };
          fr.readAsText(file, "utf-8");
        });

    reader.then(function (text) {
      var parsed = window.KM_KAKAO ? window.KM_KAKAO.parse(text) : { ok: false };
      if (parsed && parsed.ok && parsed.messages.length) {
        S.kakao = parsed;
        showKakaoPanel(parsed);
      } else {
        S.kakao = null; $("#kakaoPanel").hidden = true;
        S.text = text; S.source = "typed"; S.kakaoLabel = "";
        S.fromFile = true;                   // 파일에서 온 글 — 주소창에 넣지 않는다
        src.value = text.length > 20000 ? text.slice(0, 20000) : text;
        A.render();
        // render() 가 srcStatus 를 덮어쓰므로 그 뒤에 알린다
        status.textContent = text.trim()
          ? "카카오톡 형식이 아니어서 파일 내용을 그대로 계산했습니다."
          : "파일이 비어 있습니다.";
      }
    }).catch(function (err) {
      status.textContent = err && err.message ? err.message : "파일을 읽지 못했습니다.";
    });
  }

  function ymd(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }

  function showKakaoPanel(p) {
    var panel = $("#kakaoPanel");
    panel.hidden = false;
    $("#kakaoSummary").textContent =
      (p.room ? "채팅방 " + p.room + " · " : "") +
      "참여자 " + nf(p.speakers.length) + "명 · 메시지 " + nf(p.messages.length) + "개" +
      (p.first ? " · " + ymd(p.first) + " ~ " + ymd(p.last) : "") +
      (p.filteredCount ? " · 사진·이모티콘 " + nf(p.filteredCount) + "개 제외" : "");

    $("#speakerList").innerHTML = p.speakers.map(function (s, i) {
      return '<label><input type="checkbox" value="' + esc(s) + '" data-i="' + i + '"> ' + esc(s) + "</label>";
    }).join("");
    if (p.first) { $("#dateFrom").value = ymd(p.first); $("#dateTo").value = ymd(p.last); }
    $("#srcStatus").textContent = "대화 파일을 읽었습니다. 아래에서 본인 이름을 고르세요.";
    scrollTo(panel);
  }

  $("#kakaoApply").addEventListener("click", function () {
    var p = S.kakao; if (!p) return;
    var picked = Array.prototype.slice.call(document.querySelectorAll("#speakerList input:checked"))
      .map(function (i) { return i.value; });
    var set = picked.length ? new Set(picked) : null;
    var from = $("#dateFrom").value ? new Date($("#dateFrom").value + "T00:00:00").getTime() : null;
    var to = $("#dateTo").value ? new Date($("#dateTo").value + "T23:59:59").getTime() : null;
    if (from && to && from > to) {
      $("#srcStatus").textContent = "시작 날짜가 끝 날짜보다 뒤입니다. 두 날짜를 바꿔 주세요.";
      $("#dateFrom").focus();
      return;
    }
    S.text = window.KM_KAKAO.textOf(p, { speakers: set, from: from, to: to });
    S.source = "kakao";
    S.fromFile = true;
    // 카톡 내보내기에는 화자가 "나"로 나오는 경우가 있다 — "나님"이 되지 않게
    S.kakaoLabel = (picked.length === 1 ? picked[0] + (/^(나|내)$/.test(picked[0]) ? "" : "님")
                    : picked.length ? picked.length + "명" : "전체") +
      (p.first ? " · " + ymd(from || p.first) + "~" + ymd(to || p.last) : "");
    src.value = "";
    A.render();
    scrollTo(document.getElementById("results"));
  });

  $("#kakaoDrop").addEventListener("click", function () {
    S.kakao = null; S.kakaoLabel = ""; S.source = "demo"; S.text = DEMO_TEXT();
    fileInput.value = ""; $("#kakaoPanel").hidden = true; A.render();
  });

  /* ---------------------------------------------------------- 설정 */

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.name === "model") S.opts.model = t.value;
    else if (t.name === "pitch") S.opts.unit = parseFloat(t.value);
    else if (t.name === "lead") S.opts.leadStyle = t.value === "on";
    else return;
    busy();
    A.renderSoon(20);
  });


  /* -------------------------------------------------------- 편집기 */

  var USABLE_KEYS = "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./";

  function keysOf(L) {
    var used = {}, i, c;
    function mark(s) { for (i = 0; i < s.length; i++) { c = s.charAt(i); if (c !== " ") used[base(c)] = 1; } }
    function base(ch) {
      var b = E.GEOM.ansi.shiftBase[ch.charCodeAt(0)];
      return b >= 0 ? String.fromCharCode(b) : ch;
    }
    mark(L.cho); mark(L.jung); mark(L.jong);
    if (L.jungLead) for (var k in L.jungLead) used[base(L.jungLead[k])] = 1;
    return Object.keys(used).sort(function (a, b) {
      return USABLE_KEYS.indexOf(a) - USABLE_KEYS.indexOf(b);
    });
  }

  function labelFor(L, key) {
    var info = {}, i;
    function add(k, ch) {
      if (!k || k === " ") return;
      var b = E.GEOM.ansi.shiftBase[k.charCodeAt(0)];
      var bk = b >= 0 ? String.fromCharCode(b) : k;
      (info[bk] || (info[bk] = [])).push(ch);
    }
    for (i = 0; i < 19; i++) add(L.cho.charAt(i), D.SHOW_CHO.charAt(i));
    for (i = 0; i < 21; i++) add(L.jung.charAt(i), D.SHOW_JUNG.charAt(i));
    for (i = 0; i < 27; i++) add(L.jong.charAt(i), D.SHOW_JONG.charAt(i));
    return key + "  " + ((info[key] || []).join("") || "빈 키");
  }

  function buildEditor() {
    var baseId = $("#editorBase").value;
    var L = D.LAYOUTS[baseId];
    var keys = keysOf(L);
    var opts = keys.map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(labelFor(L, k)) + "</option>";
    }).join("");

    $("#editorGrid").innerHTML =
      '<div class="row-actions" style="margin-top:.4rem">' +
      '<label class="small">이 키를 <select id="swapA">' + opts + "</select></label>" +
      '<label class="small">이 키와 <select id="swapB">' + opts + "</select></label>" +
      '<button class="btn" type="button" id="swapAdd">맞바꾸기</button>' +
      '<button class="btn" type="button" id="autoFind">거리를 줄이는 교환 찾아보기</button>' +
      "</div>" +
      '<div id="swapList" class="small" style="margin-top:.6rem"></div>' +
      '<div id="autoOut" style="margin-top:.6rem"></div>';

    if ($("#swapB").options.length > 1) $("#swapB").selectedIndex = 1;
    $("#swapAdd").addEventListener("click", function () {
      var a = $("#swapA").value, b = $("#swapB").value;
      if (a === b) { msg("같은 키끼리는 바꿀 수 없습니다."); return; }
      if (S.custom && S.custom.baseId !== baseId) {
        msg("지금 교환은 " + D.LAYOUTS[S.custom.baseId].name + " 바탕입니다. 바꾸려면 ‘되돌리기’를 먼저 누르세요.");
        return;
      }
      S.custom = S.custom || { baseId: baseId, swaps: [] };
      // 같은 쌍을 다시 누르면 취소된다 (순서는 상관없다)
      var at = -1, i;
      for (i = 0; i < S.custom.swaps.length; i++) {
        var p = S.custom.swaps[i];
        if ((p[0] === a && p[1] === b) || (p[0] === b && p[1] === a)) { at = i; break; }
      }
      if (at >= 0) S.custom.swaps.splice(at, 1);
      else S.custom.swaps.push([a, b]);
      if (!S.custom.swaps.length) S.custom = null;
      clearOptimizer();
      afterSwapChange();
    });
    $("#autoFind").addEventListener("click", runOptimizer);
    drawSwapList();
  }

  function msg(t) { $("#editorMsg").textContent = t; }

  function drawSwapList() {
    var box = $("#swapList");
    if (!box) return;
    if (!S.custom || !S.custom.swaps.length) {
      box.innerHTML = '<span class="tiny">아직 바꾼 키가 없습니다. 두 키를 골라 맞바꾸면 비교표에 “내 배열” 열이 생깁니다.</span>';
      return;
    }
    box.innerHTML = "<strong>바꾼 키</strong> " + S.custom.swaps.map(function (s, i) {
      return '<button class="btn" type="button" data-rm="' + i + '" style="margin:.15rem">' +
        esc(s[0]) + " ⇄ " + esc(s[1]) + " <span aria-hidden=\"true\">×</span>" +
        '<span class="visually-hidden">교환 지우기</span></button>';
    }).join("");
    Array.prototype.slice.call(box.querySelectorAll("[data-rm]")).forEach(function (b) {
      b.addEventListener("click", function () {
        S.custom.swaps.splice(+b.dataset.rm, 1);
        if (!S.custom.swaps.length) S.custom = null;
        afterSwapChange();
      });
    });
  }

  function afterSwapChange() {
    drawSwapList(); A.render(); writeHash();
    msg(S.custom ? S.custom.swaps.length + "곳을 바꿨습니다." : "원래 배열로 돌아왔습니다.");
  }

  $("#editorBase").addEventListener("change", function () {
    S.custom = null; buildEditor(); A.render(); writeHash();
  });
  $("#editorApply").addEventListener("click", function () { busy(); A.renderSoon(20); msg("비교표를 갱신했습니다."); });
  $("#editorReset").addEventListener("click", function () {
    S.custom = null; buildEditor(); A.render(); writeHash(); msg("되돌렸습니다.");
  });

  /* 두 키를 바꿔 이동거리가 얼마나 주는지 전수 탐색 (표본 8천 자, 청크 처리) */
  var optRunning = false;
  function clearOptimizer() { var o = $("#autoOut"); if (o) o.innerHTML = ""; }

  function runOptimizer() {
    if (optRunning) return;
    var baseId = $("#editorBase").value;
    // 이미 바꾼 키가 있으면 그 결과(내 배열)를 기준으로 다음 교환을 찾는다.
    // 원본 기준으로 찾으면 "13% 줄어듭니다"가 두 번째 적용부터 맞지 않는다.
    var L = (S.custom && S.custom.baseId === baseId && S.custom.swaps.length)
      ? A.applySwaps(D.LAYOUTS[baseId], S.custom.swaps)
      : D.LAYOUTS[baseId];
    var text = S.text.length > 8000 ? S.text.slice(0, 8000) : S.text;
    var dec = E.decompose(text);
    if (!dec.length) { $("#autoOut").innerHTML = '<p class="small">계산할 한글이 없습니다.</p>'; return; }

    var keys = keysOf(D.LAYOUTS[baseId]);
    var pairs = [];
    for (var i = 0; i < keys.length; i++)
      for (var j = i + 1; j < keys.length; j++) pairs.push([keys[i], keys[j]]);

    var opt = { model: S.opts.model, unit: S.opts.unit, leadStyle: S.opts.leadStyle };
    var baseMM = E.measure(E.compile(L), dec, opt).mm;
    var out = $("#autoOut");
    out.innerHTML = '<p class="small" id="optProg" role="status" aria-live="polite">' + nf(pairs.length) +
      '가지 교환을 시험하는 중…</p><label class="visually-hidden" for="optBar">교환 탐색 진행률</label>' +
      '<progress id="optBar" max="' + pairs.length + '" value="0"></progress>';

    var results = [], idx = 0, CH = 60, lastSpoken = -1;
    optRunning = true;
    $("#autoFind").disabled = true;
    function stop() { optRunning = false; var b = $("#autoFind"); if (b) b.disabled = false; }
    function step() {
      var prog = $("#optProg"), bar = $("#optBar");
      if (!prog || !bar) { stop(); return; }      // 그 사이에 편집기가 다시 그려졌다
      var end = Math.min(pairs.length, idx + CH);
      for (; idx < end; idx++) {
        var swapped = A.swapOnce(L, pairs[idx][0], pairs[idx][1]);
        var mm = E.measure(E.compile(swapped), dec, opt).mm;
        if (mm < baseMM) results.push({ pair: pairs[idx], mm: mm, gain: (baseMM - mm) / baseMM * 100 });
      }
      bar.value = idx;
      // 눈으로 보는 진행률은 progress 가 보여 준다. 낭독은 25%마다 한 번만.
      var step25 = Math.floor(idx / pairs.length * 4);
      if (step25 !== lastSpoken) {
        lastSpoken = step25;
        prog.textContent = nf(pairs.length) + "가지 교환을 시험하는 중… " +
          nf(idx / pairs.length * 100, 0) + "%";
      }
      if (idx < pairs.length) { requestAnimationFrame(step); return; }
      stop();
      results.sort(function (a, b) { return b.gain - a.gain; });
      showOptimizer(results.slice(0, 5), pairs.length, L, text.length);
    }
    requestAnimationFrame(step);
  }

  function showOptimizer(top, tried, L, sampleLen) {
    var out = $("#autoOut");
    if (!top.length) {
      out.innerHTML = '<p class="small">' + nf(tried) +
        "가지를 다 해봤지만 이 글에서 이동거리를 줄이는 한 번의 교환은 없었습니다.</p>";
      return;
    }
    out.innerHTML = '<h3 style="margin:.6rem 0 .3rem">이 글 기준, 키 두 개만 바꾼다면</h3>' +
      '<p class="tiny">' + nf(tried) + "가지를 전부 시험했습니다 (앞 " + nf(sampleLen) + "자 표본).</p>" +
      '<ul class="findings">' + top.map(function (r, i) {
        return '<li data-mark="' + (i + 1) + '"><span><strong class="mono">' + esc(r.pair[0]) + " ⇄ " +
          esc(r.pair[1]) + "</strong> — " + esc(A.J(labelFor(L, r.pair[0]).slice(3), "와")) + " " +
          esc(A.J(labelFor(L, r.pair[1]).slice(3), "을")) + " 맞바꾸면 이동거리가 <strong>" +
          nf(r.gain, 1) + "%</strong> 줄어듭니다. " +
          '<button class="btn" type="button" data-apply="' + i + '">적용' +
          '<span class="visually-hidden"> — ' + esc(r.pair[0]) + '와 ' + esc(r.pair[1]) + ' 맞바꾸기</span>' +
          '</button></span></li>';
      }).join("") + "</ul>";
    Array.prototype.slice.call(out.querySelectorAll("[data-apply]")).forEach(function (b) {
      b.addEventListener("click", function () {
        var r = top[+b.dataset.apply];
        S.custom = S.custom && S.custom.baseId === $("#editorBase").value
          ? S.custom : { baseId: $("#editorBase").value, swaps: [] };
        S.custom.swaps.push(r.pair);
        // 남은 제안은 적용 전 배열 기준이라 이제 맞지 않는다. 지우고 다시 찾게 한다.
        clearOptimizer();
        afterSwapChange();
        msg("적용했습니다. 이어서 더 줄이려면 ‘거리를 줄이는 교환 찾아보기’를 다시 누르세요.");
      });
    });
  }

  /* ---------------------------------------------------------- 공유 */

  $("#savePng").addEventListener("click", function () {
    var cv = $("#cardCanvas");
    cv.toBlob(function (blob) {
      if (!blob) { $("#shareMsg").textContent = "이미지를 만들지 못했습니다. 캔버스를 길게 눌러 저장해 보세요."; return; }
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "손가락-마일리지.png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      $("#shareMsg").textContent = "저장했습니다.";
    }, "image/png");
  });

  $("#copyLink").addEventListener("click", function () {
    writeHash();
    var url = location.href;
    var hasText = url.indexOf("#") >= 0 && url.indexOf("t=") > url.indexOf("#");
    var done = function () {
      $("#shareMsg").textContent = hasText
        ? "링크를 복사했습니다. 이 링크에는 붙여 넣으신 글이 함께 담겨 있습니다."
        : "링크를 복사했습니다. 글 내용은 담기지 않았습니다.";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { $("#shareMsg").textContent = "주소창의 링크를 복사해 주세요."; }
      ta.remove();
    }
  });

  /* --------------------------------------------------------- 주소 해시 */

  function writeHash() {
    var parts = [];
    // 카톡이나 파일에서 온 글은 어떤 경우에도 주소창에 담지 않는다.
    if (S.source === "typed" && !S.fromFile && S.text && S.text.length <= 2000)
      parts.push("t=" + encodeURIComponent(S.text));
    if (S.custom && S.custom.swaps.length) {
      parts.push("b=" + S.custom.baseId);
      parts.push("s=" + encodeURIComponent(S.custom.swaps.map(function (p) { return p.join(""); }).join(",")));
    }
    var h = parts.length ? "#" + parts.join("&") : "";
    if (h !== location.hash) history.replaceState(null, "", location.pathname + location.search + h);
  }

  function readHash() {
    var h = location.hash.replace(/^#/, "");
    if (!h) return false;
    var q = {};
    h.split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i <= 0) return;
      // 남이 보낸 링크는 깨져 있을 수 있다. 여기서 던지면 페이지가 통째로 안 뜬다.
      try { q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); }
      catch (e) { /* 못 읽는 항목은 무시 */ }
    });
    var used = false;
    if (q.t) { S.text = q.t; S.source = "typed"; src.value = q.t; used = true; }
    if (q.b && Object.prototype.hasOwnProperty.call(D.LAYOUTS, q.b) && q.s) {
      var swaps = q.s.split(",").filter(function (p) { return p.length === 2; })
        .map(function (p) { return [p.charAt(0), p.charAt(1)]; });
      if (swaps.length) { S.custom = { baseId: q.b, swaps: swaps }; used = true; }
    }
    return used;
  }

  /* ---------------------------------------------------------- 긴 글 */

  function renderLongform() {
    // 빌드 시 index.html 에 미리 박혀 있으면 그대로 둔다 (크롤러가 보는 것과 같은 내용).
    // 비어 있을 때만 그린다 — 빌드를 안 돌린 사본이나 Artifact 미리보기 대비.
    var LF = window.KM_LONGFORM;
    if (LF) {
      if (!$("#learnBody").children.length) $("#learnBody").innerHTML = LF.learn(D.ORDER);
      if (!$("#faqBody").children.length) $("#faqBody").innerHTML = LF.faq();
      if (!$("#methodBody").children.length) $("#methodBody").innerHTML = LF.method();
    }

    if (CFG.repoUrl)
      $("#repoLinkSlot").innerHTML = '<a href="' + esc(CFG.repoUrl) + '" rel="noopener">소스와 이슈</a>';
    if (CFG.sponsorUrl)
      $("#repoLinkSlot").insertAdjacentHTML("afterend",
        '<li><a href="' + esc(CFG.sponsorUrl) + '" rel="noopener">후원하기</a></li>');

    if (CFG.coupangPartnerId) {
      var note = '<p class="ad-disclosure" role="note"><b>광고</b> · 이 페이지는 ' +
        "쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>";
      $("#disclosureSlot").innerHTML = note;
      // 심사지침은 본문 첫 부분과 끝 부분 양쪽 표시를 권고한다
      var tail = $("#methodBody");
      if (tail) tail.insertAdjacentHTML("beforeend", note);
    }

    // 애드센스: 클라이언트 ID와 슬롯 ID가 둘 다 있을 때만 실제 광고 단위를 만든다.
    if (CFG.adsenseClient) {
      var slots = [["adSlotTop", CFG.adsenseSlotTop], ["adSlotBottom", CFG.adsenseSlotBottom]]
        .filter(function (p) { return p[1] && document.getElementById(p[0]); });
      if (slots.length) {
        var sc2 = document.createElement("script");
        sc2.async = true; sc2.crossOrigin = "anonymous";
        sc2.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
          encodeURIComponent(CFG.adsenseClient);
        document.head.appendChild(sc2);
        slots.forEach(function (p) {
          var box = document.getElementById(p[0]);
          box.innerHTML = '<p class="promo-label" style="display:block;margin:1.4rem 0 .3rem">광고</p>' +
            '<ins class="adsbygoogle" style="display:block" data-ad-client="' + esc(CFG.adsenseClient) +
            '" data-ad-slot="' + esc(p[1]) + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
          try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
        });
      }
    }
  }

  /* --------------------------------------------------------- 언락 */

  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "unlockBtn") {
      var code = ($("#unlockCode") || {}).value || "";
      sha256Hex(code.trim() + "keymiles").then(function (h) {
        if ((CFG.unlockHashes || []).indexOf(h.slice(0, 12)) >= 0) {
          store("km.unlock", "1"); A.render();
        } else {
          $("#shareMsg").textContent = "코드를 확인하지 못했습니다.";
        }
      });
    }
    if (e.target && e.target.id === "csvBtn") downloadCsv();
    if (e.target && e.target.id === "posterBtn") downloadPoster(e.target);
    if (e.target && e.target.id === "sheetBtn") downloadSheet();
  });

  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob), el = document.createElement("a");
    el.href = url; el.download = name;
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 6000);
  }

  /* A3 300dpi 포스터. 모바일에서 캔버스 할당이 실패하면 A4로 낮춘다. */
  function downloadPoster(btn) {
    var out = document.getElementById("unlockMsg");
    var sizes = [[3508, 4961, "A3"], [2480, 3508, "A4"], [1754, 2480, "A5"]];   // 세로
    if (btn) { btn.disabled = true; btn.textContent = "만드는 중…"; }
    setTimeout(function () {
      var cv = document.createElement("canvas"), done = false;
      for (var i = 0; i < sizes.length && !done; i++) {
        try {
          if (!window.KM_APP.drawPoster(cv, sizes[i][0], sizes[i][1])) continue;
          /* 빈 캔버스가 나오는 환경(메모리 한계)을 걸러낸다 */
          var probe = cv.getContext("2d").getImageData(10, 10, 1, 1).data;
          if (probe[3] === 0) continue;
          done = sizes[i];
        } catch (err) { /* 더 작은 크기로 재시도 */ }
      }
      if (btn) { btn.disabled = false; btn.textContent = "A3 포스터 내려받기"; }
      if (!done) { if (out) out.textContent = "이 기기에서는 포스터를 만들지 못했습니다. CSV를 이용해 주세요."; return; }
      var label = done[2];
      cv.toBlob(function (blob) {
        if (!blob) { if (out) out.textContent = "이미지를 만들지 못했습니다."; return; }
        saveBlob(blob, "손가락-마일리지-포스터-" + label + ".png");
        if (out) out.textContent = label + " 300dpi 포스터를 저장했습니다.";
      }, "image/png");
    }, 30);
  }

  function downloadSheet() {
    var list = window.KM_APP.layoutList();
    list.forEach(function (L, i) {
      setTimeout(function () {
        saveBlob(new Blob([window.KM_APP.layoutSheetSvg(L)], { type: "image/svg+xml" }),
                 "자판-치트시트-" + L.short + ".svg");
      }, i * 250);
    });
    var out = document.getElementById("unlockMsg");
    if (out) out.textContent = "자판 " + list.length + "개의 치트시트를 저장했습니다.";
  }

  function sha256Hex(s) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve("");
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) {
        return x.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  /* 유료 언락 산출물: 요약 + 키별 + 손가락별 세 구역을 담은 CSV.
     엑셀에서 바로 열리도록 BOM 과 CRLF 를 쓴다. */
  function downloadCsv() {
    var a = S.last; if (!a) return;
    var g = E.GEOM.ansi;
    var rows = [];
    var push = function () { rows.push(Array.prototype.slice.call(arguments)); };

    push("손가락 마일리지 분석");
    push("계산 조건", "키 간격 " + a.options.unit + "mm",
         "모형 " + ({ kla: "표준", keep: "손가락 유지", home: "매번 홈 복귀" }[a.options.model]),
         "세벌식 겹모음 " + (a.options.leadStyle ? "오른손 자리" : "항상 왼손 자리"));
    push("입력", "한글 " + A.hangulCount(a) + "자", "계산 제외 " + a.text.skipped + "자",
         S.kakaoLabel || (S.source === "demo" ? "예시 문장" : "직접 넣은 글"));
    push("");

    push("[요약] 자판별 지표");
    push.apply(null, ["지표"].concat(a.results.map(function (r) { return r.layout.name; })));
    A.METRICS.forEach(function (m) {
      push.apply(null, [C.metrics[m.k][0]].concat(a.results.map(function (r) { return m.fmt(r); })));
    });
    push("");

    push("[손가락] 손가락별 타건 수와 비율");
    push.apply(null, ["손가락"].concat(a.results.map(function (r) { return r.layout.name; })));
    E.FINGER_KO.forEach(function (name, f) {
      push.apply(null, [name].concat(a.results.map(function (r) {
        return r.fingerLoad[f] + "회 (" + r.fingerPct[f].toFixed(1) + "%)";
      })));
    });
    push("");

    push("[키별] 자판 · 키 · 자모 · 손가락 · 줄 · 타건 수");
    push("자판", "키", "자모(기본)", "자모(시프트)", "손가락", "줄", "타건 수");
    a.results.forEach(function (r) {
      var info = A.keyLabels(r.layout);
      var list = [];
      for (var c = 0; c < 128; c++) if (r.keyCount[c]) list.push(c);
      list.sort(function (x, y) { return r.keyCount[y] - r.keyCount[x]; });
      list.forEach(function (c) {
        var ch = String.fromCharCode(c), lab = info[ch] || { base: [], shift: [] };
        push(r.layout.name, ch, lab.base.join(" "), lab.shift.join(" "),
             E.FINGER_KO[g.finger[c]] || "", E.ROW_KO[g.row[c]] || "", r.keyCount[c]);
      });
    });

    var csv = "\ufeff" + rows.map(function (r) {
      return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "손가락-마일리지.csv");
    var out = document.getElementById("unlockMsg");
    if (out) out.textContent = "CSV를 저장했습니다 (요약 · 손가락별 · 키별).";
  }

  /* ---------------------------------------------------------- 시작 */

  var saved = store("km.theme");
  applyTheme(saved === "dark" || saved === "light" ? saved : null);
  // 사파리 14 미만은 MediaQueryList 에 addEventListener 가 없다. 여기서 던지면 앱이 안 뜬다.
  (function () {
    var mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (!mq) return;
    var onChange = function () {
      if (!document.documentElement.getAttribute("data-theme")) A.render();
    };
    try {
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (e) { /* 테마 자동 전환만 안 될 뿐, 도구는 동작한다 */ }
  })();

  function readHashInit() {
    readHash();
    if (!S.text) S.text = DEMO_TEXT();
    src.value = S.text;                      // 빈 상태 금지 — 무엇을 재고 있는지 바로 보이게
    // 링크에 담겨 온 교환의 바탕 배열에 편집기를 맞춘다 (안 맞추면 다음 교환에서 통째로 버려진다)
    if (S.custom && D.LAYOUTS[S.custom.baseId]) $("#editorBase").value = S.custom.baseId;
  }
  try { readHashInit(); } catch (e) { /* 링크가 깨져도 도구는 떠야 한다 */ }
  renderLongform();
  buildEditor();
  A.render();
})();

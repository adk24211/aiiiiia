/* 손가락 마일리지 — 계산기 밖의 정적 페이지(자판 소개·비교·소개·방침)용 공통 스크립트.
 * 하는 일 세 가지: 테마 이어받기와 토글, 대가성 문구, 광고 단위.
 * 계산기(index.html)는 render.js/app.js 가 같은 일을 하므로 이 파일을 쓰지 않는다. */
(function () {
  "use strict";
  var CFG = window.KM_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }
    catch (e) { return null; }
  }
  function prefersDark() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
    catch (e) { return false; }
  }

  /* ── 테마: 계산기에서 고른 값을 그대로 이어받고, 여기서도 바꿀 수 있게 ── */
  var saved = store("km.theme");
  if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);

  var nav = $(".masthead nav");
  if (nav) {
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn"; btn.id = "themeToggle";
    var label = document.createElement("span");
    btn.appendChild(label);
    function sync() {
      var t = document.documentElement.getAttribute("data-theme");
      var dark = t ? t === "dark" : prefersDark();
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      label.textContent = "어두운 화면";
    }
    btn.addEventListener("click", function () {
      var t = document.documentElement.getAttribute("data-theme");
      var dark = t ? t === "dark" : prefersDark();
      var next = dark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      store("km.theme", next);
      sync();
    });
    sync();
    nav.appendChild(btn);
  }

  /* ── 대가성 문구: 제휴 링크가 있는 페이지의 첫 부분에 ── */
  var main = $("main");
  if (CFG.coupangPartnerId && main) {
    var wrap = main.querySelector(".wrap");
    if (wrap) {
      var note = document.createElement("p");
      note.className = "ad-disclosure";
      note.setAttribute("role", "note");
      note.innerHTML = "<b>광고</b> · 이 페이지는 쿠팡 파트너스 활동의 일환으로, " +
        "이에 따른 일정액의 수수료를 제공받습니다.";
      wrap.insertBefore(note, wrap.firstChild);
      // 본문 끝에도 한 번 더 (심사지침의 반복 표시 권고)
      var last = main.querySelectorAll(".wrap");
      var tail = last[last.length - 1];
      if (tail && tail !== wrap) tail.appendChild(note.cloneNode(true));
      else if (tail === wrap) wrap.appendChild(note.cloneNode(true));
    }
  }

  /* ── 광고 단위: 클라이언트 ID 와 슬롯 ID 가 둘 다 있을 때만 ── */
  if (CFG.adsenseClient && main) {
    var slots = [["adSlotTop", CFG.adsenseSlotTop], ["adSlotBottom", CFG.adsenseSlotBottom]]
      .filter(function (p) { return p[1] && document.getElementById(p[0]); });
    if (slots.length) {
      var sc = document.createElement("script");
      sc.async = true; sc.crossOrigin = "anonymous";
      sc.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
        encodeURIComponent(CFG.adsenseClient);
      document.head.appendChild(sc);
      slots.forEach(function (p) {
        document.getElementById(p[0]).innerHTML =
          '<p class="promo-label" style="display:block;margin:1.4rem 0 .3rem">광고</p>' +
          '<ins class="adsbygoogle" style="display:block" data-ad-client="' + esc(CFG.adsenseClient) +
          '" data-ad-slot="' + esc(p[1]) + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
      });
    }
  }
})();

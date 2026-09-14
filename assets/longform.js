/* 손가락 마일리지 — 긴 글의 HTML 을 만든다.
 * node(빌드 시 index.html 에 미리 박아 넣기)와 브라우저(폴백) 양쪽에서 같은 결과를 낸다.
 * 검색 크롤러가 자바스크립트를 돌리지 않아도 본문이 보이게 하려고 분리했다. */
(function (root) {
  "use strict";
  var C = root.KM_CONTENT;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function learn(order) {
    return "<h2>세 자판, 뭐가 다른가</h2>" +
      order.map(function (id) {
        var L = C.layouts[id];
        return "<h3>" + esc(L.title) + "</h3>" +
          L.body.map(function (p) { return "<p>" + p + "</p>"; }).join("");
      }).join("") +
      '<p class="small">각 자판의 전체 배열표는 ' +
      '<a href="dubeolsik.html">두벌식</a> · <a href="sebeolsik-390.html">세벌식 390</a> · ' +
      '<a href="sebeolsik-final.html">세벌식 최종</a> 페이지에 있습니다. ' +
      '세 자판을 숫자로 나란히 놓고 보려면 <a href="compare.html">숫자 비교</a>를 보세요.</p>';
  }

  function faq() {
    return "<h2>자주 묻는 질문</h2>" + C.faq.map(function (f) {
      return "<details><summary>" + esc(f[0]) + "</summary><p>" + f[1] + "</p></details>";
    }).join("");
  }

  function method() {
    var m = C.method;
    return "<h2>" + esc(m.title) + "</h2><ol>" +
      m.steps.map(function (s) { return "<li><strong>" + esc(s[0]) + "</strong> — " + s[1] + "</li>"; }).join("") +
      "</ol><h3>이 도구가 하지 못하는 것</h3><ul>" +
      m.caveats.map(function (c) { return "<li>" + c + "</li>"; }).join("") +
      '</ul><h3>출처</h3><div class="table-scroll"><table class="srcs">' +
      "<caption>계산이 의존하는 모든 외부 데이터</caption>" +
      '<thead><tr><th scope="col">항목</th><th scope="col">출처</th></tr></thead><tbody>' +
      m.sources.map(function (s) {
        return '<tr><th scope="row">' + esc(s[0]) + "</th><td>" + s[1] +
          (s[2] ? ' <a class="ext" href="' + esc(s[2]) + '" rel="noopener">' +
            '<span aria-hidden="true">↗</span><span class="visually-hidden">' +
            esc(s[0]) + ' 출처 열기</span></a>' : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  root.KM_LONGFORM = { learn: learn, faq: faq, method: method };
})(typeof window !== "undefined" ? window : globalThis);

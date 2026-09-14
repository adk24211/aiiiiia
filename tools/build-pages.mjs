/* 정적 서브페이지 생성기 — node tools/build-pages.mjs
 * 자판별 소개 페이지, 개인정보처리방침, sitemap, robots 를 만든다.
 * 자판 배열표와 지표는 실제 엔진으로 계산해 박아 넣으므로 본문과 도구가 어긋날 수 없다. */
import { createRequire } from "node:module";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
require("../assets/layouts.js");
require("../assets/engine.js");
require("../assets/content.js");
require("../assets/config.js");
const D = globalThis.KM_DATA, E = globalThis.KM_ENGINE;
const C = globalThis.KM_CONTENT, CFG = globalThis.KM_CONFIG || {};

/* siteUrl 을 채우면 canonical·og:image·sitemap 이 절대 주소가 된다.
   비워 두면 상대 경로로 두고 sitemap 은 만들지 않는다 (가짜 주소를 넣지 않기 위해). */
const SITE = (CFG.siteUrl || "").replace(/\/*$/, "");
const abs = (path) => (SITE ? SITE + "/" + path : path);

const DEMO =
  "안녕하세요 오늘 날씨가 참 좋네요 밖에 나가서 산책이라도 할까요 값싼 물건도 많이 샀어요\n" +
  "읽던 책을 다시 펼쳤다 ㅋㅋㅋ ㅠㅠ 넓은 하늘 아래 우리는 웃었다 의사 선생님께 여쭤봤어요";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (n, d = 0) => n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const distStr = (mm) => mm < 1000 ? nf(mm, 1) + "㎜" : mm < 1e6 ? nf(mm / 1000, 2) + "m" : nf(mm / 1e6, 2) + "km";

function shell({ title, desc, canonical, body, extraHead = "" }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#f7f4ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121216" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(abs("og.png"))}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2316161a'/%3E%3Crect x='6' y='11' width='7' height='7' rx='1.6' fill='%23f7f4ee'/%3E%3Crect x='15.5' y='11' width='7' height='7' rx='1.6' fill='%23b03a12'/%3E%3Crect x='6' y='20' width='16.5' height='4.5' rx='1.4' fill='%23f7f4ee' opacity='.55'/%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/style.css">${extraHead}
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="masthead"><div class="wrap">
  <a class="brand" href="./">
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="currentColor"></rect>
      <rect x="6" y="11" width="7" height="7" rx="1.6" fill="var(--paper)"></rect>
      <rect x="15.5" y="11" width="7" height="7" rx="1.6" fill="var(--accent)"></rect>
      <rect x="6" y="20" width="16.5" height="4.5" rx="1.4" fill="var(--paper)" opacity=".55"></rect>
    </svg><span>손가락 마일리지</span></a>
  <nav aria-label="사이트"><a class="btn btn-primary" href="./">내 글로 계산해 보기</a></nav>
</div></header>
<main id="main">${body}</main>
<footer><div class="wrap">
  <ul style="list-style:none;padding:0;margin:0 0 1rem;display:flex;gap:1rem;flex-wrap:wrap;font-size:.88rem">
    <li><a href="./">계산기</a></li>
    <li><a href="dubeolsik.html">두벌식</a></li>
    <li><a href="sebeolsik-390.html">세벌식 390</a></li>
    <li><a href="sebeolsik-final.html">세벌식 최종</a></li>
    <li><a href="privacy.html">개인정보처리방침</a></li>
  </ul>
  <p class="tiny">자판 배열 데이터는 <a href="https://github.com/libhangul/libhangul" rel="noopener">libhangul</a>
    원본에서 기계 추출했습니다 · 코드 MIT</p>
</div></footer>
</body>
</html>
`;
}

/* 정적 자판 그림 (타건 수 없이 배열만) */
function layoutSvg(L) {
  const U = 20, PAD = 3;
  const info = {};
  // 같은 글자(ㄱ)라도 초성 자리인지 받침 자리인지는 어느 표에서 왔느냐로만 알 수 있다
  const add = (key, ch, kind) => {
    if (!key || key === " ") return;
    const sb = E.GEOM.ansi.shiftBase[key.charCodeAt(0)];
    const base = sb >= 0 ? String.fromCharCode(sb) : key;
    const slot = info[base] || (info[base] = { base: [], shift: [], kinds: new Set() });
    const arr = sb >= 0 ? slot.shift : slot.base;
    if (!arr.includes(ch)) arr.push(ch);
    slot.kinds.add(kind);
  };
  for (let i = 0; i < 19; i++) add(L.cho[i], D.SHOW_CHO[i], "cho");
  for (let i = 0; i < 21; i++) add(L.jung[i], D.SHOW_JUNG[i], "jung");
  for (let i = 0; i < 27; i++) add(L.jong[i], D.SHOW_JONG[i], "jong");
  if (L.jungLead) for (const k in L.jungLead) add(L.jungLead[k], D.SHOW_JUNG[+k], "jung");

  const COLOR = { cho: "var(--tint-cho)", jung: "var(--tint-jung)", jong: "var(--tint-jong)" };

  let p = [];
  E.ANSI_ROWS.forEach((r, i) => {
    for (let j = 0; j < r.keys.length; j++) {
      const key = r.keys[j], x = r.xoff + j, lab = info[key];
      // 세벌식은 초성/중성/종성이 색으로 구분된다 — 색만으로 뜻을 전하지 않도록 글자도 함께 적는다
      let fill = "var(--surface)";
      if (lab) fill = lab.kinds.size === 1 ? COLOR[[...lab.kinds][0]] : "var(--surface-2)";
      p.push(`<rect class="kcap" x="${(PAD + x * U + .6).toFixed(2)}" y="${(PAD + i * U + .6).toFixed(2)}" width="${(U - 1.2).toFixed(2)}" height="${(U - 1.2).toFixed(2)}" rx="2.4" fill="${fill}"></rect>`);
      const tx = (PAD + (x + .5) * U).toFixed(2);
      p.push(`<text x="${tx}" y="${(PAD + (i + .84) * U).toFixed(2)}" text-anchor="middle" font-size="4.2" fill="var(--ink-3)">${esc(key === "\\" ? "\\" : key)}</text>`);
      if (lab) {
        if (lab.shift.length) p.push(`<text x="${tx}" y="${(PAD + (i + .3) * U).toFixed(2)}" text-anchor="middle" font-size="4.4" font-weight="600" fill="var(--ink-2)">${esc(lab.shift.join(""))}</text>`);
        p.push(`<text x="${tx}" y="${(PAD + (i + .62) * U).toFixed(2)}" text-anchor="middle" font-size="6.6" font-weight="700" fill="var(--ink)">${esc(lab.base.join(""))}</text>`);
      }
    }
  });
  const W = 15.5 * U + PAD * 2, H = 4 * U + PAD * 2;
  const nKeys = Object.keys(info).length;
  const desc = `${L.name} 배열도. 자모가 배치된 키 ${nKeys}개를 그린 그림이며, 같은 내용이 아래 '전체 배열표'에 글자와 표로 모두 적혀 있습니다.`;
  return `<div class="kbd"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="lt ld"><title id="lt">${esc(L.name)} 배열도</title><desc id="ld">${esc(desc)}</desc>${p.join("")}</svg></div>`;
}

function jamoTable(L) {
  const rowsFor = (kind, show, comb) => {
    const out = [];
    for (let i = 0; i < show.length; i++) {
      const key = L[kind][i];
      const keys = E.keysFor(L, kind, i, false, 0);
      out.push(`<tr><th scope="row">${esc(show[i])}</th><td class="mono">${key === " " ? "—" : esc(key)}</td><td class="mono">${esc(keys)}</td><td>${keys.length}</td></tr>`);
    }
    return out.join("");
  };
  const block = (label, kind, show) =>
    `<h3>${label} ${show.length}개</h3><div class="table-scroll"><table>
      <caption>${esc(L.name)} — ${label}별 전용 키와 실제 타건열</caption>
      <thead><tr><th scope="col">자모</th><th scope="col">전용 키</th><th scope="col">실제 타건</th><th scope="col">타건 수</th></tr></thead>
      <tbody>${rowsFor(kind, show)}</tbody></table></div>`;
  return block("초성", "cho", D.SHOW_CHO) + block("중성", "jung", D.SHOW_JUNG) + block("종성(받침)", "jong", D.SHOW_JONG);
}

const a = E.analyze(DEMO);
const byId = Object.fromEntries(a.results.map((r) => [r.layout.id, r]));

const PAGES = {
  dubeol: {
    file: "dubeolsik.html",
    title: "두벌식 표준 자판 배열 (KS X 5002) — 전체 배열표와 이동거리 지표",
    desc: "두벌식 표준 자판의 초성·중성·종성 전체 배열표와, 같은 글을 세벌식으로 쳤을 때와 비교한 손가락 이동거리·시프트·같은 손가락 연속 지표.",
    intro: [
      "지금 한국에서 파는 거의 모든 키보드에 인쇄된 배열입니다. 1982년 정보처리용 표준 자판안으로 정해졌고, 1992년 국가표준 KS X 5002가 되었습니다.",
      "이름 그대로 <strong>두 벌</strong>입니다. 자음 한 벌, 모음 한 벌. 초성 ㄱ과 종성 ㄱ이 같은 키라서 글자 경계는 컴퓨터가 뒤에서 판단합니다(오토마타).",
      "받침 전용 키가 없으므로 받침은 대응하는 초성 키로 칩니다. 겹받침은 두 번에 나눠 칩니다 — 예를 들어 <span class=\"mono\">값</span>의 ㅄ은 ㅂ과 ㅅ 두 타건입니다."
    ]
  },
  s390: {
    file: "sebeolsik-390.html",
    title: "세벌식 390 자판 배열 (3-90) — 전체 배열표와 이동거리 지표",
    desc: "공병우 세벌식 390 자판의 초성·중성·종성 전체 배열표와, 두벌식·세벌식 최종과 비교한 손가락 이동거리·시프트·같은 손가락 연속 지표.",
    intro: [
      "공병우 박사가 만든 세벌식 계열의 1990년 배열입니다. 초성·중성·종성을 <strong>각각 다른 키</strong>에 두어, 컴퓨터가 글자 경계를 추측할 필요가 없습니다.",
      "받침에 제 키를 주었지만 자리가 모자라, 겹받침 여섯 개(ㄳ ㄵ ㄼ ㄽ ㄾ ㄿ)는 두 번에 나눠 칩니다. 이 여섯 개가 다음 배열인 '최종'과 갈리는 지점입니다.",
      "홑모음 ㅗ·ㅜ는 왼손 <span class=\"mono\">v</span>·<span class=\"mono\">b</span>에서 치고, 겹모음의 앞자리로 쓸 때는 오른손 <span class=\"mono\">/</span>·<span class=\"mono\">9</span>를 씁니다."
    ]
  },
  sfinal: {
    file: "sebeolsik-final.html",
    title: "세벌식 최종 자판 배열 (3-91) — 전체 배열표와 이동거리 지표",
    desc: "공병우 세벌식 최종(3-91) 자판의 초성·중성·종성 전체 배열표와, 두벌식·세벌식 390과 비교한 손가락 이동거리·시프트·같은 손가락 연속 지표.",
    intro: [
      "1991년에 나온 공병우 세벌식의 마지막 정리본이라 '최종'이라고 부릅니다. 390에서 빠졌던 겹받침까지 <strong>받침 27개 전부에 제 키를 준</strong> 배열입니다.",
      "받침을 한 번에 치므로 타건 수가 줄고, 초성·중성·종성이 손을 번갈아 쓰도록 배치되어 같은 손가락이 연달아 걸리는 일이 드뭅니다.",
      "대신 자모 56개를 넣느라 숫자행과 시프트 자리까지 씁니다. 그래서 <strong>타건 수는 줄어도 이동거리는 늘어나는</strong> 역설이 나타납니다."
    ]
  }
};

const METRIC_ROWS = [
  ["총 이동거리", (r) => distStr(r.mm)],
  ["총 타건 수", (r) => nf(r.totalStrokes) + "회"],
  ["시프트 타건", (r) => nf(r.shifts) + "회"],
  ["같은 손가락 연속(SFB)", (r) => nf(r.sfbPct, 2) + "%"],
  ["손 교대율", (r) => nf(r.altPct, 1) + "%"],
  ["홈 포지션 유지율", (r) => nf(r.homePct, 1) + "%"],
  ["숫자행 사용률", (r) => nf(r.numRowPct, 1) + "%"],
  ["좌우 손 비율", (r) => nf(r.leftPct, 0) + " : " + nf(r.rightPct, 0)]
];

let urls = ["", ...Object.values(PAGES).map((p) => p.file)];

for (const id of D.ORDER) {
  const L = D.LAYOUTS[id], meta = PAGES[id], r = byId[id];
  const counts = { cho: 19 - (L.cho.split("").filter((c) => c === " ").length),
                   jung: 21 - (L.jung.split("").filter((c) => c === " ").length),
                   jong: 27 - (L.jong.split("").filter((c) => c === " ").length) };
  const body = `
<section><div class="wrap">
  <p class="eyebrow">한글 자판 배열</p>
  <h1>${esc(L.name)}</h1>
  <p class="lede">${meta.intro[0]}</p>
  ${meta.intro.slice(1).map((p) => `<p>${p}</p>`).join("")}
  <p class="small">전용 키가 있는 자모: 초성 ${counts.cho}개 · 중성 ${counts.jung}개 · 받침 ${counts.jong}개.${
    L.twoSet ? " 두벌식에는 받침 전용 키가 없어, 받침은 대응하는 초성 키로 칩니다." :
               " 나머지는 조합 규칙에 따라 두 번에 나눠 칩니다."}</p>
  ${layoutSvg(L)}
  <p class="legend"><span class="sw" style="background:#e8f0f8;width:14px;height:12px;display:inline-block;border:1px solid var(--line-2)"></span> 초성
    <span class="sw" style="background:#fdeee5;width:14px;height:12px;display:inline-block;border:1px solid var(--line-2)"></span> 중성
    <span class="sw" style="background:#eaf3ec;width:14px;height:12px;display:inline-block;border:1px solid var(--line-2)"></span> 받침
    <span class="sw" style="background:var(--surface-2);width:14px;height:12px;display:inline-block;border:1px solid var(--line-2)"></span> 두 종류가 같이 있는 키
    <span>· 키 위쪽 작은 글자는 시프트를 눌러야 나옵니다</span></p>
</div></section>

<section><div class="wrap">
  <h2>같은 글을 세 자판으로 쳐 보면</h2>
  <p class="small">아래는 한글 ${nf(a.text.syllables)}자짜리 예시문을 각 자판으로 쳤을 때의 값입니다.
    키 간격 19.05㎜, 손가락 유지 모델 기준. <a href="./">내 글로 직접 계산해 볼 수 있습니다</a>.</p>
  <div class="table-scroll"><table>
    <caption>예시문 ${nf(a.text.syllables)}자 기준 자판별 지표</caption>
    <thead><tr><th scope="col">지표</th>${D.ORDER.map((x) => `<th scope="col"${x === id ? ' style="color:var(--accent)"' : ""}>${esc(D.LAYOUTS[x].short)}</th>`).join("")}</tr></thead>
    <tbody>${METRIC_ROWS.map(([name, fn]) =>
      `<tr><th scope="row">${esc(name)}</th>${D.ORDER.map((x) =>
        `<td class="num"${x === id ? ' style="font-weight:700"' : ""}>${fn(byId[x])}</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>
  <p style="margin-top:1.2rem"><a class="btn btn-primary btn-lg" href="./">내가 쓴 글로 계산해 보기</a></p>
</div></section>

<section><div class="wrap">
  <h2>${esc(L.name)} 전체 배열표</h2>
  <p class="small">'실제 타건'은 그 자모를 입력하려면 실제로 눌러야 하는 키 순서입니다.
    전용 키가 없는 자모는 조합 규칙에 따라 두 번 이상 눌러야 합니다.</p>
  ${jamoTable(L)}
  <p class="tiny">배열 데이터 출처: libhangul <span class="mono">hangul/hangulkeyboard.h</span>.
    틀린 곳을 발견하시면 이슈로 알려 주세요.</p>
</div></section>`;

  writeFileSync(join(ROOT, meta.file),
    shell({ title: meta.title, desc: meta.desc, canonical: abs(meta.file), body }));
  console.log("wrote", meta.file);
}

/* ------------------------------------------------------------- 개인정보 */
const privacy = `
<section><div class="wrap" style="max-width:44rem">
  <h1>개인정보처리방침</h1>
  <p class="lede">이 사이트는 이용자의 개인정보를 수집하지 않습니다. 아래는 그 사실을 구체적으로 확인해 드리는 문서입니다.</p>

  <h2>1. 이 사이트의 구조</h2>
  <p>손가락 마일리지는 서버가 없는 정적 웹사이트입니다. HTML·CSS·JavaScript 파일만 내려받아 이용자의
     브라우저에서 실행되며, 계산을 처리하는 서버나 데이터베이스가 존재하지 않습니다.</p>

  <h2>2. 이용자가 입력한 글과 파일</h2>
  <p>텍스트 입력란에 붙여 넣은 글과, 선택한 카카오톡 대화 파일은 <strong>브라우저 메모리 안에서만</strong>
     읽고 계산합니다. 어떤 형태로도 외부로 전송하지 않으며, 전송하는 코드 자체가 포함되어 있지 않습니다.
     페이지를 닫거나 새로고침하면 즉시 사라집니다.</p>
  <p>이 점은 브라우저 개발자 도구의 네트워크 탭을 열어 두고 파일을 넣어 보시면 직접 확인할 수 있습니다.
     소스 코드도 전부 공개되어 있습니다.</p>

  <h2>3. 브라우저에 저장되는 값</h2>
  <p>이용자 편의를 위해 다음 값만 브라우저의 로컬 저장소(localStorage)에 남습니다. 이 값은 이용자의 기기를
     떠나지 않으며, 브라우저 설정에서 언제든 삭제할 수 있습니다.</p>
  <ul>
    <li><span class="mono">km.theme</span> — 밝은 화면 / 어두운 화면 선택</li>
    <li><span class="mono">km.unlock</span> — 고해상도 내려받기 잠금 해제 여부 (해당 기능을 이용한 경우에만)</li>
  </ul>
  <p>대화 파일의 내용이나 참여자 이름은 저장하지 않습니다. 주소창 링크에 담기지도 않습니다.</p>

  <h2>4. 접속 기록</h2>
  <p>이 사이트는 GitHub Pages를 통해 제공됩니다. 웹사이트 제공 과정에서 GitHub이 접속 로그(IP 주소 등)를
     수집할 수 있으며, 이는 운영자가 접근하거나 통제할 수 없는 영역입니다. 자세한 내용은 GitHub의
     개인정보처리방침을 참고해 주세요.</p>

  <h2>5. 광고와 쿠키</h2>
  <p id="adsNote">현재 이 사이트에는 광고가 게재되어 있지 않으며, 광고용 쿠키를 사용하지 않습니다.
     추후 광고를 게재하게 되면 이 항목을 먼저 갱신하고, 광고 제공자가 사용하는 쿠키의 종류와
     거부 방법을 함께 안내하겠습니다.</p>

  <h2>6. 만 14세 미만 이용자</h2>
  <p>이 사이트는 어떤 개인정보도 수집하지 않으므로 연령에 따른 별도 처리 절차를 두고 있지 않습니다.</p>

  <h2>7. 문의</h2>
  <p>이 방침에 대한 문의나 정정 요청은 <a href="https://github.com/adk24211/aiiiiia/issues" rel="noopener">GitHub 이슈</a>로
     남겨 주세요.</p>

  <p class="small" id="privacyDate">이 방침은 사이트 공개일부터 적용됩니다. 내용이 바뀌면 이 페이지에서 알립니다.</p>
</div></section>`;

writeFileSync(join(ROOT, "privacy.html"), shell({
  title: "개인정보처리방침 — 손가락 마일리지",
  desc: "손가락 마일리지는 서버가 없는 정적 사이트로, 이용자가 넣은 글과 파일을 외부로 전송하지 않습니다.",
  canonical: abs("privacy.html"),
  body: privacy,
  extraHead: '\n<meta name="robots" content="index,follow">'
}));
console.log("wrote privacy.html");

/* --------------------------------------------- index.html 의 메타·JSON-LD */
{
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebApplication", name: "손가락 마일리지",
        url: abs(""), applicationCategory: "UtilityApplication",
        operatingSystem: "Any", browserRequirements: "JavaScript",
        description: "한국어 텍스트를 두벌식·세벌식 자판의 실제 타건열로 전개해 손가락 이동거리를 계산하는 도구",
        inLanguage: "ko",
        offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" } },
      { "@type": "FAQPage",
        mainEntity: C.faq.map(([q, aTxt]) => ({
          "@type": "Question", name: q,
          acceptedAnswer: { "@type": "Answer", text: aTxt.replace(/<[^>]+>/g, "") }
        })) }
    ]
  };
  const tag = `<script type="application/ld+json">\n${JSON.stringify(ld, null, 1)}\n<\/script>`;
  const idx = join(ROOT, "index.html");
  let html = readFileSync(idx, "utf8");
  html = html.replace(/<!-- LD:START -->[\s\S]*?<!-- LD:END -->/, `<!-- LD:START -->${tag}<!-- LD:END -->`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${esc(abs("index.html"))}">`);
  html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(abs("og.png"))}">`);
  writeFileSync(idx, html);
  console.log("patched index.html (JSON-LD, canonical, og:image)");
}

/* ------------------------------------------------------------- sitemap */
if (SITE) {
  writeFileSync(join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${SITE}/${u}</loc></url>`).join("\n") + `\n</urlset>\n`);
  writeFileSync(join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log("wrote sitemap.xml, robots.txt");
} else {
  // 주소를 모르는 채로 가짜 sitemap 을 올리면 색인에 해가 된다.
  writeFileSync(join(ROOT, "robots.txt"),
    `User-agent: *\nAllow: /\n\n# assets/config.js 의 siteUrl 을 채우고 tools/build-pages.mjs 를 다시 돌리면\n# sitemap.xml 이 생성되고 이 파일에 주소가 들어갑니다.\n`);
  try { unlinkSync(join(ROOT, "sitemap.xml")); } catch {}
  console.log("siteUrl 이 비어 있어 sitemap 은 만들지 않았습니다 (robots.txt 만 갱신)");
}

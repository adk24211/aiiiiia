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
    <li><a href="compare.html">숫자 비교</a></li>
    <li><a href="dubeolsik.html">두벌식</a></li>
    <li><a href="sebeolsik-390.html">세벌식 390</a></li>
    <li><a href="sebeolsik-final.html">세벌식 최종</a></li>
    <li><a href="about.html">소개</a></li>
    <li><a href="privacy.html"><strong>개인정보처리방침</strong></a></li>
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
      "지금 한국에서 파는 거의 모든 키보드에 인쇄된 배열입니다. 1982년에 정보처리용 표준 자판으로 정해졌고, 지금 쓰는 번호인 KS X 5002는 2007년 개정판부터입니다. 뿌리는 1969년 전신 타자기용 표준 자판까지 거슬러 올라갑니다.",
      "이름 그대로 <strong>두 벌</strong>입니다. 자음 한 벌, 모음 한 벌. 초성 ㄱ과 받침 ㄱ이 같은 키라서 글자 경계는 입력기가 뒤에서 판단하며, 치는 도중 엉뚱한 글자가 잠깐 보였다 사라지는 '도깨비불' 현상이 여기서 나옵니다.",
      "받침 전용 키가 없으므로 받침은 대응하는 초성 키로 칩니다. 겹받침은 두 번에 나눠 칩니다 — 예를 들어 <span class=\"mono\">값</span>의 ㅄ은 ㅂ과 ㅅ 두 타건입니다."
    ]
  },
  s390: {
    file: "sebeolsik-390.html",
    title: "세벌식 390 자판 배열 (3-90) — 전체 배열표와 이동거리 지표",
    desc: "공병우 세벌식 390 자판의 초성·중성·종성 전체 배열표와, 두벌식·세벌식 최종과 비교한 손가락 이동거리·시프트·같은 손가락 연속 지표.",
    intro: [
      "초성·중성·종성을 <strong>각각 다른 키</strong>에 둔 배열입니다. 왼쪽 바깥이 받침, 가운데가 모음, 오른쪽이 첫소리라서 입력기가 글자 경계를 추측할 필요가 없고, 도깨비불 현상도 없습니다. 공병우가 1988년에 세운 한글문화원에서 연구원 박흥호가 주도해, 1989년의 3-89 자판을 개선해 1990년에 내놓았습니다.",
      "받침에 제 키를 주었지만 자리가 모자라, 겹받침 여섯 개(ㄳ ㄵ ㄼ ㄽ ㄾ ㄿ)는 두 번에 나눠 칩니다. 이 여섯 개가 다음 배열인 '최종'과 갈리는 지점입니다.",
      "홑모음 ㅗ·ㅜ는 왼손 <span class=\"mono\">v</span>·<span class=\"mono\">b</span>에서 치고, 겹모음의 앞자리로 쓸 때는 오른손 <span class=\"mono\">/</span>·<span class=\"mono\">9</span>를 씁니다."
    ]
  },
  sfinal: {
    file: "sebeolsik-final.html",
    title: "세벌식 최종 자판 배열 (3-91) — 전체 배열표와 이동거리 지표",
    desc: "공병우 세벌식 최종(3-91) 자판의 초성·중성·종성 전체 배열표와, 두벌식·세벌식 390과 비교한 손가락 이동거리·시프트·같은 손가락 연속 지표.",
    intro: [
      "공병우가 마지막으로 손본 배열이라 '최종'이라 부릅니다. 3-91이라는 이름은 작업이 시작된 1991년에서 왔고, 완성은 1992년 초로 전해집니다. 390에서 빠졌던 겹받침까지 <strong>받침 27개 전부에 제 키를 준</strong> 배열입니다.",
      "받침을 한 번에 치므로 타건 수가 줄고, 초성·중성·종성이 손을 번갈아 쓰도록 배치되어 같은 손가락이 연달아 걸리는 일이 드뭅니다. 390과 비교하면 <strong>초성 19개는 완전히 같고 중성은 ㅒ 한 자리만 다르며</strong>, 진짜 차이는 받침 27자리 중 12자리에 있습니다.",
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

let urls = ["", "compare.html", ...Object.values(PAGES).map((p) => p.file), "about.html", "privacy.html"];

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
    키 간격 19.05㎜, 기본(표준) 모형 기준. <a href="./">내 글로 직접 계산해 볼 수 있습니다</a>.</p>
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

/* ------------------------------------------------------------ 비교 페이지 */
/* "두벌식 세벌식 차이"처럼 답이 숫자여야 하는 질문에, 실제로 숫자를 내놓는 페이지.
   모든 값은 이 저장소의 엔진으로 계산해 박아 넣으므로 도구와 어긋날 수 없다. */
{
  const SAMPLES = C.presets.map(([name, text]) => ({ name, text }));
  SAMPLES.push({ name: "다섯 표본 전체", text: C.presets.map((p) => p[1]).join("\n") });

  const rows = SAMPLES.map((sm) => ({ ...sm, a: E.analyze(sm.text) }));
  const total = rows[rows.length - 1].a;

  const METRICS = [
    ["총 이동거리", (r) => distStr(r.mm), (r) => r.mm, true],
    ["총 타건 수", (r) => nf(r.totalStrokes) + "회", (r) => r.totalStrokes, true],
    ["시프트 타건", (r) => nf(r.shifts) + "회", (r) => r.shifts, true],
    ["같은 손가락 연속", (r) => nf(r.sfbPct, 2) + "%", (r) => r.sfbPct, true],
    ["손 교대율", (r) => nf(r.altPct, 1) + "%", (r) => r.altPct, false],
    ["홈 포지션 유지율", (r) => nf(r.homePct, 1) + "%", (r) => r.homePct, false],
    ["숫자행 사용률", (r) => nf(r.numRowPct, 1) + "%", (r) => r.numRowPct, true],
    ["좌우 손 비율", (r) => nf(r.leftPct, 0) + " : " + nf(r.rightPct, 0), (r) => Math.abs(50 - r.leftPct), true]
  ];

  const winnerRow = (label, fmt, get, lower) => {
    const vals = total.results.map(get);
    const shown = total.results.map(fmt);
    const best = lower ? Math.min(...vals) : Math.max(...vals);
    const bestShown = shown[vals.indexOf(best)];
    const anyDiff = shown.some((v) => v !== shown[0]);
    return `<tr><th scope="row">${esc(label)}</th>${total.results.map((r, i) =>
      `<td class="num${anyDiff && shown[i] === bestShown ? " best" : ""}">${shown[i]}</td>`).join("")}</tr>`;
  };

  /* 390 과 최종이 실제로 다른 자리 */
  const L390 = D.LAYOUTS.s390, LFIN = D.LAYOUTS.sfinal;
  const diffs = [];
  const scan = (kind, show, ko) => {
    for (let i = 0; i < show.length; i++) {
      const a = L390[kind][i], b = LFIN[kind][i];
      if (a !== b) diffs.push({ ko, jamo: show[i], a, b });
    }
  };
  scan("cho", D.SHOW_CHO, "초성"); scan("jung", D.SHOW_JUNG, "중성"); scan("jong", D.SHOW_JONG, "받침");
  const keyOrNone = (k) => k === " " ? '<span class="tiny">전용 키 없음 (두 번에 침)</span>' : `<span class="mono">${esc(k)}</span>`;

  const d0 = total.results[0], d2 = total.results[2];
  const gap = ((d2.mm - d0.mm) / d0.mm * 100);

  const body = `
<section><div class="wrap">
  <p class="eyebrow">숫자로 보는 비교</p>
  <h1>두벌식과 세벌식, 실제로 얼마나 다른가</h1>
  <p class="lede">성향이나 후기가 아니라 <strong>계산된 값</strong>으로 비교합니다.
    같은 한국어 글을 세 자판의 실제 타건열로 펼쳐 손가락 이동거리와 타자 지표를 잰 결과입니다.</p>
  <p>결론부터: <strong>세벌식은 타건 수·시프트·같은 손가락 연속에서 이기고, 이동거리에서 집니다.</strong>
    아래 ${nf(total.text.syllables)}자 표본에서 세벌식 최종은 두벌식보다 이동거리가
    <strong>${nf(gap, 0)}% 깁니다.</strong> 자모를 숫자행까지 펼쳐 놓은 값입니다.
    어느 쪽이 나은지는 무엇을 중요하게 보느냐에 달렸고, 이 페이지는 그 판단 재료를 줍니다.</p>

  <h2>한눈에</h2>
  <p class="small">한국어 ${nf(total.text.syllables)}자(아래 다섯 표본을 합친 글) 기준.
    ● 표시가 그 항목에서 유리한 쪽입니다.</p>
  <div class="table-scroll"><table>
    <caption>세 자판 지표 비교 — 한국어 ${nf(total.text.syllables)}자 기준</caption>
    <thead><tr><th scope="col">지표</th>${D.ORDER.map((id) =>
      `<th scope="col">${esc(D.LAYOUTS[id].short)}</th>`).join("")}</tr></thead>
    <tbody>${METRICS.map(([l, f, g, lo]) => winnerRow(l, f, g, lo)).join("")}</tbody>
  </table></div>

  <h2>글의 종류에 따라 달라지나</h2>
  <p class="small">달라집니다. 받침이 많은 글일수록 세벌식 최종이 유리해지고,
    ㅋㅋㅋ 같은 반복이 많은 글에서는 격차가 줄어듭니다. 표본별 이동거리입니다.</p>
  <div class="table-scroll"><table>
    <caption>표본별 이동거리와 타건 수</caption>
    <thead><tr><th scope="col">표본</th><th scope="col">한글</th>${D.ORDER.map((id) =>
      `<th scope="col">${esc(D.LAYOUTS[id].short)}</th>`).join("")}<th scope="col">최종 − 두벌식</th></tr></thead>
    <tbody>${rows.map((r) => {
      const g2 = (r.a.results[2].mm - r.a.results[0].mm) / r.a.results[0].mm * 100;
      return `<tr><th scope="row">${esc(r.name)}</th><td class="num">${nf(r.a.text.syllables)}자</td>` +
        r.a.results.map((x) => `<td class="num">${distStr(x.mm)}<br><span class="tiny">타건 ${nf(x.totalStrokes)}</span></td>`).join("") +
        `<td class="num" style="color:var(--accent);font-weight:700">${g2 >= 0 ? "+" : ""}${nf(g2, 0)}%</td></tr>`;
    }).join("")}</tbody>
  </table></div>
  <p class="small">표본은 다섯 종류의 짧은 글입니다. 대규모 말뭉치 통계가 아니라는 점을 밝혀 둡니다.
    <a href="./">직접 쓰신 글로 다시 재 보시는 편</a>이 훨씬 정확합니다.</p>

  <h2>390과 최종은 뭐가 다른가</h2>
  <p>둘은 생각보다 가깝습니다. 배열 데이터를 직접 대조하면
    <strong>초성 19개는 완전히 같고, 중성은 ㅒ 한 자리만 다릅니다.</strong>
    실제 차이는 받침 27자리 중 12자리에 몰려 있습니다 — 아래가 그 전부입니다.</p>
  <div class="table-scroll"><table>
    <caption>세벌식 390과 세벌식 최종이 다른 자리 ${diffs.length}곳 (전체 67자모 중)</caption>
    <thead><tr><th scope="col">자모</th><th scope="col">종류</th>
      <th scope="col">390</th><th scope="col">최종</th></tr></thead>
    <tbody>${diffs.map((d) => `<tr><th scope="row" style="font-size:1.35rem;font-weight:700">${esc(d.jamo)}</th><td>${d.ko}</td>
      <td>${keyOrNone(d.a)}</td><td>${keyOrNone(d.b)}</td></tr>`).join("")}</tbody>
  </table></div>
  <p>정리하면 <strong>최종은 겹받침 여섯 개(ㄳ ㄵ ㄼ ㄽ ㄾ ㄿ)에 전용 키를 주고, 그 대가로 그 키들을
    시프트 자리에 넣었습니다.</strong> 받침이 많은 글에서는 타건이 줄고, 그만큼 시프트가 늘어납니다.</p>

  <h2>그래서 어느 쪽인가</h2>
  <ul class="findings">
    <li data-mark="1"><span><strong>손이 적게 움직이길 원한다면 두벌식.</strong>
      한글을 칠 때 숫자행을 전혀 쓰지 않는 구조라 이동거리가 짧습니다.
      손 교대율도 ${nf(d0.altPct, 1)}%로 가장 높습니다 — 자음은 왼손, 모음은 오른손이기 때문입니다.</span></li>
    <li data-mark="2"><span><strong>손가락이 덜 꼬이길 원한다면 세벌식.</strong>
      같은 손가락이 연달아 걸리는 비율이 ${nf(d0.sfbPct, 2)}% → ${nf(total.results[1].sfbPct, 2)}%로 떨어지고,
      시프트도 ${nf(d0.shifts)}회 → ${nf(total.results[1].shifts)}회로 줄어듭니다.
      타자 속도는 거리보다 이쪽에 더 좌우된다고 보는 사람이 많습니다.</span></li>
    <li data-mark="3"><span><strong>받침이 많은 글을 많이 쓴다면 최종.</strong>
      받침 27개가 전부 전용 키라 타건 수가 가장 적습니다. 대신 시프트를 가장 많이 씁니다.</span></li>
    <li data-mark="4"><span><strong>기호를 자주 친다면 390.</strong>
      기호 자리가 쿼티에 더 가깝게 남아 있습니다. 한글 배열은 최종과 거의 같습니다.</span></li>
    <li data-mark="5"><span><strong>바꾸지 않기로 해도 손해는 없습니다.</strong>
      이 표의 차이는 몇 퍼센트에서 몇십 퍼센트 사이이고, 자판을 새로 익히는 비용은 수십 시간입니다.
      숫자를 보고 판단하시라고 만든 페이지지, 바꾸라고 만든 페이지가 아닙니다.</span></li>
  </ul>

  <p style="margin-top:1.4rem"><a class="btn btn-primary btn-lg" href="./">내가 쓴 글로 직접 재 보기</a></p>
  <p class="small">계산 방법과 한계는 <a href="./#method">계산 방법과 출처</a>에 전부 적어 두었습니다.
    자판 배열 데이터는 <a href="https://github.com/libhangul/libhangul" rel="noopener">libhangul</a>
    원본에서 기계로 추출했습니다.</p>
</div></section>`;

  writeFileSync(join(ROOT, "compare.html"), shell({
    title: "두벌식 vs 세벌식 — 손가락 이동거리·타건 수 숫자 비교",
    desc: `두벌식과 세벌식 390·최종을 같은 글로 재 비교했습니다. 이동거리, 타건 수, 시프트, 같은 손가락 연속을 실제 계산값으로 보여 주고, 390과 최종이 다른 ${diffs.length}자리를 전부 표로 정리했습니다.`,
    canonical: abs("compare.html"),
    body
  }));
  console.log("wrote compare.html (390↔최종 차이", diffs.length, "자리)");
}

/* ------------------------------------------------ 소개 · 개인정보처리방침 */

const ADS_ON = !!(CFG.adsenseClient || CFG.coupangPartnerId);
const ISSUES = (CFG.repoUrl || "").replace(/\/*$/, "") + "/issues";
const contact = CFG.contactEmail
  ? `<a href="mailto:${esc(CFG.contactEmail)}">${esc(CFG.contactEmail)}</a>`
  : `<a href="${esc(ISSUES)}" rel="noopener">GitHub 이슈</a>`;
const owner = CFG.ownerName ? esc(CFG.ownerName) : "본 사이트 운영자";
const policyDate = CFG.policyDate ? esc(CFG.policyDate) : "사이트 공개일";

if (ADS_ON && !CFG.contactEmail) {
  console.warn("경고: 광고를 켰는데 assets/config.js 의 contactEmail 이 비어 있습니다.\n" +
               "      개인정보 보호법 제30조는 보호책임자 연락처 기재를 요구하고,\n" +
               "      애드센스 심사도 문의 수단을 확인합니다. 이메일을 채우세요.");
}

const about = `
<section><div class="wrap" style="max-width:44rem">
  <h1>이 도구에 대하여</h1>
  <p class="lede">손가락 마일리지는 내가 쓴 한글을 두벌식·세벌식 자판의 실제 타건열로 펼쳐,
    손가락이 움직인 거리를 재 주는 계산기입니다.</p>

  <h2>왜 만들었나</h2>
  <p>“세벌식이 더 편하다”는 이야기는 오래됐지만, 정작 <strong>얼마나</strong> 편한지를 숫자로
    보여 주는 한국어 도구는 찾기 어려웠습니다. 영문 자판에는 배열 비교 분석기가 여럿 있는데,
    그 도구들은 한 글자가 한 타건이라는 전제로 만들어져 있어 한 음절이 두세 번의 타건으로
    풀리는 한글에는 쓸 수 없습니다.</p>
  <p>그래서 한글 음절을 초성·중성·종성으로 풀고, 각 자모를 자판표에 따라 실제 키로 옮긴 다음,
    손가락이 그 키들을 오가며 움직인 거리를 재는 계산기를 만들었습니다. 재 보니
    <strong>통념과 반대되는 결과</strong>가 나왔습니다. 세벌식은 타건 수도 시프트도 적지만
    이동거리는 오히려 깁니다. 자모를 숫자행까지 펼쳐 놓았기 때문입니다.</p>

  <h2>어떻게 계산하나</h2>
  <p>자판 배열 데이터는 <a href="https://github.com/libhangul/libhangul" rel="noopener">libhangul</a>
    원본 소스에서 기계로 추출했습니다. 사람이 배열도를 보고 옮겨 적은 값은 하나도 없습니다.
    배열도를 눈으로 베끼다 키 하나를 틀리면 이런 도구는 통째로 신뢰를 잃기 때문입니다.
    자동 검증이 저장소에 붙어 있어, 코드를 고칠 때마다 원본과 대조합니다.</p>
  <p>계산 과정과 이 도구가 하지 못하는 일은
    <a href="./#method">계산 방법과 출처</a>에 전부 적어 두었습니다.
    브라우저에서 직접 돌려 볼 수 있는 <a href="test.html">자가 검증 페이지</a>도 있습니다.</p>

  <h2>개인정보</h2>
  <p>이 사이트에는 서버가 없습니다. 붙여 넣은 글과 불러온 카카오톡 파일은 브라우저 안에서만
    읽고 계산하며, 외부로 보내는 코드 자체가 들어 있지 않습니다. 자세한 내용은
    <a href="privacy.html">개인정보처리방침</a>을 보세요.</p>

  <h2>만든 사람과 문의</h2>
  <p>${owner}가 만들었습니다. 자판 데이터의 오류 제보, 기능 제안, 그 밖의 문의는
    ${contact}로 보내 주세요. 특히 <strong>배열이 틀렸다</strong>는 제보는 출처와 함께
    주시면 가장 빨리 반영됩니다.</p>
  <p class="small">소스 코드는 <a href="${esc(CFG.repoUrl || "")}" rel="noopener">공개되어 있습니다</a> (MIT).</p>
</div></section>`;

writeFileSync(join(ROOT, "about.html"), shell({
  title: "소개 — 손가락 마일리지",
  desc: "손가락 마일리지는 한글 자판의 손가락 이동거리를 재는 도구입니다. 왜 만들었고 어떻게 계산하는지 설명합니다.",
  canonical: abs("about.html"),
  body: about
}));
console.log("wrote about.html");

/* 광고를 켜지 않으면 수집하는 개인정보가 GitHub 접속 로그뿐이므로 방침도 그만큼만 쓴다.
   광고를 켜면 쿠키·제3자 제공·국외 이전 조항이 자동으로 들어간다. */
const art = (n, title, body) => `<h2>제${n}조 (${title})</h2>${body}`;

const privacy = `
<section><div class="wrap" style="max-width:44rem">
  <h1>개인정보처리방침</h1>
  <p class="lede">「손가락 마일리지」(이하 “본 사이트”)는 「개인정보 보호법」 제30조에 따라
    다음과 같이 개인정보처리방침을 수립·공개합니다.</p>
  ${ADS_ON ? "" : `<p class="privacy-note">이 사이트는 현재 <strong>광고와 분석 도구를 사용하지 않습니다.</strong>
    그래서 수집되는 정보가 웹사이트 호스팅 과정의 접속 기록뿐이고, 이 방침도 그만큼만 짧습니다.</p>`}

  ${art(0, "가장 중요한 원칙 — 이용자가 넣은 내용", `
    <p>본 사이트의 분석 기능은 전적으로 이용자의 웹브라우저 안에서만 동작합니다.
      이용자가 입력하거나 불러온 텍스트·대화 기록·파일의 내용은 <strong>어떠한 경우에도
      서버 또는 제3자에게 전송되지 않으며, 저장되지 않습니다.</strong>
      본 사이트는 이용자의 입력 내용을 수집·보관할 수 있는 서버 및 데이터베이스를
      보유하고 있지 않습니다. 브라우저 창을 닫으면 입력 내용은 소멸합니다.</p>
    <p class="small">브라우저 개발자 도구의 네트워크 탭을 열어 둔 채 파일을 넣어 보시면
      직접 확인하실 수 있습니다. 소스 코드도 전부 공개되어 있습니다.</p>`)}

  ${art(1, "개인정보의 처리 목적", `<ol>
    <li>웹사이트의 안정적 제공</li>
    ${ADS_ON ? "<li>광고의 게재 및 광고 성과 측정</li><li>접속 통계 분석 및 서비스 개선</li>" : ""}
  </ol>`)}

  ${art(2, "처리하는 개인정보의 항목", `
    <p>본 사이트는 회원가입 절차가 없으며, 이름·이메일·연락처 등 개인정보를 직접 수집하지 않습니다.
      다만 서비스 이용 과정에서 아래 정보가 자동으로 생성·수집될 수 있습니다.</p>
    <ul>
      <li><strong>웹사이트 호스팅 과정</strong>: 접속 IP 주소, 접속 일시, 브라우저·운영체제 종류
        (수집 주체: GitHub, Inc. — 제${ADS_ON ? 5 : 4}조 참조)</li>
      ${ADS_ON ? `<li><strong>광고 게재 과정</strong>: 쿠키, 광고 식별자, IP 주소, 접속 경로,
        서비스 이용 기록 (수집 주체: 제5조의 사업자)</li>` : ""}
    </ul>
    <p>이용자가 분석을 위해 입력하거나 불러온 <strong>텍스트·대화 기록·파일의 내용은
      수집 항목에 포함되지 않습니다</strong>(제0조).</p>`)}

  ${art(3, "개인정보의 처리 및 보유 기간, 파기", `
    <p>본 사이트는 개인정보를 저장하는 서버를 운영하지 않으므로 자동 수집 정보를 직접 보유하거나
      파기할 대상이 없습니다. 제${ADS_ON ? 5 : 4}조의 사업자가 보유하는 정보의 기간은 각 사업자의
      개인정보처리방침에 따릅니다.</p>
    <p>이용자의 브라우저에 저장되는 값은 이용자가 직접 삭제하기 전까지 이용자의 기기에만
      보관되며, 본 사이트는 이에 접근하거나 외부로 전송하지 않습니다.</p>`)}

  ${art(ADS_ON ? 4 : 4, "브라우저에 저장되는 값과 그 거부 방법", `
    <p>본 사이트가 이용자의 기기에 남기는 값은 다음뿐입니다. 어느 것도 기기를 떠나지 않습니다.</p>
    <ul>
      <li><code>km.theme</code> — 밝은 화면 / 어두운 화면 선택</li>
      <li><code>km.unlock</code> — 고해상도 내려받기 잠금 해제 여부 (해당 기능을 이용한 경우에만)</li>
    </ul>
    <p>대화 파일의 내용이나 참여자 이름은 저장하지 않으며, 주소창 링크에도 담기지 않습니다.</p>
    <p>브라우저 설정에서 사이트 데이터를 삭제하거나 저장을 거부할 수 있습니다. 거부하면
      화면 설정이 기억되지 않을 뿐, 계산 기능은 그대로 동작합니다.</p>
    ${ADS_ON ? `
    <h3>광고 쿠키와 맞춤형 광고 거부</h3>
    <p>제5조의 사업자가 광고 게재를 위해 쿠키를 설치할 수 있습니다. 이용자는 다음 방법으로
      거부할 수 있습니다.</p>
    <ul>
      <li>브라우저 설정에서 쿠키 차단 (Chrome: 설정 → 개인 정보 보호 및 보안 → 서드 파티 쿠키 /
        Safari: 설정 → 개인 정보 보호 / Firefox: 설정 → 개인 정보 및 보안)</li>
      <li>Google 광고 설정에서 개인 맞춤 광고 끄기 —
        <a href="https://adssettings.google.com/" rel="noopener">adssettings.google.com</a></li>
      <li>참여 사업자 일괄 거부 —
        <a href="https://www.youronlinechoices.com/kr/" rel="noopener">youronlinechoices.com/kr</a></li>
      <li>브라우저의 시크릿 모드 이용</li>
    </ul>` : ""}`)}

  ${ADS_ON ? art(5, "개인정보의 제3자 제공 및 국외 이전", `
    <p>본 사이트는 아래 사업자의 서비스를 이용하며, 이 과정에서 제2조의 자동 수집 정보가
      해당 사업자에게 전달되어 <strong>국외(미국)에서 처리될 수 있습니다.</strong></p>
    <div class="table-scroll"><table>
      <caption>제3자 제공 및 국외 이전 현황</caption>
      <thead><tr><th scope="col">구분</th><th scope="col">이전받는 자 · 국가</th>
        <th scope="col">항목 · 목적</th><th scope="col">보유 기간 · 방침</th></tr></thead>
      <tbody>
        ${CFG.adsenseClient ? `<tr><th scope="row">광고 게재</th><td>Google LLC · 미국</td>
          <td>쿠키, 광고 식별자, IP 주소, 브라우저 정보, 접속 기록 / 광고 게재 및 성과 측정</td>
          <td>Google 방침에 따름 · <a href="https://policies.google.com/privacy?hl=ko" rel="noopener">방침</a>,
            <a href="https://policies.google.com/technologies/partner-sites?hl=ko" rel="noopener">파트너 사이트 데이터 사용</a></td></tr>` : ""}
        ${CFG.coupangPartnerId ? `<tr><th scope="row">제휴 링크</th><td>쿠팡 주식회사 · 대한민국</td>
          <td>링크 클릭 시 전달되는 접속 정보 / 제휴 성과 측정</td>
          <td>쿠팡 방침에 따름</td></tr>` : ""}
        <tr><th scope="row">웹사이트 호스팅</th><td>GitHub, Inc. · 미국</td>
          <td>접속 IP 주소, 접속 일시, 브라우저 정보 / 정적 웹사이트 전송</td>
          <td>GitHub 방침에 따름 ·
            <a href="https://docs.github.com/ko/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">방침</a></td></tr>
      </tbody></table></div>
    <p>이용자는 위 국외 이전을 거부할 권리가 있으며, 거부를 원하는 경우 제4조의 방법으로
      쿠키를 차단하거나 본 사이트 이용을 중단할 수 있습니다. 이전 시점은 이용자가 본 사이트에
      접속하는 시점이며, 네트워크를 통해 전송됩니다.</p>`)
    : art(4 + 1, "웹사이트 호스팅", `
    <p>이 사이트는 GitHub Pages로 제공됩니다. 웹사이트를 전송하는 과정에서 GitHub, Inc.(미국)이
      접속 로그(IP 주소, 접속 일시, 브라우저 정보)를 수집할 수 있으며, 이는 본 사이트가 접근하거나
      통제할 수 없는 영역입니다.
      <a href="https://docs.github.com/ko/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">GitHub 개인정보처리방침</a></p>
    <p>본 사이트는 광고·분석 도구를 사용하지 않으므로 그 밖의 제3자 제공은 없습니다.</p>`)}

  ${art(6, "정보주체의 권리와 행사 방법", `
    <p>이용자는 언제든지 개인정보의 열람·정정·삭제·처리정지를 요구할 수 있습니다.
      다만 본 사이트는 이용자를 식별할 수 있는 정보를 직접 보유하지 않으므로 개별 이용자에 대한
      열람·정정에 응하지 못할 수 있으며, 이 경우 그 사유를 알려 드립니다.</p>
    <p>제${ADS_ON ? 5 : 5}조의 사업자가 처리하는 정보에 대해서는 해당 사업자에게 직접 권리를 행사하실 수 있습니다.
      Google에 대해서는 <a href="https://myaccount.google.com/" rel="noopener">내 Google 계정</a>에서
      데이터 관리·삭제가 가능합니다.</p>
    <p>권리 행사는 제8조의 연락처로 하실 수 있습니다.</p>`)}

  ${art(7, "개인정보의 안전성 확보 조치", `<ol>
    <li>개인정보를 수집·저장하는 서버 및 데이터베이스를 운영하지 않음 (수집 최소화)</li>
    <li>이용자의 입력 내용을 네트워크로 전송하지 않는 클라이언트 사이드 전용 설계</li>
    <li>HTTPS(TLS)를 통한 전 구간 암호화 전송</li>
    <li>개인정보 취급자의 최소화</li>
  </ol>`)}

  ${art(8, "개인정보 보호책임자 및 열람청구 접수", `
    <p>개인정보 처리에 관한 업무를 총괄하고 정보주체의 불만 처리 및 피해 구제를 담당합니다.</p>
    <ul>
      <li>책임자: ${owner}</li>
      <li>연락처: ${contact}</li>
    </ul>`)}

  ${art(9, "만 14세 미만 아동의 개인정보", `
    <p>본 사이트는 만 14세 미만 아동의 개인정보를 수집하지 않으며, 회원가입 등 개인정보를
      직접 입력받는 절차를 두고 있지 않습니다.</p>`)}

  ${art(10, "권익침해 구제 방법", `
    <p>개인정보 침해로 인한 구제를 받기 위하여 아래 기관에 분쟁 해결이나 상담을 신청하실 수 있습니다.</p>
    <ul>
      <li>개인정보 침해신고센터 (한국인터넷진흥원) · 국번없이 118 ·
        <a href="https://privacy.kisa.or.kr" rel="noopener">privacy.kisa.or.kr</a></li>
      <li>개인정보 분쟁조정위원회 · 1833-6972 ·
        <a href="https://www.kopico.go.kr" rel="noopener">kopico.go.kr</a></li>
      <li>대검찰청 사이버수사과 · 국번없이 1301</li>
      <li>경찰청 사이버수사국 · 국번없이 182 ·
        <a href="https://ecrm.police.go.kr" rel="noopener">ecrm.police.go.kr</a></li>
    </ul>`)}

  ${art(11, "방침의 변경", `
    <p>이 개인정보처리방침은 ${policyDate}부터 적용됩니다. 법령·정책 또는 보안기술의 변경에 따라
      내용의 추가·삭제 및 수정이 있을 경우에는 시행 7일 전부터 이 페이지를 통해 변경 이유와
      내용을 알려 드리겠습니다.</p>`)}
</div></section>`;

writeFileSync(join(ROOT, "privacy.html"), shell({
  title: "개인정보처리방침 — 손가락 마일리지",
  desc: "손가락 마일리지는 서버가 없는 정적 사이트로, 이용자가 넣은 글과 파일을 외부로 전송하지 않습니다.",
  canonical: abs("privacy.html"),
  body: privacy
}));
console.log(`wrote privacy.html (광고 ${ADS_ON ? "켜짐 — 쿠키·제3자·국외이전 조항 포함" : "꺼짐 — 축약본"})`);

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
  writeFileSync(join(ROOT, "robots.txt"),
    `User-agent: *\nAllow: /\nDisallow: /content/\nDisallow: /tools/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log("wrote sitemap.xml, robots.txt");
} else {
  // 주소를 모르는 채로 가짜 sitemap 을 올리면 색인에 해가 된다.
  writeFileSync(join(ROOT, "robots.txt"),
    `User-agent: *\nAllow: /\nDisallow: /content/\nDisallow: /tools/\n\n` +
    `# assets/config.js 의 siteUrl 을 채우고 tools/build-pages.mjs 를 다시 돌리면\n` +
    `# sitemap.xml 이 생성되고 이 파일에 주소가 들어갑니다.\n`);
  try { unlinkSync(join(ROOT, "sitemap.xml")); } catch {}
  console.log("siteUrl 이 비어 있어 sitemap 은 만들지 않았습니다 (robots.txt 만 갱신)");
}

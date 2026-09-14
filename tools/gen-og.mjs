/* OG 이미지 생성 — node tools/gen-og.mjs
 * 실제 엔진으로 계산한 값을 넣어 만든다. 브라우저(Chromium)로 렌더해 og.png 로 저장. */
import { createRequire } from "node:module";
import { writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
require("../assets/layouts.js");
require("../assets/engine.js");
const D = globalThis.KM_DATA, E = globalThis.KM_ENGINE;

const DEMO =
  "안녕하세요 오늘 날씨가 참 좋네요 밖에 나가서 산책이라도 할까요 값싼 물건도 많이 샀어요\n" +
  "읽던 책을 다시 펼쳤다 ㅋㅋㅋ ㅠㅠ 넓은 하늘 아래 우리는 웃었다 의사 선생님께 여쭤봤어요";
const a = E.analyze(DEMO);
const nf = (n, d = 0) => n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const ds = (mm) => mm < 1000 ? nf(mm, 1) + "㎜" : mm < 1e6 ? nf(mm / 1000, 2) + "m" : nf(mm / 1e6, 2) + "km";
const max = Math.max(...a.results.map((r) => r.mm));

const html = `<!doctype html><meta charset="utf-8">
<style>
 @page{size:1200px 630px}
 *{box-sizing:border-box;margin:0}
 body{width:1200px;height:630px;background:#f7f4ee;color:#16161a;overflow:hidden;word-break:keep-all;
      font-family:"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Noto Sans CJK KR",system-ui,sans-serif}
 .bar-top{height:12px;background:#b03a12}
 .pad{padding:44px 64px}
 .eye{font-size:24px;font-weight:700;letter-spacing:.12em;color:#8a8780;text-transform:uppercase}
 h1{font-size:66px;line-height:1.14;letter-spacing:-.03em;margin:14px 0 6px;max-width:17ch}
 h1 em{font-style:normal;color:#b03a12}
 .sub{font-size:26px;color:#4a4a52;margin-top:18px;max-width:15.5ch;line-height:1.55}
 .kbd{position:absolute;left:64px;bottom:118px;display:flex;gap:7px}
 .kbd i{width:44px;height:44px;border-radius:7px;background:#e6e0d4;display:block}
 .panel{position:absolute;right:64px;top:120px;width:410px}
 .row{display:flex;align-items:center;gap:14px;margin-bottom:18px}
 .nm{width:78px;font-size:23px;font-weight:700;text-align:right}
 .tk{flex:1;height:30px;background:#e6e0d4;border-radius:5px;overflow:hidden}
 .fl{height:100%}
 .vl{width:92px;font-size:22px;color:#4a4a52;font-variant-numeric:tabular-nums}
 .foot{position:absolute;left:64px;right:64px;bottom:40px;display:flex;justify-content:space-between;
       align-items:baseline;font-size:22px;color:#6f6f79;border-top:1px solid #ded7c9;padding-top:18px}
 .foot b{color:#16161a;font-size:24px}
</style>
<div class="bar-top"></div>
<div class="pad">
  <div class="eye">한글 자판 이동거리 계산기</div>
  <h1>내 손가락은 오늘<br><em>몇 미터</em> 걸었을까</h1>
  <div class="sub">두벌식과 세벌식, 정말 얼마나 다를까</div>
</div>
<div class="kbd">${[.18, .42, 1, .62, .3, .8, .22, .5, .95, .34]
  .map((t) => `<i style="background:hsl(205 72% ${(96 - 56 * Math.pow(t, 0.6)).toFixed(1)}%)"></i>`).join("")}</div>
<div class="panel">
  ${a.results.map((r, i) => `<div class="row">
    <div class="nm">${r.layout.short}</div>
    <div class="tk"><div class="fl" style="width:${(r.mm / max * 100).toFixed(1)}%;background:${i === 0 ? "#b03a12" : "#14507f"}"></div></div>
    <div class="vl">${ds(r.mm)}</div></div>`).join("")}
  <div style="font-size:19px;color:#8a8780;text-align:right;margin-top:-4px">예시문 ${nf(a.text.syllables)}자 기준</div>
</div>
<div class="foot"><span>브라우저 안에서만 계산합니다 · 업로드 없음</span><b>손가락 마일리지</b></div>`;

const tmp = join(ROOT, ".og-tmp.html");
writeFileSync(tmp, html);
const { chromium } = (await import("/opt/node22/lib/node_modules/playwright/index.js")).default;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.goto("file://" + tmp, { waitUntil: "load" });
await p.waitForTimeout(300);
await p.screenshot({ path: join(ROOT, "og.png") });
await b.close();
unlinkSync(tmp);
console.log("wrote og.png");

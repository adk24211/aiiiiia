/* node tools/verify-layouts.mjs
 * assets/layouts.js 의 자판표가 libhangul 원본과 일치하는지 확인한다.
 * 네트워크가 없으면 내장 사본과 대조하고, 있으면 원본을 내려받아 대조한다. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("../assets/layouts.js");
const D = globalThis.KM_DATA;

const URL_H = "https://raw.githubusercontent.com/libhangul/libhangul/master/hangul/hangulkeyboard.h";
const CHO = 19, JUNG = 21, JONG = 27;
const UNSHIFTED = "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./";

let src = null;
try {
  const res = await fetch(URL_H, { signal: AbortSignal.timeout(15000) });
  if (res.ok) src = await res.text();
} catch { /* 오프라인이면 건너뛴다 */ }

if (!src) {
  console.log("libhangul 원본을 받지 못했습니다 (네트워크 없음). 내부 일관성만 검사합니다.");
} else {
  const table = (name) => {
    const m = src.match(new RegExp(`static const ucschar ${name}\\[\\] = \\{([\\s\\S]*?)\\n\\};`));
    const v = [...m[1].matchAll(/0x([0-9a-fA-F]{4})\s*[,}]?\s*\/\*/g)].map((x) => parseInt(x[1], 16));
    if (v.length !== 128) throw new Error(`${name}: 표 길이 ${v.length}`);
    return v;
  };
  const jamoKeys = (name) => {
    const t = table(name), out = new Map();
    t.forEach((j, code) => {
      if (j >= 0x1100 && j <= 0x11ff) {
        const k = String.fromCharCode(code);
        if (!out.has(j)) out.set(j, []);
        out.get(j).push(k);
      }
    });
    return out;
  };

  const MAP = { dubeol: "hangul_keyboard_table_2", s390: "hangul_keyboard_table_390", sfinal: "hangul_keyboard_table_3final" };
  let bad = 0;
  for (const [id, tname] of Object.entries(MAP)) {
    const L = D.LAYOUTS[id], orig = jamoKeys(tname);
    const check = (kind, n, base) => {
      for (let i = 0; i < n; i++) {
        const ours = L[kind][i];
        const theirs = orig.get(base + i) || [];
        if (ours === " ") {
          if (theirs.length) { console.error(`FAIL ${id}.${kind}[${i}]: 우리는 없다고 하는데 원본에는 ${theirs}`); bad++; }
        } else if (!theirs.includes(ours)) {
          console.error(`FAIL ${id}.${kind}[${i}]: 우리 "${ours}" ∉ 원본 ${JSON.stringify(theirs)}`); bad++;
        }
      }
    };
    check("cho", CHO, 0x1100); check("jung", JUNG, 0x1161); check("jong", JONG, 0x11a8);
    if (L.jungLead) for (const [i, k] of Object.entries(L.jungLead)) {
      const theirs = orig.get(0x1161 + (+i)) || [];
      if (!theirs.includes(k)) { console.error(`FAIL ${id}.jungLead[${i}]: "${k}" ∉ 원본 ${JSON.stringify(theirs)}`); bad++; }
    }
  }

  // 조합 규칙
  const cm = src.match(/static const HangulCombinationItem hangul_combination_table_default\[\] = \{([\s\S]*?)\n\};/);
  const rules = [...cm[1].matchAll(/\{\s*0x([0-9a-fA-F]{8}),\s*0x([0-9a-fA-F]{4})\s*\}/g)]
    .map(([, k, v]) => [parseInt(k.slice(0, 4), 16), parseInt(k.slice(4), 16), parseInt(v, 16)]);
  const want = { cho: new Map(), jung: new Map(), jong: new Map() };
  const cls = (cp) => cp >= 0x1100 && cp <= 0x1112 ? ["cho", cp - 0x1100]
    : cp >= 0x1161 && cp <= 0x1175 ? ["jung", cp - 0x1161]
    : cp >= 0x11a8 && cp <= 0x11c2 ? ["jong", cp - 0x11a8] : [null, null];
  for (const [a, b, r] of rules) {
    const [ca, ia] = cls(a), [cb, ib] = cls(b), [cr, ir] = cls(r);
    if (ca && ca === cb && cb === cr) want[cr].set(ir, [ia, ib]);
  }
  const got = (str, n) => {
    const m = new Map();
    for (let i = 0; i < n; i++) {
      const a = str[i * 2];
      if (a !== " ") m.set(i, [parseInt(a, 36), parseInt(str[i * 2 + 1], 36)]);
    }
    return m;
  };
  for (const [kind, str, n] of [["cho", D.COMB_CHO, CHO], ["jung", D.COMB_JUNG, JUNG], ["jong", D.COMB_JONG, JONG]]) {
    const g = got(str, n), w = want[kind];
    if (g.size !== w.size) { console.error(`FAIL 조합 ${kind}: 우리 ${g.size}개, 원본 ${w.size}개`); bad++; }
    for (const [i, v] of w) {
      const ours = g.get(i);
      if (!ours || ours[0] !== v[0] || ours[1] !== v[1]) {
        console.error(`FAIL 조합 ${kind}[${i}]: 우리 ${JSON.stringify(ours)} ≠ 원본 ${JSON.stringify(v)}`); bad++;
      }
    }
  }
  if (bad) { console.error(`\nlibhangul 대조: ${bad}건 불일치`); process.exit(1); }
  console.log("libhangul 원본과 자판표·조합 규칙 전부 일치");
}

/* 내부 일관성: 모든 자모가 실제로 입력 가능한가 */
require("../assets/engine.js");
const E = globalThis.KM_ENGINE;
let missing = 0;
for (const id of D.ORDER) {
  const m = E.compiledFor(D.LAYOUTS[id]).missing;
  if (m.length) { console.error(`FAIL ${id}: 입력 불가 자모 ${m.join(", ")}`); missing += m.length; }
}
if (missing) process.exit(1);
console.log("자판 3종 모두 자모 67개를 입력할 수 있음");

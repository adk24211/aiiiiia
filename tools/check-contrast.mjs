/* node tools/check-contrast.mjs — 팔레트의 WCAG 대비를 실제로 계산해 검증한다.
 * CI에서 돌리므로 색을 잘못 바꾸면 빌드가 깨진다. */
const hsl2rgb = (h, s, l) => { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)); };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
const lum = (rgb) => { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

let fail = 0;
const need = (name, got, min) => {
  const ok = got >= min - 0.005;
  if (!ok) { console.error(`FAIL ${name}: ${got.toFixed(2)}:1 (필요 ${min}:1)`); fail++; }
  return ok;
};

/* 1) 히트맵: 어느 값에서도 칸 위 숫자가 4.5:1 이상인가 */
const SPLIT = 0.62;
const heat = (t, dark) => dark
  ? { fill: hsl2rgb(205, 62, t <= SPLIT ? 15 + 22 * (t / SPLIT) ** 0.75 : 47 + 19 * ((t - SPLIT) / (1 - SPLIT))),
      ink: hex(t <= SPLIT ? "#eaf0f6" : "#0a0f14") }
  : { fill: hsl2rgb(205, 72, t <= SPLIT ? 96 - 46 * (t / SPLIT) ** 0.75 : 42 - 12 * ((t - SPLIT) / (1 - SPLIT))),
      ink: hex(t <= SPLIT ? "#0d1218" : "#ffffff") };
for (const dark of [false, true]) {
  let worst = 99, at = 0;
  for (let i = 0; i <= 500; i++) { const t = i / 500, h = heat(t, dark), r = cr(h.fill, h.ink);
    if (r < worst) { worst = r; at = t; } }
  need(`히트맵 숫자 대비 (${dark ? "어두운" : "밝은"} 모드, t=${at.toFixed(2)})`, worst, 4.5);
  console.log(`  히트맵 ${dark ? "어두운" : "밝은"} 모드 최악 대비 ${worst.toFixed(2)}:1`);
}

/* 2) 팔레트: 본문 4.5:1, 상호작용 테두리 3:1 */
const L = { paper: "#f7f4ee", surface: "#fffdf9", s2: "#f0ebe1", ink: "#16161a", ink2: "#4a4a52",
            ink3: "#65656e", accent: "#b03a12", cool: "#14507f", good: "#16624a", line2: "#8a857c",
            tintCho: "#e6eff8", tintJung: "#fceade", tintJong: "#e6f2ea" };
const Dk = { paper: "#121216", surface: "#1a1a20", s2: "#24242c", ink: "#f2efe9", ink2: "#b9b6b0",
             ink3: "#918e89", accent: "#ff8a5c", cool: "#7fb8e8", good: "#62c6a3", line2: "#71717f",
             tintCho: "#132435", tintJung: "#331e15", tintJong: "#122922" };
for (const [mode, P] of [["밝은", L], ["어두운", Dk]]) {
  for (const bg of ["paper", "surface", "s2"])
    for (const fg of ["ink", "ink2", "ink3", "accent", "cool", "good"])
      need(`${mode} ${fg} on ${bg}`, cr(hex(P[bg]), hex(P[fg])), 4.5);
  for (const bg of ["paper", "surface", "s2"])
    need(`${mode} 테두리 line-2 on ${bg}`, cr(hex(P[bg]), hex(P.line2)), 3);
  for (const tint of ["tintCho", "tintJung", "tintJong"]) {
    need(`${mode} 배열도 ${tint} 위 본문`, cr(hex(P[tint]), hex(P.ink)), 4.5);
    need(`${mode} 배열도 ${tint} 위 보조글자`, cr(hex(P[tint]), hex(P.ink3)), 4.5);
  }
}
if (fail) { console.error(`\n대비 검사 ${fail}건 실패`); process.exit(1); }
console.log("팔레트 대비 검사 전부 통과 (본문 4.5:1, 테두리 3:1)");

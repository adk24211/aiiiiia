/* node tools/build-artifact.mjs — Artifact 미리보기용 빌드
 * Artifact 는 본문 파일을 <!doctype><head>…</head><body> 안에 감싸서 낸다.
 * 그래서 index.html 의 head 내용을 본문 맨 위로 옮긴 사본을 만든다.
 * 나머지 페이지와 자산은 그대로 함께 올린다. 원본은 건드리지 않는다. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || join(ROOT, ".artifact");
mkdirSync(OUT, { recursive: true });

const html = readFileSync(join(ROOT, "index.html"), "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];

// charset·viewport 는 Artifact 가 이미 넣어 준다. 나머지(title·meta·link·JSON-LD)는 살린다.
const keep = head
  .replace(/<meta charset="[^"]*">\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "")
  .trim();

writeFileSync(join(OUT, "index.html"), keep + "\n" + body);
console.log("wrote", join(OUT, "index.html"), `(${(keep.length + body.length) / 1024 | 0}KB)`);

/* node tools/make-codes.mjs [개수]
 * 고해상도 언락용 코드를 만든다. 코드 목록은 판매처(Gumroad 등)에 올리고,
 * 출력된 해시 배열만 assets/config.js 의 unlockHashes 에 붙여 넣는다.
 * 코드 원본은 사이트에 절대 넣지 않는다. */
import { randomBytes, createHash } from "node:crypto";

const n = Math.max(1, Math.min(5000, parseInt(process.argv[2] || "200", 10)));
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // 사람이 헷갈리는 O/0, I/1 제외
const codes = new Set();
while (codes.size < n) {
  const b = randomBytes(10);
  let s = "";
  for (let i = 0; i < 10; i++) s += ALPHABET[b[i] % ALPHABET.length];
  codes.add("KM-" + s.slice(0, 5) + "-" + s.slice(5));
}
const list = [...codes];
const hashes = list.map((c) => createHash("sha256").update(c + "keymiles").digest("hex").slice(0, 12));

console.log("── 구매자에게 나눠 줄 코드 (사이트에 넣지 마세요) ──");
console.log(list.join("\n"));
console.log("\n── assets/config.js 의 unlockHashes 에 붙여 넣을 값 ──");
console.log("unlockHashes: " + JSON.stringify(hashes) + ",");
console.log(`\n코드 ${n}개, 해시 ${JSON.stringify(hashes).length}바이트`);

/* node tools/test-engine.mjs — 브라우저 없이 같은 골든 벡터를 돌린다 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("../assets/layouts.js");
require("../assets/engine.js");
require("../assets/tests.js");
const r = globalThis.KM_TESTS.run();
for (const row of r.rows) if (!row.ok) console.error(`FAIL  ${row.name}\n      기대 ${row.want}\n      실제 ${row.got}`);
console.log(`${r.pass}/${r.rows.length} 통과${r.fail ? `, ${r.fail}건 실패` : ""}`);
process.exit(r.fail ? 1 : 0);

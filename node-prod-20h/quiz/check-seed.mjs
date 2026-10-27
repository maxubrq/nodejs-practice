// Chạy lại một bộ câu đã sinh trên runtime hiện tại và so với key.json (để kiểm chéo phiên bản hoặc máy).
//   node quiz/check-seed.mjs quiz/out/seed101 [RUNS=20]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const dir = process.argv[2],
  runs = Number(process.argv[3] || 20);
const key = JSON.parse(fs.readFileSync(path.join(dir, "key.json")));
let same = 0;
for (const [id, exp] of Object.entries(key.answers)) {
  const f = fs.readdirSync(dir).find((x) => x.startsWith(id + "."));
  const outs = new Set();
  for (let i = 0; i < runs; i++)
    outs.add(
      execFileSync(process.execPath, [path.join(dir, f)], {
        encoding: "utf8",
      }).trim(),
    );
  const ok = outs.size === 1 && outs.has(exp);
  if (ok) same++;
  else
    console.log(
      `${id}: khóa(${key.node})=${exp}  ${process.version}=${[...outs].join(" | ")}`,
    );
}
console.log(
  `${dir}: khớp ${same}/${Object.keys(key.answers).length} trên ${process.version} (${runs} lần mỗi câu)`,
);

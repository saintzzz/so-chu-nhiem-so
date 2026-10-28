// CR-061 coverage - ti le rut cau giua ngan hang truong va ngan hang
// he thong khi sinh de DC-03. Chay: node --test tests/cr061.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8").replaceAll(String.fromCharCode(13,10), String.fromCharCode(10));

const ROUTE = read("src/app/api/studio/tools/[code]/generate/route.ts");
const REG = read("src/lib/tvc/registry.ts");
const RUNNER = read("src/components/tvc/tool-runner.tsx");

test("AC-61.x: DC-03 co field bank_ratio voi 5 tuy chon ti le", () => {
  const dc03 = REG.split('code: "DC-03"')[1]?.split('code: "DC-04"')[0] ?? "";
  assert.match(dc03, /key: "bank_ratio"/);
  for (const v of ["0", "25", "50", "75", "100"]) {
    assert.match(dc03, new RegExp(`value: "${v}"`), `thieu option ${v}`);
  }
  assert.match(dc03, /default: "50"/);
});

test("AC-61.1 AC-61.2: route tach 2 nguon theo school_id, fetch cap rieng", () => {
  // r-h0601: 2 fetch rieng tren DB - bank he thong khong the an slot
  // cua bank truong
  assert.match(ROUTE, /\.is\("school_id", null\)/);
  assert.match(ROUTE, /\.eq\("school_id", mySchool\)/);
  assert.match(ROUTE, /bankSchool = bank\.filter\(/);
  assert.match(ROUTE, /x\.school_id && x\.school_id === mySchool/);
  assert.match(ROUTE, /bankSystem = bank\.filter\(\s*\(x\) => x\.school_id == null/);
  // validate gia tri ngoai whitelist -> 50
  assert.match(ROUTE, /\[0, 25, 50, 75, 100\]\.includes\(rawPct\) \? rawPct : 50/);
});

test("AC-61.3 AC-61.4: chia quota theo cell + cross-fill khi 1 nguon het", () => {
  // quota truong = round(count * pct/100), he thong = phan con lai
  assert.match(ROUTE, /Math\.round\(\(cell\.count \* schoolPct\) \/ 100\)/);
  // luot rut: school quota -> system -> school cross-fill
  assert.match(ROUTE, /schoolPool\.slice\(0, wantSchool\)/);
  assert.match(ROUTE, /sysPool,/);
  assert.match(ROUTE, /schoolPool\.slice\(wantSchool\)/);
});

test("AC-61.5: nguon tung cau hien trong bang dap an + response bankStats", () => {
  assert.match(ROUTE, /header: \["Phần", "Câu", "Mã câu hỏi", "Đáp án", "Điểm", "Nguồn"\]/);
  assert.match(ROUTE, /p\.src === "school" \? "Trường" : p\.src === "system" \? "Hệ thống"/);
  assert.match(ROUTE, /bankStats: \{/);
  assert.match(ROUTE, /realCT\.filter\(\(p\) => p\.src === "school"\)\.length/);
  assert.match(RUNNER, /data\.bankStats/);
  assert.match(RUNNER, /câu trường · \$\{bankStats\.system\} câu hệ thống/);
});

test("Question type co school_id (nullable - he thong)", () => {
  const T = read("src/types/tvc.ts");
  const q = T.split("interface Question")[1]?.split("}")[0] ?? "";
  assert.match(q, /school_id\?: string \| null/);
});

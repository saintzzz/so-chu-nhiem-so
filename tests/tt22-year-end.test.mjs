// CR-053: unit test xep loai cuoi nam TT22/2021 - AC-53.2.x
// Chay: node --test tests/tt22-year-end.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  hocLucYear,
  renLuyenYear,
  danhHieu,
  xetLenLop,
} = await import(
  pathToFileURL(join(ROOT, "src/lib/tt22.ts")).href
);

const scored = (arr) =>
  arr.map((x, i) => ({ subjectId: `s${i}`, dtmCn: x, yearFinal: true }));

// ---------- AC-53.2.1: hocLucYear bang D.9 + boundary + bump D.9.3 ----------

test("kqht: tat ca >=8, >=6 mon -> tot", () => {
  const r = hocLucYear(scored([9, 8.5, 8, 8.2, 9.1, 8.7, 7.5, 7]), ["dat"]);
  assert.equal(r.value, "tot");
  assert.equal(r.missing, null);
});

test("kqht: tot that bai vi 1 mon 6.4 (<6.5) -> kha neu con lai dat", () => {
  const r = hocLucYear(scored([9, 8.5, 8, 8.2, 9.1, 8.7, 7.5, 6.4]), ["dat"]);
  assert.equal(r.value, "kha");
});

test("kqht: kha can >=6 mon >=6.5 - chi 5 mon -> dat", () => {
  const r = hocLucYear(scored([8, 8, 8, 8, 8, 5.5, 5.5, 5.5]), ["dat"]);
  assert.equal(r.value, "dat");
});

test("kqht: 1 comment chua_dat nhung diem khong du muc cao -> dat (khong bump)", () => {
  // Diem 7.0: du co bo comment loi, phan con lai chi dat 'kha' (diff 1 <2)
  // va khong dat 'tot' -> khong thoa D.9.3 -> giu 'dat'.
  const r = hocLucYear(scored([7, 7, 7, 7, 7, 7, 7, 7]), ["dat", "chua_dat"]);
  assert.equal(r.value, "dat");
});

test("kqht: 1 mon <3.5 -> chua_dat", () => {
  // 2 mon loi (3.0 va 4.0) - bo 1 mon van khong dat 'kha' -> khong bump.
  const r = hocLucYear(scored([9, 9, 9, 9, 9, 9, 4.0, 3.0]), ["dat"]);
  assert.equal(r.value, "chua_dat");
});

test("kqht D.9.3 bump: 1 mon <3.5 keo xuong chua_dat, con lai tot -> dat", () => {
  // 9 mon: 8 mon >=8 (thoa tot) + 1 mon 3.0 -> base chua_dat, bo mon loi
  // thi con lai dat 'tot' (keo xuong 3 muc) -> nang 1 bac = dat.
  const r = hocLucYear(scored([9, 8.5, 8, 8.2, 9.1, 8.7, 8.3, 8, 3.0]), ["dat"]);
  assert.equal(r.value, "dat");
});

test("kqht D.9.3 bump qua mon nhan xet: 1 comment chua_dat, con lai tot -> kha", () => {
  // base 'dat' (1 comment CĐ). Bo comment do -> thoa 'tot' (diff 2) -> kha.
  const r = hocLucYear(scored([9, 8.5, 8, 8.2, 9.1, 8.7, 8.3, 8]), ["dat", "chua_dat"]);
  assert.equal(r.value, "kha");
});

test("kqht: 2 mon nhan xet chua_dat -> khong bump, chua_dat", () => {
  const r = hocLucYear(scored([9, 9, 9, 9, 9, 9, 9, 9]), ["chua_dat", "chua_dat"]);
  assert.equal(r.value, "chua_dat");
});

test("kqht: <6 mon tinh diem -> thieu_mon (truoc thieu_diem)", () => {
  const r = hocLucYear(scored([9, 8, 7]), []);
  assert.deepEqual(r, { value: null, missing: "thieu_mon" });
});

test("kqht: mon chua chot (yearFinal=false) -> thieu_diem", () => {
  const s = scored([9, 8, 8, 8, 8, 8, 8, 8]);
  s[0].yearFinal = false;
  const r = hocLucYear(s, ["dat"]);
  assert.deepEqual(r, { value: null, missing: "thieu_diem" });
});

test("kqht: comment 'missing' -> thieu_diem", () => {
  const r = hocLucYear(scored([9, 8, 8, 8, 8, 8, 8, 8]), ["missing"]);
  assert.deepEqual(r, { value: null, missing: "thieu_diem" });
});

test("kqht: it nhat 6 mon >=5 nhung 2 mon 4.x -> dat (khong du 6 mon >=5?)", () => {
  // 6 mon >=5, 2 mon <5 nhung >=3.5 -> 'dat' can >=6 mon >=5.0 VA khong mon <3.5
  const r = hocLucYear(scored([6, 6, 6, 6, 6, 5, 4.5, 4.0]), []);
  assert.equal(r.value, "dat");
});

// ---------- AC-53.2.2: renLuyenYear - 16 pair ----------

test("kqr l: full 16-pair table", () => {
  const T = {
    tot: { tot: "tot", kha: "tot", dat: "kha", chua_dat: "kha" },
    kha: { tot: "kha", kha: "kha", dat: "kha", chua_dat: "dat" },
    dat: { tot: "kha", kha: "dat", dat: "dat", chua_dat: "dat" },
    chua_dat: { tot: "chua_dat", kha: "chua_dat", dat: "chua_dat", chua_dat: "chua_dat" },
  };
  for (const hk2 of Object.keys(T)) {
    for (const hk1 of Object.keys(T[hk2])) {
      const r = renLuyenYear(hk1, hk2);
      assert.equal(r.value, T[hk2][hk1], `hk1=${hk1} hk2=${hk2}`);
      assert.equal(r.missing, null);
    }
  }
});

test("kqrl: thieu ky -> thieu_hanh_kiem", () => {
  assert.deepEqual(renLuyenYear(null, "tot"), { value: null, missing: "thieu_hanh_kiem" });
  assert.deepEqual(renLuyenYear("tot", null), { value: null, missing: "thieu_hanh_kiem" });
});

// ---------- AC-53.2.3: danhHieu ----------

test("danh hieu: tot+tot+6 mon >=9 -> xuat_sac", () => {
  assert.equal(danhHieu("tot", "tot", scored([9.5, 9.2, 9, 9.1, 9.3, 9.4, 8, 8])), "xuat_sac");
});

test("danh hieu: tot+tot nhung chi 5 mon >=9 -> gioi", () => {
  assert.equal(danhHieu("tot", "tot", scored([9.5, 9.2, 9, 9.1, 9.3, 8.9, 8, 8])), "gioi");
});

test("danh hieu: kha -> null", () => {
  assert.equal(danhHieu("kha", "tot", scored([9, 9, 9, 9, 9, 9, 9, 9])), null);
});

// ---------- AC-53.2.4: xetLenLop ----------

const promo = (o) => xetLenLop(o);

test("len lop: du lieu -> len_lop", () => {
  assert.deepEqual(promo({ stage: "initial", kqht: "tot", kqrl: "tot", absentSessions: 0, hasPriorRetest: false }),
    { value: "len_lop", missing: null });
});

test(">45 buoi vang -> o_lai ngay ca du lieu tot", () => {
  assert.equal(promo({ stage: "initial", kqht: "tot", kqrl: "tot", absentSessions: 46, hasPriorRetest: false }).value, "o_lai");
  assert.equal(promo({ stage: "initial", kqht: "tot", kqrl: "tot", absentSessions: 45, hasPriorRetest: false }).value, "len_lop");
});

test("kqrl chua_dat -> ren_luyen_he (truoc nhanh kqht)", () => {
  assert.equal(promo({ stage: "initial", kqht: "chua_dat", kqrl: "chua_dat", absentSessions: 0, hasPriorRetest: false }).value, "ren_luyen_he");
});

test("kqht chua_dat (kqrl ok) -> kiem_tra_danh_gia_lai", () => {
  assert.equal(promo({ stage: "initial", kqht: "chua_dat", kqrl: "kha", absentSessions: 0, hasPriorRetest: false }).value, "kiem_tra_danh_gia_lai");
});

test("after_summer: kqrl van chua_dat -> o_lai (khong ren he lan 2)", () => {
  assert.equal(promo({ stage: "after_summer", kqht: "dat", kqrl: "chua_dat", absentSessions: 0, hasPriorRetest: false }).value, "o_lai");
});

test("after_summer: kqrl dat + kqht chua_dat + chua retest -> kiem_tra_danh_gia_lai", () => {
  assert.equal(promo({ stage: "after_summer", kqht: "chua_dat", kqrl: "dat", absentSessions: 0, hasPriorRetest: false }).value, "kiem_tra_danh_gia_lai");
});

test("after_summer: kqrl dat + kqht chua_dat + da retest -> o_lai (at-most-once)", () => {
  assert.equal(promo({ stage: "after_summer", kqht: "chua_dat", kqrl: "dat", absentSessions: 0, hasPriorRetest: true }).value, "o_lai");
});

test("after_retest: kqht van chua_dat -> o_lai", () => {
  assert.equal(promo({ stage: "after_retest", kqht: "chua_dat", kqrl: "kha", absentSessions: 0, hasPriorRetest: true }).value, "o_lai");
});

test("after_retest: kqrl chua_dat -> o_lai", () => {
  assert.equal(promo({ stage: "after_retest", kqht: "kha", kqrl: "chua_dat", absentSessions: 0, hasPriorRetest: true }).value, "o_lai");
});

test("after_retest: du ca 2 -> len_lop", () => {
  assert.equal(promo({ stage: "after_retest", kqht: "kha", kqrl: "kha", absentSessions: 0, hasPriorRetest: true }).value, "len_lop");
});

test("thieu kqht/kqrl -> missing", () => {
  assert.deepEqual(promo({ stage: "initial", kqht: null, kqrl: "tot", absentSessions: 0, hasPriorRetest: false }), { value: null, missing: "thieu_diem" });
  assert.deepEqual(promo({ stage: "initial", kqht: "tot", kqrl: null, absentSessions: 0, hasPriorRetest: false }), { value: null, missing: "thieu_hanh_kiem" });
});

test("chuoi ca-2-chua-dat: ren he -> retest -> o_lai", () => {
  // initial: ca hai chua_dat -> ren_luyen_he
  let r = promo({ stage: "initial", kqht: "chua_dat", kqrl: "chua_dat", absentSessions: 0, hasPriorRetest: false });
  assert.equal(r.value, "ren_luyen_he");
  // sau he: kqrl dat, kqht van chua_dat -> kiem_tra_danh_gia_lai
  r = promo({ stage: "after_summer", kqht: "chua_dat", kqrl: "dat", absentSessions: 0, hasPriorRetest: false });
  assert.equal(r.value, "kiem_tra_danh_gia_lai");
  // sau retest: van chua_dat -> o_lai
  r = promo({ stage: "after_retest", kqht: "chua_dat", kqrl: "dat", absentSessions: 0, hasPriorRetest: true });
  assert.equal(r.value, "o_lai");
});

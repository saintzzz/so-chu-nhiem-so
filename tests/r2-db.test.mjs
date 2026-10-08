// R2 DB behavior tests - chay migration THUC tren Postgres container.
// Khac biet voi r2-regression.test.mjs (static guard): file nay thuc thi
// RLS policy + trigger tren schema fixture gan giong prod, assert hanh vi:
// - recipient khong spoof duoc messages (trg_messages_immutable)
// - substitute chi ghi log dung ngay/mon/lop, khong ghi tuong lai
// - subr_ins chan request approved san / class truong khac
// - status transition chi qua approver
// - PHT campus NULL -> rong
// Neu docker khong co san -> skip (ghi ro boundary static-only).
// Chay: node --test tests/r2-db.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = readFileSync(join(ROOT, "tests/fixtures/r2-fixture.sql"), "utf8");
const MIGRATION = readFileSync(
  join(ROOT, "supabase/migrations/20261105_r2_security_fixes.sql"),
  "utf8",
);
const MIGRATION_R7 = readFileSync(
  join(ROOT, "supabase/migrations/20261107_r7_substitute_role.sql"),
  "utf8",
);
const MIGRATION_R8 = readFileSync(
  join(ROOT, "supabase/migrations/20261108_r8_nlpc_atomic.sql"),
  "utf8",
);
const MIGRATION_R11 = readFileSync(
  join(ROOT, "supabase/migrations/20261109_r11_atomic_writes.sql"),
  "utf8",
);
const MIGRATION_R12 = readFileSync(
  join(ROOT, "supabase/migrations/20261110_r12_seating_atomic.sql"),
  "utf8",
);
const MIGRATION_R15 = readFileSync(
  join(ROOT, "supabase/migrations/20261111_r15_atomic_writes.sql"),
  "utf8",
);
const MIGRATION_CR35 = readFileSync(
  join(ROOT, "supabase/migrations/20261112_cr035_khbd_jsonb.sql"),
  "utf8",
);
const MIGRATION_CR38 = readFileSync(
  join(ROOT, "supabase/migrations/20261116_cr038_multi_role.sql"),
  "utf8",
);

// UUIDs phai khop tests/fixtures/r2-fixture.sql
const ID = {
  schoolA: "10000000-0000-0000-0000-00000000000a",
  tA: "20000000-0000-0000-0000-000000000001",   // gvcn truong A
  tB: "20000000-0000-0000-0000-000000000002",   // gvcn truong B
  bghA: "20000000-0000-0000-0000-000000000003", // bgh truong A
  pht0: "20000000-0000-0000-0000-000000000004", // pht campus NULL
  subA: "20000000-0000-0000-0000-000000000005", // gvbm truong A (day thay)
  phA: "20000000-0000-0000-0000-000000000006",  // phu huynh cua HS A
  toTruongA: "20000000-0000-0000-0000-000000000007", // to_truong truong A (R10)
  classA: "30000000-0000-0000-0000-00000000000a",
  classB: "30000000-0000-0000-0000-00000000000b",
  subjA: "40000000-0000-0000-0000-00000000000a",
  stuA: "60000000-0000-0000-0000-00000000000a",
  stuB: "60000000-0000-0000-0000-00000000000b",
  ttA: "80000000-0000-0000-0000-00000000000a",
  ttA2: "80000000-0000-0000-0000-00000000000b", // subjA2, period 2 - request NULL-subject
  ttA3: "80000000-0000-0000-0000-00000000000c", // subjA2, period 3 - request exact-subject
  msg1: "90000000-0000-0000-0000-000000000001",
  incA: "b0000000-0000-0000-0000-000000000001", // incident lop A (R11)
  seatV1: "c0000000-0000-0000-0000-000000000001", // so do lop A v1 current (R12)
  seatV2: "c0000000-0000-0000-0000-000000000002", // so do lop A v2 cu (R12)
  critA: "d0000000-0000-0000-0000-000000000001",  // tieu chi truong A (R15)
  critA2: "d0000000-0000-0000-0000-000000000002", // tieu chi truong A (R15)
  critA3: "d0000000-0000-0000-0000-000000000003", // tieu chi truong A (R15)
  critB: "d0000000-0000-0000-0000-000000000004",  // tieu chi truong B (R15)
};

const dockerAvailable = (() => {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("R2 DB: migration + RLS/trigger behavior tren Postgres thuc", {
  skip: dockerAvailable
    ? false
    : "docker khong kha dung - RLS chi duoc kiem static (r2-regression.test.mjs)",
  timeout: 180_000,
}, async (t) => {
  const NAME = `scn-r2-pg-${process.pid}`;
  let psql;
  t.after(() => {
    try {
      execSync(`docker rm -f ${NAME}`, { stdio: "pipe" });
    } catch { /* container da remove */ }
  });

  execFileSync("docker", [
    "run", "-d", "--name", NAME,
    "-e", "POSTGRES_PASSWORD=pg",
    "postgres:16-alpine",
  ], { stdio: "pipe" });

  psql = (input) =>
    execFileSync("docker", [
      "exec", "-i", NAME,
      "psql", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-qAt",
    ], { input, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });

  // pg_isready bao ready ca khi initdb dang restart -> poll psql thuc su.
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    try {
      psql("select 1");
      ready = true;
    } catch {
      await sleep(500);
    }
  }
  assert.ok(ready, "postgres container khong san sang sau 60s");

  // 1) fixture, 2) migration verbatim theo thu tu thoi gian (R7 OR REPLACE
  // scn_subr_refs_in_school cua R2; R8 them scn_save_nlpc/scn_save_grades),
  // 3) grant execute cho appuser
  psql(FIXTURE);
  psql(MIGRATION);
  psql(MIGRATION_R7);
  psql(MIGRATION_R8);
  psql(MIGRATION_R11);
  psql(MIGRATION_R12);
  psql(MIGRATION_R15);
  psql(MIGRATION_CR35);
  psql(MIGRATION_CR38);
  psql("grant execute on all functions in schema public to appuser");
  psql("grant usage on schema tvc to appuser; grant execute on all functions in schema tvc to appuser");

  const asUser = (uid, stmt) =>
    psql(`set role appuser; set app.uid='${uid}'; ${stmt}`);
  const denied = (uid, stmt, label) =>
    assert.throws(() => asUser(uid, stmt), undefined, label);

  // ---------- DEFECT 1: messages immutable guard ----------
  await t.test("recipient danh dau da doc duoc (read_at)", () => {
    const out = asUser(ID.phA,
      `update messages set read_at=now() where id='${ID.msg1}' returning read_at is not null`);
    assert.match(out, /t/, "recipient phai update read_at duoc");
  });

  for (const [col, val] of [
    ["sender_id", `'${ID.tB}'`],
    // student_id phai doi sang GIA TRI KHAC (doi ve cung gia tri khong
    // trigger guard vi is not distinct from)
    ["student_id", `'${ID.stuB}'`],
    ["content", "'fake content'"],
    ["recipient_id", `'${ID.tB}'`],
  ]) {
    await t.test(`recipient KHONG doi duoc messages.${col}`, () => {
      denied(ID.phA,
        `update messages set ${col}=${val} where id='${ID.msg1}'`,
        `recipient van sua duoc ${col} - spoof con hoat dong`);
    });
  }

  await t.test("nguoi khac (khong phai recipient) khong update duoc", () => {
    psql(`update messages set read_at=null where id='${ID.msg1}'`);
    asUser(ID.tB, `update messages set read_at=now() where id='${ID.msg1}'`);
    const out = psql(`select read_at is null from messages where id='${ID.msg1}'`);
    assert.match(out, /t/, "non-recipient khong duoc cham vao messages");
  });

  await t.test("msg_send: tin nhan hop le tA -> phA van gui duoc", () => {
    const out = asUser(ID.tA,
      `insert into messages(sender_id, recipient_id, student_id, content)
       values ('${ID.tA}','${ID.phA}','${ID.stuA}','hop le') returning 'ok'`);
    assert.match(out, /ok/);
  });

  await t.test("msg_send: tA gui cho tB khac truong bi chan", () => {
    denied(ID.tA,
      `insert into messages(sender_id, recipient_id, student_id, content)
       values ('${ID.tA}','${ID.tB}',null,'cross-tenant')`,
      "cross-tenant message van insert duoc");
  });

  await t.test("msg_send: phA gia mao sender_id bi chan", () => {
    denied(ID.phA,
      `insert into messages(sender_id, recipient_id, student_id, content)
       values ('${ID.tA}','${ID.phA}',null,'forged sender')`,
      "gia mao sender_id van insert duoc");
  });

  // ---------- R10: to_truong -> gvbm cung truong (deep-link fix) ----------
  // Policy branch staff-staff cho phep to_truong nhan cho gvbm - DB test
  // chung minh insert hop le va recipient doc duoc thread (msg_own).
  await t.test("msg_send: to_truong cung truong gui cho gvbm duoc (R10)", () => {
    const out = asUser(ID.toTruongA,
      `insert into messages(sender_id, recipient_id, student_id, content)
       values ('${ID.toTruongA}','${ID.subA}',null,'tu to truong') returning 'ok'`);
    assert.match(out, /ok/,
      "scn_can_message phai cho to_truong -> gvbm cung truong");
  });

  await t.test("msg_own: gvbm doc duoc thread voi to_truong (recipient read)", () => {
    const out = asUser(ID.subA,
      `select count(*) from messages
       where sender_id='${ID.toTruongA}' and recipient_id='${ID.subA}'`).trim();
    assert.equal(out, "1", "recipient khong select duoc tin cua to_truong");
  });

  await t.test("msg_send: to_truong gui cho staff truong khac bi chan", () => {
    denied(ID.toTruongA,
      `insert into messages(sender_id, recipient_id, student_id, content)
       values ('${ID.toTruongA}','${ID.tB}',null,'cross-tenant to_truong')`,
      "to_truong van nhan duoc cho gvcn truong B - cross-tenant leak");
  });

  // ---------- DEFECT 3: subr_ins forge ----------
  // LUU Y: khong dung RETURNING duoi appuser - fixture khong co SELECT
  // policy tren substitute_requests nen RETURNING bi RLS chan (artifact
  // cua test, khong phai loi policy). Verify bang select tu superuser.
  await t.test("subr_ins: staff tao pending cho lop truong minh van duoc", () => {
    asUser(ID.tA,
      `insert into substitute_requests(school_id, class_id, subject_id, period, date, absent_teacher_id, requested_by)
       values ('${ID.schoolA}','${ID.classA}','${ID.subjA}',2,current_date,'${ID.tA}','${ID.tA}')`);
    const out = psql(
      `select status from substitute_requests where requested_by='${ID.tA}' and period=2 order by created_at desc limit 1`);
    assert.match(out, /pending/);
  });

  await t.test("subr_ins: INSERT status='approved' bi chan", () => {
    denied(ID.tA,
      `insert into substitute_requests(school_id, class_id, subject_id, period, date, absent_teacher_id, requested_by, status)
       values ('${ID.schoolA}','${ID.classA}','${ID.subjA}',2,current_date,'${ID.tA}','${ID.tA}','approved')`,
      "van insert duoc request approved san");
  });

  await t.test("subr_ins: class_id thuoc truong khac bi chan", () => {
    denied(ID.tA,
      `insert into substitute_requests(school_id, class_id, period, date, absent_teacher_id, requested_by)
       values ('${ID.schoolA}','${ID.classB}',2,current_date,'${ID.tA}','${ID.tA}')`,
      "van forge duoc request cho lop truong B");
  });

  // ---------- R7-01: substitute_teacher_id phai co role GV ----------
  await t.test("subr_ins: substitute_teacher_id la BGH bi chan (role check)", () => {
    denied(ID.tA,
      `insert into substitute_requests(school_id, class_id, subject_id, period, date, absent_teacher_id, substitute_teacher_id, requested_by)
       values ('${ID.schoolA}','${ID.classA}','${ID.subjA}',6,current_date,'${ID.tA}','${ID.bghA}','${ID.tA}')`,
      "bgh van gan duoc lam GV day thay - role check chua hieu luc");
  });

  await t.test("subr_ins: gvbm lam substitute van hop le (positive control)", () => {
    asUser(ID.tA,
      `insert into substitute_requests(school_id, class_id, subject_id, period, date, absent_teacher_id, substitute_teacher_id, requested_by)
       values ('${ID.schoolA}','${ID.classA}','${ID.subjA}',7,current_date,'${ID.tA}','${ID.subA}','${ID.tA}')`);
    const out = psql(
      `select status from substitute_requests where requested_by='${ID.tA}' and period=7 limit 1`).trim();
    assert.equal(out, "pending");
  });

  // ---------- subr_upd + trigger: status transition ----------
  await t.test("requester KHONG tu duyet request cua minh", () => {
    // tA tao pending hop le roi co tu approved
    asUser(ID.tA,
      `insert into substitute_requests(school_id, class_id, subject_id, period, date, absent_teacher_id, requested_by)
       values ('${ID.schoolA}','${ID.classA}','${ID.subjA}',3,current_date,'${ID.tA}','${ID.tA}')`);
    const id = psql(
      `select id from substitute_requests where requested_by='${ID.tA}' and period=3 limit 1`).trim();
    denied(ID.tA,
      `update substitute_requests set status='approved', decided_by='${ID.tA}', decided_at=now() where id='${id}'`,
      "requester tu duyet duoc request cua minh");
    const st = psql(`select status from substitute_requests where id='${id}'`).trim();
    assert.equal(st, "pending", "status van phai pending sau khi tu duyet bi chan");
  });

  await t.test("approver bghA duyet pending -> approved hop le", () => {
    asUser(ID.tA,
      `insert into substitute_requests(school_id, class_id, subject_id, period, date, absent_teacher_id, substitute_teacher_id, requested_by)
       values ('${ID.schoolA}','${ID.classA}','${ID.subjA}',4,current_date,'${ID.tA}','${ID.subA}','${ID.tA}')`);
    const id = psql(
      `select id from substitute_requests where requested_by='${ID.tA}' and period=4 limit 1`).trim();
    asUser(ID.bghA,
      `update substitute_requests set status='approved', decided_by='${ID.bghA}', decided_at=now()
       where id='${id}'`);
    const st = psql(`select status from substitute_requests where id='${id}'`).trim();
    assert.equal(st, "approved");
    // approved -> rejected la transition khong hop le
    denied(ID.bghA,
      `update substitute_requests set status='rejected' where id='${id}'`,
      "approved -> rejected van doi duoc (transition sai)");
    assert.equal(
      psql(`select status from substitute_requests where id='${id}'`).trim(),
      "approved",
      "status khong duoc doi boi transition bat hop le",
    );
  });

  // ---------- DEFECT 2: scn_is_sub_ttentry_date ----------
  await t.test("subA ghi period_log dung ngay phan cong: OK", () => {
    const out = asUser(ID.subA,
      `insert into period_logs(timetable_entry_id, date, logged_by)
       values ('${ID.ttA}', current_date, '${ID.subA}') returning 'ok'`);
    assert.match(out, /ok/);
  });

  await t.test("subA ghi log ngay hom qua (trong cua so 60d): OK", () => {
    // can request approved cho ngay hom qua - seed nhanh boi postgres
    psql(`insert into substitute_requests(school_id, class_id, subject_id, period, date, absent_teacher_id, substitute_teacher_id, requested_by, status, decided_by, decided_at)
          values ('${ID.schoolA}','${ID.classA}','${ID.subjA}',1,current_date-1,'${ID.tA}','${ID.subA}','${ID.bghA}','approved','${ID.bghA}',now())`);
    const out = asUser(ID.subA,
      `insert into period_logs(timetable_entry_id, date, logged_by)
       values ('${ID.ttA}', current_date-1, '${ID.subA}') returning 'ok'`);
    assert.match(out, /ok/);
  });

  await t.test("subA KHONG ghi duoc log cho phan cong ngay tuong lai", () => {
    denied(ID.subA,
      `insert into period_logs(timetable_entry_id, date, logged_by)
       values ('${ID.ttA}', current_date + 5, '${ID.subA}')`,
      "phan cong ngay tuong lai van ghi duoc log");
  });

  await t.test("NULL-subject request khong cap quyen (isolated, non-vacuous)", () => {
    // ttA2 CO request approved hom nay nhung subject_id = NULL. Neu predicate
    // wildcard (r.subject_id is null or ...) quay lai, insert nay se pass.
    // Neu khong co assignment nao ca, insert cung fail nhung vi ly do khac -
    // do do ttA2 la entry rieng voi DUNG 1 request null-subject.
    denied(ID.subA,
      `insert into period_logs(timetable_entry_id, date, logged_by)
       values ('${ID.ttA2}', current_date, '${ID.subA}')`,
      "request subject NULL van cap quyen ghi log (wildcard regression)");
    // Chac chan policy da duoc evaluate (row ton tai, request ton tai)
    const reqCount = psql(
      `select count(*) from substitute_requests where id='a0000000-0000-0000-0000-000000000004' and subject_id is null and status='approved'`).trim();
    assert.equal(reqCount, "1", "fixture phai co request NULL-subject approved");
  });

  await t.test("positive control: exact-subject request tren cung setup van OK", () => {
    // ttA3: request approved subject_id = subjA2 khop DUNG mon cua entry.
    const out = asUser(ID.subA,
      `insert into period_logs(timetable_entry_id, date, logged_by)
       values ('${ID.ttA3}', current_date, '${ID.subA}') returning 'ok'`);
    assert.match(out, /ok/);
  });

  await t.test("teacher goc tA van ghi log binh thuong", () => {
    const out = asUser(ID.tA,
      `insert into period_logs(timetable_entry_id, date, logged_by)
       values ('${ID.ttA}', current_date, '${ID.tA}') returning 'ok'`);
    assert.match(out, /ok/);
  });

  // ---------- Round-3: assignSubstitute tren request approved ----------
  await t.test("bghA phan cong GV cho request approved con trong: OK", () => {
    // Trigger bat decided_by = nguoi thuc hien tren row approved -> action
    // phai stamp lai decided_by/decided_at.
    asUser(ID.bghA,
      `update substitute_requests
       set substitute_teacher_id='${ID.subA}', decided_by='${ID.bghA}', decided_at=now()
       where id='a0000000-0000-0000-0000-000000000006'
         and status='approved' and substitute_teacher_id is null`);
    const out = psql(
      `select substitute_teacher_id from substitute_requests where id='a0000000-0000-0000-0000-000000000006'`).trim();
    assert.equal(out, ID.subA);
  });

  await t.test("phan cong lai request da co GV: 0 row (guard is null)", () => {
    asUser(ID.bghA,
      `update substitute_requests
       set substitute_teacher_id='${ID.tA}', decided_by='${ID.bghA}', decided_at=now()
       where id='a0000000-0000-0000-0000-000000000006'
         and status='approved' and substitute_teacher_id is null`);
    const out = psql(
      `select substitute_teacher_id from substitute_requests where id='a0000000-0000-0000-0000-000000000006'`).trim();
    assert.equal(out, ID.subA, "GV da phan cong khong duoc bi ghi de");
  });

  // ---------- R8-02: scn_save_nlpc atomic + RLS invoker ----------
  await t.test("scn_save_nlpc: gvcn luu evals+comments cho HS lop minh", () => {
    asUser(ID.tA,
      `select scn_save_nlpc(
         array['${ID.stuA}']::uuid[], 'hk1',
         '[{"student_id":"${ID.stuA}","attribute_code":"nlc_tuchu","level":"T","evaluated_by":"${ID.tA}"},
           {"student_id":"${ID.stuA}","attribute_code":"pc_chamchi","level":"H","evaluated_by":"${ID.tA}"}]'::jsonb,
         '[{"student_id":"${ID.stuA}","grp":"nlc","comment":"Chu dong hoc tap","evaluated_by":"${ID.tA}"}]'::jsonb)`);
    const evals = psql(
      `select count(*) from competency_evaluations where student_id='${ID.stuA}' and term='hk1'`).trim();
    const cmts = psql(
      `select count(*) from nlpc_comments where student_id='${ID.stuA}' and term='hk1'`).trim();
    assert.equal(evals, "2");
    assert.equal(cmts, "1");
  });

  await t.test("scn_save_nlpc: goi lai thay the du lieu cu cung term", () => {
    // 2 evals + 1 comment tu test truoc phai bi delete+insert thay the.
    asUser(ID.tA,
      `select scn_save_nlpc(
         array['${ID.stuA}']::uuid[], 'hk1',
         '[{"student_id":"${ID.stuA}","attribute_code":"nlc_tuchu","level":"C","evaluated_by":"${ID.tA}"}]'::jsonb,
         '[]'::jsonb)`);
    const evals = psql(
      `select attribute_code || '|' || level from competency_evaluations
        where student_id='${ID.stuA}' and term='hk1'`).trim();
    assert.equal(evals, "nlc_tuchu|C", "eval cu khong bi thay the");
    const cmts = psql(
      `select count(*) from nlpc_comments where student_id='${ID.stuA}' and term='hk1'`).trim();
    assert.equal(cmts, "0", "comment cu khong bi xoa");
  });

  await t.test("scn_save_nlpc: evaluated_by lay tu auth.uid(), khong tin JSON", () => {
    asUser(ID.tA,
      `select scn_save_nlpc(
         array['${ID.stuA}']::uuid[], 'hk1',
         '[{"student_id":"${ID.stuA}","attribute_code":"pc_trungthuc","level":"T","evaluated_by":"${ID.stuB}"}]'::jsonb,
         '[]'::jsonb)`);
    const eb = psql(
      `select evaluated_by from competency_evaluations
        where student_id='${ID.stuA}' and term='hk1' and attribute_code='pc_trungthuc'`).trim();
    assert.equal(eb, ID.tA,
      "evaluated_by phai la auth.uid(), khong phai gia tri client gui");
  });

  await t.test("scn_save_nlpc: HS truong khac bi RLS chan, delete rollback", () => {
    denied(ID.tA,
      `select scn_save_nlpc(
         array['${ID.stuA}','${ID.stuB}']::uuid[], 'hk1',
         '[{"student_id":"${ID.stuB}","attribute_code":"nlc_tuchu","level":"T","evaluated_by":"${ID.tA}"}]'::jsonb,
         '[]'::jsonb)`,
      "gvcn truong A van ghi duoc NLPC cho HS truong B - function khong invoker?");
    // Loi insert phai rollback ca delete - neu khong atomic, row stuA mat.
    const evals = psql(
      `select attribute_code || '|' || level from competency_evaluations
        where student_id='${ID.stuA}' and term='hk1'`).trim();
    assert.equal(evals, "pc_trungthuc|T",
      "insert loi nhung delete da commit - khong nguyen tu");
  });

  // ---------- R11-01: scn_incident_followup atomic append ----------
  await t.test("scn_incident_followup: 2 lan goi lien tiep giu ca 2 ghi chu", () => {
    // Mo phong 2 submit theo doi lien tiep - append tren DB thi ca 2 note
    // phai con (read-modify-write JS cu se mat note dau).
    asUser(ID.tA,
      `select scn_incident_followup('${ID.incA}','following','ghi chu mot')`);
    asUser(ID.tA,
      `select scn_incident_followup('${ID.incA}','resolved','ghi chu hai')`);
    const d = psql(`select description from incidents where id='${ID.incA}'`);
    assert.match(d, /Mo ta ban dau/, "description goc bi ghi de");
    assert.match(d, /ghi chu mot/, "note 1 bi mat - lost update");
    assert.match(d, /ghi chu hai/, "note 2 bi mat");
    assert.match(d, /\[Theo dõi \d{2}\/\d{2}\/\d{4}\]/,
      "thieu stamp [Theo doi DD/MM/YYYY]");
    assert.equal(
      psql(`select status from incidents where id='${ID.incA}'`).trim(),
      "resolved",
      "status khong cap nhat theo lan goi cuoi",
    );
  });

  await t.test("scn_incident_followup: note rong chi doi status", () => {
    const before = psql(
      `select description from incidents where id='${ID.incA}'`);
    asUser(ID.tA,
      `select scn_incident_followup('${ID.incA}','archived','   ')`);
    const after = psql(
      `select description from incidents where id='${ID.incA}'`);
    assert.equal(after, before, "note rong khong duoc append vao description");
    assert.equal(
      psql(`select status from incidents where id='${ID.incA}'`).trim(),
      "archived");
  });

  await t.test("scn_incident_followup: gvcn truong khac bi chan ro rang (RLS)", () => {
    // INVOKER: UPDATE bi RLS loc ve 0 row -> NOT FOUND raise exception ->
    // client nhan loi thay vi "thanh cong" gia.
    denied(ID.tB,
      `select scn_incident_followup('${ID.incA}','new','xoa ngang')`,
      "gvcn truong B sua duoc incident truong A - thieu NOT FOUND raise?");
    const d = psql(`select description from incidents where id='${ID.incA}'`);
    assert.ok(!/xoa ngang/.test(d), "incident truong A bi sua boi caller khong du quyen");
    assert.equal(
      psql(`select status from incidents where id='${ID.incA}'`).trim(),
      "archived", "status bi doi boi caller khong du quyen");
  });

  await t.test("scn_incident_followup: incident khong ton tai -> loi, khong silent", () => {
    denied(ID.tA,
      `select scn_incident_followup('00000000-0000-0000-0000-000000000099','new','x')`,
      "id khong ton tai van tra thanh cong");
  });

  await t.test("scn_incident_followup: 2 session song song giu ca 2 note", async () => {
    // Lead R11: mo phong 2 submit DONG THOI (2 connection rieng). Vi append
    // la 1 UPDATE nguyen tu tren DB, ca 2 note phai con sau khi ca 2 commit.
    const psqlAsync = promisify(execFile);
    const run = (note) =>
      psqlAsync("docker", [
        "exec", "-i", NAME,
        "psql", "-U", "postgres", "-d", "postgres",
        "-v", "ON_ERROR_STOP=1", "-qAt", "-c",
        `set role appuser; set app.uid='${ID.tA}'; ` +
          `select scn_incident_followup('${ID.incA}','following','${note}')`,
      ], { encoding: "utf8" });
    await Promise.all([run("note song song A"), run("note song song B")]);
    const d = psql(`select description from incidents where id='${ID.incA}'`);
    assert.match(d, /note song song A/, "note A bi mat - lost update");
    assert.match(d, /note song song B/, "note B bi mat - lost update");
  });

  // ---------- R11-02: scn_set_class_role atomic replace/clear ----------
  await t.test("scn_set_class_role: thay role nguyen tu (cu mat, moi co)", () => {
    // Fixture seed: stuA dang la lop_truong.
    asUser(ID.tA,
      `select scn_set_class_role('${ID.stuA}','lop_pho_hoc_tap')`);
    const out = psql(
      `select string_agg(role, ',' order by role) from class_roles
        where student_id='${ID.stuA}'`).trim();
    assert.equal(out, "lop_pho_hoc_tap",
      "role cu khong bi thay the - delete+insert khong atomic");
  });

  await t.test("scn_set_class_role: caller bi RLS chan -> rollback giu row cu", () => {
    // tB (gvcn truong B): delete bi RLS loc ve 0 row, insert vi pham WITH
    // CHECK -> loi + rollback. Row lop_pho_hoc_tap cua stuA phai con nguyen.
    denied(ID.tB,
      `select scn_set_class_role('${ID.stuA}','to_truong')`,
      "gvcn truong B dat duoc chuc danh cho HS truong A");
    const out = psql(
      `select string_agg(role, ',' order by role) from class_roles
        where student_id='${ID.stuA}'`).trim();
    assert.equal(out, "lop_pho_hoc_tap",
      "insert loi nhung row cu da mat - khong nguyen tu");
  });

  await t.test("scn_set_class_role: p_role rong chi xoa (clear)", () => {
    asUser(ID.tA, `select scn_set_class_role('${ID.stuA}','')`);
    const n = psql(
      `select count(*) from class_roles where student_id='${ID.stuA}'`).trim();
    assert.equal(n, "0", "clear khong xoa het role cu");
    // Clear boi caller khong du quyen: pre-check school scope raise loi ro
    // rang (khong silent) va row giu nguyen.
    asUser(ID.tA, `select scn_set_class_role('${ID.stuA}','lop_truong')`);
    denied(ID.tB,
      `select scn_set_class_role('${ID.stuA}','')`,
      "caller truong khac clear duoc chuc danh - thieu scope check?");
    const out = psql(
      `select role from class_roles where student_id='${ID.stuA}'`).trim();
    assert.equal(out, "lop_truong",
      "caller khong du quyen van xoa duoc chuc danh");
  });

  await t.test("scn_set_class_role: insert loi SAU delete thanh cong -> rollback", () => {
    // Lead R11: buoc delete phai THUC SU xoa row truoc khi insert fail de
    // chung minh rollback. Constraint test-only ep insert loi (fixture,
    // khong ton tai trong migration/prod).
    psql(`alter table class_roles add constraint z_r11_test_fail
          check (role <> '__test_fail__')`);
    try {
      denied(ID.tA,
        `select scn_set_class_role('${ID.stuA}','__test_fail__')`,
        "insert loi van tra thanh cong");
      const out = psql(
        `select role from class_roles where student_id='${ID.stuA}'`).trim();
      assert.equal(out, "lop_truong",
        "insert fail nhung delete da commit - mat role cu, khong atomic");
    } finally {
      psql(`alter table class_roles drop constraint z_r11_test_fail`);
    }
  });

  // ---------- R12-01: scn_save_seating / scn_restore_seating atomic -----
  await t.test("scn_save_seating: tao version moi la current duy nhat", () => {
    // Fixture: v1 current thang 2026-10. Save -> v3 (max+1) current, v1/v2
    // mat current - truoc day insert loi de lai thang khong co current.
    const v = asUser(ID.tA,
      `select scn_save_seating('${ID.classA}','2026-10-01','{"cols":8,"rows":5,"seats":[]}'::jsonb)`).trim();
    assert.equal(v, "3", "version moi phai la max(version)+1 tinh phia DB");
    const cur = psql(
      `select version from seating_charts
        where class_id='${ID.classA}' and month='2026-10-01' and is_current`).trim();
    assert.equal(cur, "3", "ban ghi moi phai la current duy nhat");
    assert.equal(
      psql(`select is_current from seating_charts where id='${ID.seatV1}'`).trim(),
      "f", "phien ban cu phai mat current");
  });

  await t.test("scn_restore_seating: lat current ve phien ban cu nguyen tu", () => {
    asUser(ID.tA, `select scn_restore_seating('${ID.seatV1}')`);
    const rows = psql(
      `select version || '|' || is_current from seating_charts
        where class_id='${ID.classA}' and month='2026-10-01' order by version`)
      .trim().split("\n");
    const map = Object.fromEntries(rows.map((r) => r.split("|")));
    assert.equal(map["1"], "true", "v1 phai la current sau restore");
    assert.equal(map["2"], "false", "v2 khong duoc con current");
    assert.equal(map["3"], "false", "v3 khong duoc con current - chi 1 current");
  });

  await t.test("scn_save_seating: caller truong khac bi chan + current giu nguyen", () => {
    // INVOKER: UPDATE loc ve 0 row (RLS), INSERT vi pham WITH CHECK -> loi
    // + rollback - khong silent nhu chuoi statement cu.
    denied(ID.tB,
      `select scn_save_seating('${ID.classA}','2026-10-01','{"cols":8,"rows":5,"seats":[]}'::jsonb)`,
      "gvcn truong B van luu duoc so do lop truong A - WITH CHECK?");
    const cur = psql(
      `select version from seating_charts
        where class_id='${ID.classA}' and month='2026-10-01' and is_current`).trim();
    assert.equal(cur, "1",
      "current bi doi boi caller khong du quyen - khong atomic");
    const n = psql(
      `select count(*) from seating_charts
        where class_id='${ID.classA}' and month='2026-10-01'`).trim();
    assert.equal(n, "3", "insert bi chan nhung van tao row moi");
  });

  await t.test("scn_restore_seating: caller truong khac bi chan ro rang (RLS)", () => {
    denied(ID.tB,
      `select scn_restore_seating('${ID.seatV2}')`,
      "gvcn truong B khoi phuc duoc so do lop truong A");
    const cur = psql(
      `select version from seating_charts
        where class_id='${ID.classA}' and month='2026-10-01' and is_current`).trim();
    assert.equal(cur, "1", "current bi doi boi caller khong du quyen");
  });

  await t.test("scn_restore_seating: chart khong ton tai -> loi, khong silent", () => {
    denied(ID.tA,
      `select scn_restore_seating('00000000-0000-0000-0000-000000000099')`,
      "id khong ton tai van tra thanh cong");
  });

  await t.test("scn_save_seating: insert loi SAU deactivate -> rollback giu current cu", () => {
    // Lead R12: UPDATE deactivate phai THUC SU chay truoc khi insert fail
    // de chung minh rollback. Constraint test-only ep row insert co
    // layout->>'fail' bi tu choi (fixture, khong ton tai trong migration).
    psql(`alter table seating_charts add constraint z_r12_test_fail
          check (layout->>'fail' is null)`);
    try {
      denied(ID.tA,
        `select scn_save_seating('${ID.classA}','2026-10-01','{"fail":true}'::jsonb)`,
        "insert loi van tra thanh cong");
      const cur = psql(
        `select version from seating_charts
          where class_id='${ID.classA}' and month='2026-10-01' and is_current`).trim();
      assert.equal(cur, "1",
        "insert fail nhung deactivate da commit - mat current, khong atomic");
    } finally {
      psql(`alter table seating_charts drop constraint z_r12_test_fail`);
    }
  });

  await t.test("scn_save_seating: 2 session song song cho thang moi -> 1 current", async () => {
    // Lead R12: khi chua co row nao, UPDATE deactivate khong khoa gi -> 2 txn
    // song song co the tao 2 version-1 current. Advisory lock phai serialize.
    const psqlAsync = promisify(execFile);
    const run = () =>
      psqlAsync("docker", [
        "exec", "-i", NAME,
        "psql", "-U", "postgres", "-d", "postgres",
        "-v", "ON_ERROR_STOP=1", "-qAt", "-c",
        `set role appuser; set app.uid='${ID.tA}'; ` +
          `select scn_save_seating('${ID.classA}','2026-11-01','{"cols":8,"rows":5,"seats":[]}'::jsonb)`,
      ], { encoding: "utf8" });
    const results = await Promise.allSettled([run(), run()]);
    const ok = results.filter((r) => r.status === "fulfilled");
    assert.equal(ok.length, 2, "ca 2 save hop le phai thanh cong (serialize)");
    const versions = ok.map((r) => r.value.stdout.trim()).sort();
    assert.deepEqual(versions, ["1", "2"],
      "advisory lock phai serialize - 2 version rieng, khong phai 2x v1");
    const curCount = psql(
      `select count(*) from seating_charts
        where class_id='${ID.classA}' and month='2026-11-01' and is_current`).trim();
    assert.equal(curCount, "1", "phai con dung 1 current sau 2 save song song");
  });

  // ---------- R15-01: scn_save_attendance atomic upsert ----------
  await t.test("scn_save_attendance: insert moi + goi lai update, khong dup", () => {
    asUser(ID.tA,
      `select scn_save_attendance('2026-11-06',
        '[{"student_id":"${ID.stuA}","status":"excused","note":"om"}]'::jsonb)`);
    let out = psql(
      `select status || '|' || coalesce(note,'~') || '|' || source
         from attendance_records
        where student_id='${ID.stuA}' and date='2026-11-06'`).trim();
    assert.equal(out, "excused|om|manual");
    // Lan 2 cung (student,date): update tren cho, khong tao row moi.
    asUser(ID.tA,
      `select scn_save_attendance('2026-11-06',
        '[{"student_id":"${ID.stuA}","status":"late","note":null}]'::jsonb)`);
    out = psql(
      `select status || '|' || coalesce(note,'~') || '|' || source
         from attendance_records
        where student_id='${ID.stuA}' and date='2026-11-06'`).trim();
    assert.equal(out, "late|~|manual", "lan 2 phai update row cu");
    assert.equal(
      psql(`select count(*) from attendance_records
             where student_id='${ID.stuA}' and date='2026-11-06'`).trim(),
      "1", "upsert tao them row trung (student_id,date)");
  });

  await t.test("scn_save_attendance: row period_log giu nguyen source", () => {
    // Fixture seed: stuA 2026-11-05 source='period_log' (so dau bai ghi).
    // Manual save cung (student,date) chi doi status/note - source phai con
    // 'period_log' (fallback cu delete+insert la mat dau vet nay).
    asUser(ID.tA,
      `select scn_save_attendance('2026-11-05',
        '[{"student_id":"${ID.stuA}","status":"excused","note":"gvcn xac nhan"}]'::jsonb)`);
    const out = psql(
      `select status || '|' || source || '|' || note
         from attendance_records
        where student_id='${ID.stuA}' and date='2026-11-05'`).trim();
    assert.equal(out, "excused|period_log|gvcn xac nhan",
      "DO UPDATE khong duoc cham cot source");
  });

  await t.test("scn_save_attendance: HS truong khac bi chan, toan bo rollback", () => {
    // 1 row hop le + 1 row truong B trong CUNG call: WITH CHECK fail tren
    // stuB -> exception -> row stuA cung khong duoc ghi (khong nua voc nhu
    // fallback cu).
    denied(ID.tA,
      `select scn_save_attendance('2026-11-07',
        '[{"student_id":"${ID.stuA}","status":"present","note":null},
          {"student_id":"${ID.stuB}","status":"excused","note":null}]'::jsonb)`,
      "gvcn truong A ghi duoc chuyen can HS truong B - function khong invoker?");
    assert.equal(
      psql(`select count(*) from attendance_records where date='2026-11-07'`).trim(),
      "0", "row hop le da commit du call bi chan - khong atomic");
  });

  await t.test("scn_save_attendance: update bi RLS loc silent -> postcondition raise", () => {
    // tB khong doc/duoc quyen gi tren attendance_records truong A: insert
    // vi pham WITH CHECK -> loi. Nhung du co duong silent-skip nao thi
    // postcondition cung bat - khong bao thanh cong gia nhu client cu.
    denied(ID.tB,
      `select scn_save_attendance('2026-11-05',
        '[{"student_id":"${ID.stuA}","status":"present","note":null}]'::jsonb)`,
      "gvcn truong B sua duoc chuyen can truong A");
    const out = psql(
      `select status from attendance_records
        where student_id='${ID.stuA}' and date='2026-11-05'`).trim();
    assert.equal(out, "excused", "row bi doi boi caller khong du quyen");
  });

  await t.test("scn_save_attendance: array rong OK, input khong phai array loi", () => {
    asUser(ID.tA, `select scn_save_attendance('2026-11-08','[]'::jsonb)`);
    denied(ID.tA,
      `select scn_save_attendance('2026-11-08','{"a":1}'::jsonb)`,
      "p_rows khong phai array van chap nhan");
    denied(ID.tA,
      `select scn_save_attendance(null,'[]'::jsonb)`,
      "p_date null van chap nhan");
  });

  // ---------- R15-02: scn_save_emulation atomic delete+upsert ----------
  await t.test("scn_save_emulation: insert+update+delete hon hop trong 1 call", () => {
    // Fixture: (classA,critA,2026-T11)=10, (classA,critA2,2026-T11)=8.
    // Ops: critA -> 15 (update), critA2 -> null (delete), critA3 -> 20 (insert).
    asUser(ID.tA,
      `select scn_save_emulation('2026-T11',
        '[{"class_id":"${ID.classA}","criterion_id":"${ID.critA}","score":15},
          {"class_id":"${ID.classA}","criterion_id":"${ID.critA2}","score":null},
          {"class_id":"${ID.classA}","criterion_id":"${ID.critA3}","score":20}]'::jsonb)`);
    const rows = psql(
      `select criterion_id || '|' || score from emulation_scores
        where class_id='${ID.classA}' and period='2026-T11' order by criterion_id`)
      .trim().split("\n");
    assert.deepEqual(rows,
      [`${ID.critA}|15`, `${ID.critA3}|20`],
      "update/insert/delete khong ap dung dung trong 1 txn");
  });

  await t.test("scn_save_emulation: upsert loi -> delete trong cung call rollback", () => {
    // Constraint test-only ep score=-999 fail: delete critA chay truoc
    // trong txn roi insert fail -> critA phai con 15 (khong nua voc).
    psql(`alter table emulation_scores add constraint z_r15_test_fail
          check (score <> -999)`);
    try {
      denied(ID.tA,
        `select scn_save_emulation('2026-T11',
          '[{"class_id":"${ID.classA}","criterion_id":"${ID.critA}","score":null},
            {"class_id":"${ID.classA}","criterion_id":"${ID.critA2}","score":-999}]'::jsonb)`,
        "upsert loi van tra thanh cong");
      const out = psql(
        `select score from emulation_scores
          where class_id='${ID.classA}' and criterion_id='${ID.critA}'
            and period='2026-T11'`).trim();
      assert.equal(out, "15",
        "delete da commit du upsert fail - khong atomic");
    } finally {
      psql(`alter table emulation_scores drop constraint z_r15_test_fail`);
    }
  });

  await t.test("scn_save_emulation: lop truong khac bi chan (WITH CHECK)", () => {
    denied(ID.tA,
      `select scn_save_emulation('2026-T11',
        '[{"class_id":"${ID.classB}","criterion_id":"${ID.critB}","score":5}]'::jsonb)`,
      "gvcn truong A cham duoc diem lop truong B - function khong invoker?");
    assert.equal(
      psql(`select count(*) from emulation_scores where class_id='${ID.classB}'`).trim(),
      "0", "row truong B da duoc ghi");
  });

  await t.test("scn_save_emulation: array rong OK, period null loi", () => {
    asUser(ID.tA, `select scn_save_emulation('2026-T12','[]'::jsonb)`);
    denied(ID.tA,
      `select scn_save_emulation(null,'[]'::jsonb)`,
      "p_period null van chap nhan");
    denied(ID.tA,
      `select scn_save_emulation('2026-T12','"x"'::jsonb)`,
      "p_ops khong phai array van chap nhan");
  });

  // ---------- R2-10: PHT campus NULL fail-closed ----------
  await t.test("PHT campus NULL: my_school_class_ids rong", () => {
    const out = asUser(ID.pht0, "select count(*) from my_school_class_ids()");
    assert.equal(out.trim(), "0", "PHT chua gan campus van thay lop");
  });

  await t.test("GVCN tA van thay lop truong minh", () => {
    const out = asUser(ID.tA, "select count(*) from my_school_class_ids()");
    assert.equal(out.trim(), "1");
  });

  // ---------- CR-035: content_json jsonb ----------
  await t.test("lesson_plans.content_json ton tai, ghi/doc jsonb", () => {
    psql(`insert into lesson_plans(school_id, teacher_id, class_id, subject_id,
        title, content, content_json, status) values
      ('${ID.schoolA}','${ID.tA}','${ID.classA}','${ID.subjA}',
       'Bai test','flat mirror',
       '{"muc_tieu_kien_thuc":"KT1","kham_pha":{"to_chuc":"TC"}}'::jsonb,
       'submitted')`);
    const out = psql(
      `select concat_ws('|', content_json->>'muc_tieu_kien_thuc',
         (content_json->'kham_pha')->>'to_chuc') from lesson_plans`);
    assert.equal(out.trim(), "KT1|TC");
    // Plan cu (content_json null) van doc duoc binh thuong
    psql(`insert into lesson_plans(school_id, teacher_id, title, content, status)
      values ('${ID.schoolA}','${ID.tA}','Bai cu','noi dung cu','approved')`);
    const old = psql(
      `select content_json is null from lesson_plans where title='Bai cu'`);
    assert.equal(old.trim(), "t");
  });

  // ---------- CR-038: multi-role ----------
  await t.test("my_roles tra ve role chinh + concurrent_roles", () => {
    psql(`insert into profiles(id, role, school_id, concurrent_roles)
      values ('20000000-0000-0000-0000-000000000099','to_truong',
              '${ID.schoolA}','{gvcn,gvbm}')`);
    const out = asUser("20000000-0000-0000-0000-000000000099",
      "select array_to_string(my_roles(), ',')");
    assert.ok(out.includes("to_truong") && out.includes("gvcn") && out.includes("gvbm"),
      `my_roles phai gom ca 3 role: ${out}`);
  });

  await t.test("DO block da rewrite het policy my_role() -> my_roles()", () => {
    const leftover = psql(
      `select count(*) from pg_policies
        where (qual like '%my_role()%' or with_check like '%my_role()%')`);
    assert.equal(leftover.trim(), "0",
      "con policy dung my_role() sau migration - rewrite chua chay");
    const rewritten = psql(
      `select count(*) from pg_policies where qual like '%my_roles()%' or with_check like '%my_roles()%'`);
    assert.ok(+rewritten.trim() > 0, "phai co policy dung my_roles()");
  });

  await t.test("concurrent_roles check chan role khong eligible", () => {
    assert.throws(
      () => psql(`insert into profiles(id, role, school_id, concurrent_roles)
        values ('20000000-0000-0000-0000-000000000098','gvcn',
                '${ID.schoolA}','{admin}')`),
      undefined, "admin khong duoc la concurrent role");
    // Non-staff primary khong duoc gan concurrent staff role (escalation).
    assert.throws(
      () => psql(`insert into profiles(id, role, school_id, concurrent_roles)
        values ('20000000-0000-0000-0000-000000000095','phu_huynh',
                '${ID.schoolA}','{gvcn}')`),
      undefined, "phu_huynh khong duoc kiem nhiem gvcn");
  });

  await t.test("GVBM kiem GVCN ghi duoc diem danh lop chu nhiem", () => {
    // multiA: primary gvbm + concurrent gvcn, la gvcn_id cua lop 9Z.
    // Truoc CR-038 policy att_ins chi check my_role()='gvcn' -> denied.
    psql(`insert into profiles(id, role, school_id, concurrent_roles)
      values ('20000000-0000-0000-0000-000000000097','gvbm',
              '${ID.schoolA}','{gvcn}')`);
    psql(`insert into classes(id, school_id, gvcn_id, name)
      values ('30000000-0000-0000-0000-00000000009c','${ID.schoolA}',
              '20000000-0000-0000-0000-000000000097','9Z')`);
    psql(`insert into students(id, class_id, full_name)
      values ('60000000-0000-0000-0000-00000000009c',
              '30000000-0000-0000-0000-00000000009c','HS Multi')`);
    asUser("20000000-0000-0000-0000-000000000097",
      `insert into attendance_records(student_id, date, status)
       values ('60000000-0000-0000-0000-00000000009c','2026-11-09','present')`);
    assert.equal(
      psql(`select count(*) from attendance_records
            where student_id='60000000-0000-0000-0000-00000000009c'`).trim(),
      "1", "gvcn concurrent khong ghi duoc chuyen can lop minh");
  });

  await t.test("GVBM don (khong concurrent) bi chan du la gvcn_id lop", () => {
    // gvcn_id khong du tu - phai co 'gvcn' trong role set.
    psql(`insert into profiles(id, role, school_id)
      values ('20000000-0000-0000-0000-000000000096','gvbm','${ID.schoolA}')`);
    psql(`insert into classes(id, school_id, gvcn_id, name)
      values ('30000000-0000-0000-0000-00000000009d','${ID.schoolA}',
              '20000000-0000-0000-0000-000000000096','9Y')`);
    psql(`insert into students(id, class_id, full_name)
      values ('60000000-0000-0000-0000-00000000009d',
              '30000000-0000-0000-0000-00000000009d','HS Single')`);
    denied("20000000-0000-0000-0000-000000000096",
      `insert into attendance_records(student_id, date, status)
       values ('60000000-0000-0000-0000-00000000009d','2026-11-09','present')`,
      "gvbm khong concurrent ghi duoc chuyen can");
  });

  await t.test("scn_can_write_grade theo role set (gvcn concurrent)", () => {
    // multiA (gvbm+{gvcn}) duoc viet diem HS lop CN minh qua nhanh gvcn.
    const ok = asUser("20000000-0000-0000-0000-000000000097",
      `select scn_can_write_grade('60000000-0000-0000-0000-00000000009c','${ID.subjA}')`);
    assert.equal(ok.trim(), "t",
      "gvcn concurrent khong viet duoc diem lop CN");
    // gvbm don (96) khong day mon do -> false du la gvcn_id lop.
    const no = asUser("20000000-0000-0000-0000-000000000096",
      `select scn_can_write_grade('60000000-0000-0000-0000-00000000009d','${ID.subjA}')`);
    assert.equal(no.trim(), "f",
      "gvbm khong concurrent viet duoc diem");
  });

  await t.test("escalation guard chan user tu gan concurrent_roles", () => {
    // GVCN tA tu update concurrent_roles cua minh -> trigger chan.
    denied(ID.tA,
      `update profiles set concurrent_roles='{bgh}'
       where id='${ID.tA}'`,
      "user tu gan concurrent_roles - escalation guard khong hoat dong");
    assert.equal(
      psql(`select cardinality(concurrent_roles) from profiles where id='${ID.tA}'`).trim(),
      "0", "concurrent_roles da bi ghi du trigger");
    // BGH duoc gan (actor bgh nam trong allowed list).
    asUser(ID.bghA,
      `update profiles set concurrent_roles='{gvbm}'
       where id='${ID.toTruongA}'`);
    assert.equal(
      psql(`select concurrent_roles::text from profiles where id='${ID.toTruongA}'`).trim(),
      "{gvbm}", "bgh khong gan duoc concurrent_roles cho staff");
    // GVCN khong duoc gan cho nguoi khac.
    denied(ID.tA,
      `update profiles set concurrent_roles='{}'
       where id='${ID.toTruongA}'`,
      "gvcn sua duoc concurrent_roles cua nguoi khac");
  });

  await t.test("scn_has_feature theo role set + deny thang", () => {
    // to_truong concurrent (gvbm+{to_truong}) duoc studio.review.
    psql(`insert into profiles(id, role, school_id, concurrent_roles)
      values ('20000000-0000-0000-0000-000000000094','gvbm',
              '${ID.schoolA}','{to_truong}')`);
    let out = asUser("20000000-0000-0000-0000-000000000094",
      "select scn_has_feature('studio.review')");
    assert.equal(out.trim(), "t",
      "to_truong concurrent khong duoc studio.review");
    // Role-level grant deny tren to_truong -> deny thang du gvcn allow.
    psql(`insert into feature_grants(school_id, role, feature, effect)
      values ('${ID.schoolA}','to_truong','studio.review','deny'),
             ('${ID.schoolA}','gvbm','studio.review','allow')`);
    out = asUser("20000000-0000-0000-0000-000000000094",
      "select scn_has_feature('studio.review')");
    assert.equal(out.trim(), "f",
      "grant deny tren 1 role khong chan duoc - escalation qua role thoang hon");
    psql(`delete from feature_grants`);
  });

  await t.test("tvc.review_material: to_truong concurrent duyet tang 1", () => {
    psql(`insert into profiles(id, role, school_id, concurrent_roles)
      values ('20000000-0000-0000-0000-000000000094','gvbm',
              '${ID.schoolA}','{to_truong}')
      on conflict (id) do nothing`);
    psql(`insert into tvc.materials(id, school_id, author_id, title, status)
      values ('e0000000-0000-0000-0000-000000000001','${ID.schoolA}','${ID.subA}','TL1','in_review')`);
    const out = asUser("20000000-0000-0000-0000-000000000094",
      `select tvc.review_material('e0000000-0000-0000-0000-000000000001','approve','ok')->>'ok'`);
    assert.equal(out.trim(), "true",
      "to_truong concurrent khong duyet duoc - " + out);
    assert.equal(
      psql(`select status from tvc.materials where id='e0000000-0000-0000-0000-000000000001'`).trim(),
      "totruong_ok", "status sau to duyet sai");
    // GVBM don khong duyet duoc.
    const no = asUser(ID.subA,
      `select tvc.review_material('e0000000-0000-0000-0000-000000000001','approve','')->>'error'`);
    assert.match(no, /quyền|trạng thái/,
      "gvbm duyet duoc hoc lieu");
  });
});

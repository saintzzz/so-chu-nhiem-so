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
import { execFileSync, execSync } from "node:child_process";
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

// UUIDs phai khop tests/fixtures/r2-fixture.sql
const ID = {
  schoolA: "10000000-0000-0000-0000-00000000000a",
  tA: "20000000-0000-0000-0000-000000000001",   // gvcn truong A
  tB: "20000000-0000-0000-0000-000000000002",   // gvcn truong B
  bghA: "20000000-0000-0000-0000-000000000003", // bgh truong A
  pht0: "20000000-0000-0000-0000-000000000004", // pht campus NULL
  subA: "20000000-0000-0000-0000-000000000005", // gvbm truong A (day thay)
  phA: "20000000-0000-0000-0000-000000000006",  // phu huynh cua HS A
  classA: "30000000-0000-0000-0000-00000000000a",
  classB: "30000000-0000-0000-0000-00000000000b",
  subjA: "40000000-0000-0000-0000-00000000000a",
  stuA: "60000000-0000-0000-0000-00000000000a",
  stuB: "60000000-0000-0000-0000-00000000000b",
  ttA: "80000000-0000-0000-0000-00000000000a",
  ttA2: "80000000-0000-0000-0000-00000000000b", // subjA2, period 2 - request NULL-subject
  ttA3: "80000000-0000-0000-0000-00000000000c", // subjA2, period 3 - request exact-subject
  msg1: "90000000-0000-0000-0000-000000000001",
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
  psql("grant execute on all functions in schema public to appuser");

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

  // ---------- R2-10: PHT campus NULL fail-closed ----------
  await t.test("PHT campus NULL: my_school_class_ids rong", () => {
    const out = asUser(ID.pht0, "select count(*) from my_school_class_ids()");
    assert.equal(out.trim(), "0", "PHT chua gan campus van thay lop");
  });

  await t.test("GVCN tA van thay lop truong minh", () => {
    const out = asUser(ID.tA, "select count(*) from my_school_class_ids()");
    assert.equal(out.trim(), "1");
  });
});

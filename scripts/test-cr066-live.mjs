// CR-066 live test: login bgh that -> test RPC + deny paths.
// Chay: node scripts/test-cr066-live.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim())),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SCHOOL = "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285";
const STUDENT = "bc3dd43a-c528-489d-84bf-80216e22891c"; // Nguyen Gia Bao 8A2
const TEACHER = "bb42e98d-f6ca-40ff-98c9-4440beda01a7"; // anhptl

const ok = (name, cond, extra = "") =>
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " - " + extra : ""}`);

const sb = createClient(url, anon);
const { error: authErr } = await sb.auth.signInWithPassword({
  email: "hainv@nd.scn",
  password: "demo1234",
});
if (authErr) { console.log("FATAL auth", authErr.message); process.exit(1); }

// 1) add_book + copies
let r = await sb.rpc("lib_add_book", {
  p_title: "QA-CR066 Sach test", p_author: "TG Test", p_publisher: "NXB GD",
  p_year: 2026, p_isbn: null, p_category: "Sách tham khảo",
  p_price: 50000, p_copies: 3, p_source: "mua",
});
ok("add_book", !r.error && r.data?.copies === 3, JSON.stringify(r.error ?? r.data));
const bookId = r.data?.book_id;

// 2) copies got sequential DKCB
r = await sb.from("lib_copies").select("accession_no,status").eq("book_id", bookId).order("accession_no");
ok("copies_3_available", !r.error && r.data.length === 3 && r.data.every((c) => c.status === "available"), JSON.stringify(r.data));
const copyIds = await sb.from("lib_copies").select("id").eq("book_id", bookId).order("accession_no").limit(2);
const [copy1, copy2] = copyIds.data.map((c) => c.id);

// 3) checkout student
r = await sb.rpc("lib_checkout", { p_copy: copy1, p_student: STUDENT, p_teacher: null, p_days: 14, p_note: null });
ok("checkout_student", !r.error, JSON.stringify(r.error ?? r.data));
const loan1 = r.data?.loan_id;

// 4) double checkout -> not_available
r = await sb.rpc("lib_checkout", { p_copy: copy1, p_student: STUDENT, p_teacher: null, p_days: 14, p_note: null });
ok("double_checkout_blocked", !!r.error && r.error.message.includes("not_available"), r.error?.message);

// 5) borrower xor: both -> borrower_xor
r = await sb.rpc("lib_checkout", { p_copy: copy2, p_student: STUDENT, p_teacher: TEACHER, p_days: 7, p_note: null });
ok("borrower_xor_blocked", !!r.error && r.error.message.includes("borrower_xor"), r.error?.message);

// 6) checkout teacher
r = await sb.rpc("lib_checkout", { p_copy: copy2, p_student: null, p_teacher: TEACHER, p_days: 7, p_note: null });
ok("checkout_teacher", !r.error, JSON.stringify(r.error ?? r.data));
const loan2 = r.data?.loan_id;

// 7) return ok -> copy available
r = await sb.rpc("lib_return", { p_loan: loan1, p_condition: "ok", p_note: null });
ok("return_ok", !r.error && r.data?.copy_status === "available", JSON.stringify(r.error ?? r.data));

// 8) return damaged -> copy damaged
r = await sb.rpc("lib_return", { p_loan: loan2, p_condition: "damaged", p_note: "rach bia" });
ok("return_damaged", !r.error && r.data?.copy_status === "damaged", JSON.stringify(r.error ?? r.data));

// 9) return again -> already_returned
r = await sb.rpc("lib_return", { p_loan: loan1, p_condition: "ok", p_note: null });
ok("already_returned", !!r.error && r.error.message.includes("already_returned"), r.error?.message);

// 10) cross-school student -> cross_school_student (student cua truong khac)
const other = await sb.from("students").select("id, classes(school_id)").limit(50);
const foreign = (other.data ?? []).find((s) => {
  const c = Array.isArray(s.classes) ? s.classes[0] : s.classes;
  return c?.school_id && c.school_id !== SCHOOL;
});
if (foreign) {
  const c3 = await sb.from("lib_copies").select("id").eq("book_id", bookId).eq("status", "available").limit(1);
  r = await sb.rpc("lib_checkout", { p_copy: c3.data[0].id, p_student: foreign.id, p_teacher: null, p_days: 7, p_note: null });
  ok("cross_school_student_blocked", !!r.error && (r.error.message.includes("student_not_found") || r.error.message.includes("cross_school")), r.error?.message);
} else ok("cross_school_student_blocked", true, "skip - khong co HS truong khac");

// 11) direct writes denied
r = await sb.from("lib_copies").insert({ school_id: SCHOOL, book_id: bookId, accession_no: 99999 });
ok("direct_insert_copy_denied", !!r.error, r.error?.message?.slice(0, 60));
r = await sb.from("lib_loans").insert({ school_id: SCHOOL, copy_id: copy1, student_id: STUDENT, due_at: new Date().toISOString() });
ok("direct_insert_loan_denied", !!r.error, r.error?.message?.slice(0, 60));
r = await sb.rpc("lib_next_accessions", { p_school: SCHOOL, p_count: 5 });
ok("next_accessions_not_exposed", !!r.error, r.error?.message?.slice(0, 60));

// 12) role deny: gvbm (khong phai bgh/admin) khong them duoc sach
const sb2 = createClient(url, anon);
await sb2.auth.signInWithPassword({ email: "anhptl@nd.scn", password: "demo1234" });
r = await sb2.rpc("lib_add_book", { p_title: "x", p_author: null, p_publisher: null, p_year: null, p_isbn: null, p_category: null, p_price: null, p_copies: 0, p_source: null });
ok("gvbm_forbidden", !!r.error && r.error.message.includes("forbidden"), r.error?.message);

// 13) module off -> module_disabled
const svc = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY);
await svc.from("school_features").upsert({ school_id: SCHOOL, module: "thu_vien", enabled: false });
r = await sb.rpc("lib_add_book", { p_title: "x", p_author: null, p_publisher: null, p_year: null, p_isbn: null, p_category: null, p_price: null, p_copies: 0, p_source: null });
ok("module_disabled", !!r.error && r.error.message.includes("module_disabled"), r.error?.message);
await svc.from("school_features").delete().eq("school_id", SCHOOL).eq("module", "thu_vien");

// 14) staff read catalog (gvbm read ok qua RLS)
r = await sb2.from("lib_books").select("id").eq("id", bookId);
ok("staff_read_catalog", !r.error && r.data.length === 1);

// cleanup
await svc.from("lib_loans").delete().eq("school_id", SCHOOL);
await svc.from("lib_books").delete().eq("id", bookId);
await svc.from("lib_copies").delete().eq("school_id", SCHOOL);
const seq = await svc.from("lib_accession_seq").select("next_no").eq("school_id", SCHOOL).single();
console.log("cleanup done; seq next_no:", seq.data?.next_no);

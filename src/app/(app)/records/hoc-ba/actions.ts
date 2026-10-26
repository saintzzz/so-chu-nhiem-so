"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";
import { getStudentYearEndBundle } from "@/lib/hocba";

import { logAudit } from "@/lib/audit";

const GROUNDS = ["tt22_9_3", "danh_gia_lai", "hs_khuyet_tat", "mien_mon"];
const RATINGS = ["tot", "kha", "dat", "chua_dat"];
const TITLES = ["xuat_sac", "gioi"];
const PROMOS = ["len_lop", "kiem_tra_danh_gia_lai", "ren_luyen_he", "o_lai"];
const STAGES = ["initial", "after_retest", "after_summer"];

export interface DecisionInput {
  studentId: string;
  academicYearId: string;
  stage: string;
  kqht: string | null;
  kqrl: string | null;
  danhHieu: string | null;
  promotion: string | null;
  overrideLegalGround: string | null;
  overrideNote: string | null;
  exemptSubjectIds: string[];
  giayKhenNote: string | null;
  computedSnapshot: Record<string, unknown> | null;
}

function validateDecision(input: DecisionInput): string | null {
  if (!STAGES.includes(input.stage)) return "Giai đoạn không hợp lệ.";
  if (input.kqht && !RATINGS.includes(input.kqht)) return "Kết quả học tập không hợp lệ.";
  if (input.kqrl && !RATINGS.includes(input.kqrl)) return "Kết quả rèn luyện không hợp lệ.";
  if (input.danhHieu && !TITLES.includes(input.danhHieu)) return "Danh hiệu không hợp lệ.";
  if (input.promotion && !PROMOS.includes(input.promotion)) return "Quyết định lên lớp không hợp lệ.";
  if (input.overrideLegalGround) {
    if (!GROUNDS.includes(input.overrideLegalGround))
      return "Căn cứ pháp lý không hợp lệ.";
    if (!input.overrideNote?.trim())
      return "Cần nhập ghi chú khi chọn căn cứ pháp lý.";
  }
  return null;
}

/** GVCN lớp mình: server-side re-verify homeroom (RLS cũng chặn nhưng fail fast + rõ lỗi). */
async function verifyGvcnOwns(studentId: string): Promise<{ schoolId: string; error?: string }> {
  const profile = await getProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id,classes!inner(gvcn_id,school_id)")
    .eq("id", studentId)
    .maybeSingle();
  if (error) {
    console.error("[hocba] verify:", error.message);
    return { schoolId: "", error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  const cls = (data?.classes as unknown as { gvcn_id: string | null; school_id: string } | null) ?? null;
  if (!data || !cls || cls.gvcn_id !== profile?.id || cls.school_id !== profile.school_id)
    return { schoolId: "", error: "Bạn không chủ nhiệm lớp của học sinh này." };
  return { schoolId: cls.school_id };
}

async function notifyBgh(supabase: Awaited<ReturnType<typeof createClient>>, schoolId: string, title: string, body: string, link: string) {
  const { data, error: profErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("school_id", schoolId)
    .or("role.eq.bgh,concurrent_roles.cs.{bgh}")
    .limit(200);
  if (profErr) {
    console.error("[hocba] bgh lookup:", profErr.message);
    return;
  }
  const rows = (data ?? []) as { id: string }[];
  if (!rows.length) return;
  const { error } = await supabase.from("notifications").insert(
    rows.map((p) => ({ profile_id: p.id, type: "hoc_ba", title, body, link })),
  );
  if (error) console.error("[hocba] notify bgh:", error.message);
}

async function notifyGvcn(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string, title: string, body: string, link: string) {
  const { error } = await supabase
    .from("notifications")
    .insert({ profile_id: profileId, type: "hoc_ba", title, body, link });
  if (error) console.error("[hocba] notify gvcn:", error.message);
}

/** GVCN lưu nháp hoặc trình BGH duyệt. submit=true -> status='submitted'. */
export async function saveYearEndDecision(
  input: DecisionInput,
  submit: boolean,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["gvcn"]);
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const invalid = validateDecision(input);
  if (invalid) return { error: invalid };
  // r-hb1 F2: trinh duyet bat buoc du 3 truong phap ly - UI chan bang
  // submitReady nhung action phai tu enforce (trigger DB chan tiep).
  if (submit && (!input.kqht || !input.kqrl || !input.promotion)) {
    return { error: "Chưa đủ dữ liệu xếp loại để trình duyệt." };
  }

  const own = await verifyGvcnOwns(input.studentId);
  if (own.error) return { error: own.error };

  const supabase = await createClient();

  // r33-1: xep loai la du lieu PHAP LY - server tinh lai tu nguon, khong
  // tin gia tri client gui len. Bat ky lech nao so voi goi y he thong
  // bat buoc can cu phap ly + ghi chu (theo dung luat UI da ep).
  // r-hb2 F2: tinh comp theo tap mien INCOMING - khong theo tap mien da
  // luu cua quyet dinh truoc, neu khong snapshot lech voi gia tri UI/gui.
  const bundle = await getStudentYearEndBundle(
    input.studentId,
    input.academicYearId,
    input.exemptSubjectIds,
  );
  if (!bundle) return { error: "Không tải được dữ liệu nguồn để kiểm tra." };
  const comp = bundle.computed;
  const schoolSubjectIds = new Set(bundle.subjectRows.map((s) => s.subjectId));
  const exempt = input.exemptSubjectIds.filter((id) => schoolSubjectIds.has(id));

  // Quyet dinh hien tai cung stage (neu co) - de so sanh tap mien mon va
  // giu nguyen status khi luu nhap (rejected->draft bi trigger chan, r33-3).
  const { data: cur, error: curErr } = await supabase
    .from("year_end_decisions")
    .select("id,status,exempt_subject_ids")
    .eq("student_id", input.studentId)
    .eq("academic_year_id", input.academicYearId)
    .eq("stage", input.stage)
    .maybeSingle();
  if (curErr) return { error: "Không tải được quyết định hiện tại." };

  const priorExempt = (cur?.exempt_subject_ids ?? []) as string[];
  const exemptChanged =
    exempt.length !== priorExempt.length ||
    exempt.some((id) => !priorExempt.includes(id));
  const deviates =
    input.kqht !== comp.kqht.value ||
    input.kqrl !== comp.kqrl.value ||
    input.danhHieu !== comp.danhHieu ||
    input.promotion !== comp.promotion.value;
  if ((deviates || exemptChanged) && (!input.overrideLegalGround || !input.overrideNote?.trim()))
    return {
      error: "Kết quả khác gợi ý của hệ thống hoặc thay đổi miễn môn - bắt buộc căn cứ pháp lý và ghi chú.",
    };

  const payload = {
    student_id: input.studentId,
    school_id: profile.school_id,
    academic_year_id: input.academicYearId,
    stage: input.stage,
    kqht: input.kqht,
    kqrl: input.kqrl,
    danh_hieu: input.danhHieu,
    promotion: input.promotion,
    override_legal_ground: input.overrideLegalGround,
    override_note: input.overrideNote?.trim() || null,
    exempt_subject_ids: exempt,
    // r33-1: snapshot ghi tu tinh toan SERVER - client chi mang goi y.
    computed_snapshot: submit
      ? {
          kqht: comp.kqht.value,
          kqrl: comp.kqrl.value,
          danhHieu: comp.danhHieu,
          promotion: comp.promotion.value,
          absentTotal: bundle.absentTotal,
        }
      : null,
    // r-hb1 F1: insert luon la 'draft' - RLS chi cho insert draft; submit
    // di qua UPDATE (casUpdate) de trigger submit-guard kiem tra.
    status: "draft",
  };

  // Stage != initial: row draft da duoc createNextStage tao san -> update truc
  // tiep (insert se dung trigger "stage already exists" truoc ca unique 23505).
  // Stage initial: insert; 23505 -> CAS update tren row draft/rejected hien co.
  const casUpdate = () =>
    supabase
      .from("year_end_decisions")
      .update({
        kqht: payload.kqht,
        kqrl: payload.kqrl,
        danh_hieu: payload.danh_hieu,
        promotion: payload.promotion,
        override_legal_ground: payload.override_legal_ground,
        override_note: payload.override_note,
        exempt_subject_ids: payload.exempt_subject_ids,
        computed_snapshot: payload.computed_snapshot,
        // r33-3: khong doi status khi chi luu nhap - row 'rejected' phai
        // giu 'rejected' (trigger chan rejected->draft), submit moi
        // chuyen sang 'submitted'.
        ...(submit ? { status: "submitted" } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", input.studentId)
      .eq("academic_year_id", input.academicYearId)
      .eq("stage", input.stage)
      .in("status", ["draft", "rejected"])
      .select("id");

  if (input.stage !== "initial") {
    const { data: upd, error: updErr } = await casUpdate();
    if (updErr) {
      console.error("[hocba] stage update:", updErr.message);
      return { error: updErr.message.includes("invalid status") ? "Trạng thái quyết định không hợp lệ." : "Lỗi hệ thống. Vui lòng thử lại." };
    }
    if (!upd?.length)
      return { error: "Quyết định đã được trình/duyệt bởi phiên khác - tải lại trang." };
  } else {
    const { error: insErr } = await supabase
      .from("year_end_decisions")
      .insert(payload);

    if (insErr && insErr.code !== "23505") {
      console.error("[hocba] insert:", insErr.message);
      return { error: insErr.code === "42501" || insErr.message.includes("policy") ? "Bạn không có quyền ghi quyết định này." : "Lỗi hệ thống. Vui lòng thử lại." };
    }
    // Insert OK (draft moi) hoac 23505 (da ton tai) -> submit qua UPDATE.
    // Luu nhap sau insert thanh cong thi xong luon, khong can update.
    if (insErr?.code === "23505" || submit) {
      const { data: upd, error: updErr } = await casUpdate();
      if (updErr) {
        console.error("[hocba] cas update:", updErr.message);
        return { error: updErr.message.includes("invalid status") || updErr.message.includes("requires") ? "Trạng thái quyết định không hợp lệ." : "Lỗi hệ thống. Vui lòng thử lại." };
      }
      if (!upd?.length)
        return { error: "Quyết định đã được trình/duyệt bởi phiên khác - tải lại trang." };
    }
  }

  const { data: stu, error: stuErr } = await supabase
    .from("students")
    .select("full_name,class_id")
    .eq("id", input.studentId)
    .maybeSingle();
  if (stuErr) console.error("[hocba] student lookup:", stuErr.message);
  const link = `/records/hoc-ba?class=${stu?.class_id ?? ""}&student=${input.studentId}`;
  logAudit(supabase, {
    action: submit ? "hoc_ba.submit" : "hoc_ba.save_draft",
    entity: "year_end_decisions",
    entityId: input.studentId,
    payload: { stage: input.stage, year: input.academicYearId },
  });
  if (submit) {
    await notifyBgh(
      supabase,
      profile.school_id,
      "Học bạ số chờ duyệt",
      `${profile.full_name} đã trình học bạ của ${stu?.full_name ?? "học sinh"}.`,
      link,
    );
  }
  revalidatePath("/records/hoc-ba");
  return {};
}

/** BGH duyệt (+ nhập giay_khen_note cùng lúc nếu có). */
export async function approveYearEnd(input: {
  decisionId: string;
  giayKhenNote?: string | null;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh"]);
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();

  const { data: cur, error: curErr } = await supabase
    .from("year_end_decisions")
    .select("id,status,decided_by,student_id,academic_year_id,kqht,kqrl,danh_hieu,promotion,override_legal_ground,override_note,exempt_subject_ids,students(full_name,class_id)")
    .eq("id", input.decisionId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (curErr) {
    console.error("[hocba] approve lookup:", curErr.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  if (!cur) return { error: "Không tìm thấy quyết định trong trường bạn." };
  if (cur.status !== "submitted")
    return { error: "Quyết định không ở trạng thái chờ duyệt." };

  // r-hb1: duyet la diem kiem soat cuoi - tinh lai tu nguon. Quyet dinh
  // lech goi y ma khong co can cu phap ly + ghi chu (ke ca row duoc ghi
  // truc tiep qua PostgREST bo qua validation cua action) thi khong duyet.
  if (!cur.kqht || !cur.kqrl || !cur.promotion) {
    return { error: "Quyết định thiếu kết quả bắt buộc - trả lại để GVCN trình lại." };
  }
  // r-hb2 F1: mien mon luon can can cu phap ly - ngay ca khi quyet dinh
  // duoc ghi truc tiep, khong cho tap mien "im lang" di qua duyet.
  if (
    cur.exempt_subject_ids?.length &&
    (!cur.override_legal_ground || !cur.override_note?.trim())
  ) {
    return { error: "Quyết định có môn miễn đánh giá nhưng thiếu căn cứ pháp lý - trả lại để GVCN bổ sung." };
  }
  const bundle = await getStudentYearEndBundle(
    cur.student_id,
    cur.academic_year_id,
    cur.exempt_subject_ids ?? undefined,
  );
  if (bundle) {
    const comp = bundle.computed;
    const deviates =
      cur.kqht !== comp.kqht.value ||
      cur.kqrl !== comp.kqrl.value ||
      cur.danh_hieu !== comp.danhHieu ||
      cur.promotion !== comp.promotion.value;
    if (deviates && (!cur.override_legal_ground || !cur.override_note?.trim())) {
      return { error: "Quyết định lệch gợi ý hệ thống nhưng thiếu căn cứ pháp lý - trả lại để GVCN bổ sung." };
    }
  }

  const patch: Record<string, unknown> = { status: "approved" };
  if (input.giayKhenNote != null) patch.giay_khen_note = input.giayKhenNote.trim() || null;
  const { data: upd, error } = await supabase
    .from("year_end_decisions")
    .update(patch)
    .eq("id", input.decisionId)
    .eq("status", "submitted") // CAS
    .select("id");
  if (error) {
    console.error("[hocba] approve:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  if (!upd?.length)
    return { error: "Quyết định đã thay đổi trạng thái - tải lại trang." };

  const stu = cur.students as unknown as { full_name: string; class_id: string } | null;
  const link = `/records/hoc-ba?class=${stu?.class_id ?? ""}&student=${cur.student_id}`;
  // r-hb4: trigger trg_yed_submit_guard da ghi hoc_ba.approve vao
  // audit_logs cung transaction - action khong ghi trung nua.
  if (cur.decided_by) {
    await notifyGvcn(
      supabase,
      cur.decided_by,
      "Học bạ số đã được duyệt",
      `BGH đã duyệt học bạ của ${stu?.full_name ?? "học sinh"}.`,
      link,
    );
  }
  revalidatePath("/records/hoc-ba");
  return {};
}

/** BGH trả lại - bat buoc ly do >=10 ky tu. */
export async function rejectYearEnd(input: {
  decisionId: string;
  rejectReason: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh"]);
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const reason = input.rejectReason.trim();
  if (reason.length < 10) return { error: "Lý do trả lại bắt buộc (tối thiểu 10 ký tự)." };
  const supabase = await createClient();

  const { data: cur, error: curErr } = await supabase
    .from("year_end_decisions")
    .select("id,status,decided_by,student_id,students(full_name,class_id)")
    .eq("id", input.decisionId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (curErr || !cur) return { error: curErr ? "Lỗi hệ thống. Vui lòng thử lại." : "Không tìm thấy quyết định trong trường bạn." };
  if (cur.status !== "submitted")
    return { error: "Quyết định không ở trạng thái chờ duyệt." };

  const { data: upd, error } = await supabase
    .from("year_end_decisions")
    .update({ status: "rejected", reject_reason: reason })
    .eq("id", input.decisionId)
    .eq("status", "submitted") // CAS
    .select("id");
  if (error) {
    console.error("[hocba] reject:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  if (!upd?.length)
    return { error: "Quyết định đã thay đổi trạng thái - tải lại trang." };

  const stu = cur.students as unknown as { full_name: string; class_id: string } | null;
  const link = `/records/hoc-ba?class=${stu?.class_id ?? ""}&student=${cur.student_id}`;
  logAudit(supabase, {
    action: "hoc_ba.reject",
    entity: "year_end_decisions",
    entityId: input.decisionId,
    payload: { reason: reason.slice(0, 200) },
  });
  if (cur.decided_by) {
    await notifyGvcn(
      supabase,
      cur.decided_by,
      "Học bạ số bị trả lại",
      `BGH trả lại học bạ của ${stu?.full_name ?? "học sinh"}: ${reason.slice(0, 120)}`,
      link,
    );
  }
  revalidatePath("/records/hoc-ba");
  return {};
}

/** GVCN tạo quyết định stage sau (after_retest / after_summer) - trigger
 *  DB enforce prerequisite; ở đây fail-fast cho UX. */
export async function createNextStage(input: {
  studentId: string;
  academicYearId: string;
  stage: "after_retest" | "after_summer";
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["gvcn"]);
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const own = await verifyGvcnOwns(input.studentId);
  if (own.error) return { error: own.error };
  const supabase = await createClient();
  // r-hb4: ke thua tap mien tu quyet dinh truoc - mon mien danh gia theo
  // HOC SINH khong theo stage; draft moi mang [] nghia la "da xoa".
  const { data: prev, error: prevErr } = await supabase
    .from("year_end_decisions")
    .select("exempt_subject_ids")
    .eq("student_id", input.studentId)
    .eq("academic_year_id", input.academicYearId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prevErr) return { error: `Không đọc được miễn môn trước đó: ${prevErr.message}` };
  const { error } = await supabase.from("year_end_decisions").insert({
    student_id: input.studentId,
    school_id: profile.school_id,
    academic_year_id: input.academicYearId,
    stage: input.stage,
    status: "draft",
    exempt_subject_ids: prev?.exempt_subject_ids ?? [],
  });
  if (error) {
    if (error.code === "23505") return { error: "Quyết định giai đoạn này đã tồn tại." };
    if (error.message.includes("requires"))
      return { error: "Chưa đủ điều kiện tạo giai đoạn này (cần quyết định trước đã duyệt với kết quả phù hợp)." };
    console.error("[hocba] next stage:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  revalidatePath("/records/hoc-ba");
  return {};
}

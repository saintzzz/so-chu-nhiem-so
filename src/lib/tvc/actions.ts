"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";
import { ensureTvcProfile } from "@/lib/tvc/profile";
import { validateQuestion } from "@/lib/tvc/question-validate";
import type { DocContent, MaterialType } from "@/types/tvc";

/**
 * CR-023: Module "Công cụ số giáo viên" (port từ TVC360) trong SCN.
 * Vai trò được dùng công cụ: GV bộ môn, GVCN, tổ trưởng, BGH, admin.
 * Dữ liệu nằm trong schema `tvc` (bảng alias `tvc_*`) - chung project Supabase
 * với app TVC360 độc lập; owner_id = auth.users.id nên dùng chung được.
 */
const TOOL_ROLES = ["gvcn", "gvbm", "to_truong", "bgh", "admin"] as const;
/** Quản lý YCCĐ của trường: tổ trưởng/BGH/admin (GV vẫn xem + dùng). */
const STD_ADMIN_ROLES = ["to_truong", "bgh", "admin"] as const;



async function audit(
  action: string,
  entity: string,
  entityId: string,
  meta: Record<string, unknown> = {},
) {
  const profile = await getProfile();
  const supabase = await createClient();
  await supabase.from("tvc_audit_logs").insert({
    actor_id: profile?.id ?? null,
    action,
    entity,
    entity_id: entityId,
    meta,
  });
}

// ---------- Materials (sản phẩm các công cụ sinh ra) ----------

export interface SaveMaterialInput {
  title: string;
  type: MaterialType;
  toolCode: string;
  subjectCode: string | null;
  grade: number | null;
  standardIds: string[];
  content: DocContent;
  aiContent?: DocContent | null;
  aiUsage: "none" | "partial" | "full";
  originNote?: string;
  matrix?: {
    cells: unknown[];
    spec: unknown[];
    framework?: string;
    durationMin?: number;
    totalPoints?: number;
  };
}

export async function saveMaterial(input: SaveMaterialInput) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  const profile = (await getProfile())!;
  const supabase = await createClient();
  await ensureTvcProfile();

  let matrixId: string | null = null;
  if (input.type === "matrix" && input.matrix) {
    const { data: m, error: mErr } = await supabase
      .from("tvc_matrices")
      .insert({
        owner_id: profile.id,
        title: input.title,
        subject_code: input.subjectCode,
        grade: input.grade,
        framework: input.matrix.framework ?? "CV 7991",
        total_points: input.matrix.totalPoints ?? 10,
        duration_min: input.matrix.durationMin ?? 45,
        cells: input.matrix.cells,
        spec: input.matrix.spec,
      })
      .select("id")
      .single();
    if (mErr) return { error: "Không lưu được ma trận." };
    matrixId = m.id;
  }

  const { data, error } = await supabase
    .from("tvc_materials")
    .insert({
      author_id: profile.id,
      type: input.type,
      tool_code: input.toolCode,
      title: input.title,
      subject_code: input.subjectCode,
      grade: input.grade,
      standard_ids: input.standardIds,
      content: input.content,
      ai_content: input.aiContent ?? null,
      status: "personal",
      ai_usage: input.aiUsage,
      origin_note: input.originNote ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: "Không lưu được học liệu." };
  await audit("material.create", "material", data.id, { tool: input.toolCode });
  revalidatePath("/studio/library");
  return { id: data.id, matrixId };
}

export async function updateMaterialContent(
  id: string,
  content: DocContent,
  title?: string,
) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  const profile = (await getProfile())!;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tvc_materials")
    .update({
      content,
      ...(title ? { title } : {}),
      ai_usage: "partial",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("author_id", profile.id)
    .select("id");
  if (error || !data?.length) return { error: "Không cập nhật được." };
  revalidatePath(`/studio/library/${id}`);
  return { ok: true };
}

export async function deleteMaterial(id: string) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  const profile = (await getProfile())!;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tvc_materials")
    .delete()
    .eq("id", id)
    .eq("author_id", profile.id)
    .in("status", ["personal", "draft", "rejected", "withdrawn"])
    .select("id");
  if (error || !data?.length) return { error: "Không xóa được." };
  await audit("material.delete", "material", id);
  revalidatePath("/studio/library");
  return { ok: true };
}

// ---------- Ngân hàng câu hỏi (DC-04) ----------

// Ma cau hoi theo nguyen tac FPT: <ma YCCD>-<D|F|S|E><seq 2 so>
const QTYPE_LETTER: Record<string, string> = {
  multiple_choice: "D",
  true_false_4: "F",
  short_answer: "S",
  essay: "E",
};

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function allocateQuestionCodes(
  supabase: SupabaseLike,
  ownerId: string,
  items: { standardIds: string[]; qtype: string }[],
): Promise<(string | null)[]> {
  const [{ data: stds }, { data: existing }] = await Promise.all([
    supabase.from("tvc_curriculum_standards").select("id,code"),
    supabase
      .from("tvc_questions")
      .select("code")
      .eq("owner_id", ownerId)
      .not("code", "is", null),
  ]);
  const codeById = new Map(
    ((stds ?? []) as { id: string; code: string }[]).map((s) => [s.id, s.code]),
  );
  const taken = new Set(
    ((existing ?? []) as { code: string | null }[])
      .map((r) => r.code)
      .filter((c): c is string => Boolean(c)),
  );
  const nextSeq = new Map<string, number>();
  return items.map((it) => {
    const stdCode = it.standardIds[0] ? codeById.get(it.standardIds[0]) : null;
    if (!stdCode) return null;
    const prefix = `${stdCode}-${QTYPE_LETTER[it.qtype] ?? "D"}`;
    let seq = nextSeq.get(prefix);
    if (seq === undefined) {
      seq = 0;
      for (const c of taken) {
        if (c.startsWith(prefix)) {
          const n = Number.parseInt(c.slice(prefix.length), 10);
          if (Number.isFinite(n) && n > seq) seq = n;
        }
      }
    }
    let code: string;
    do {
      seq += 1;
      code = `${prefix}${String(seq).padStart(2, "0")}`;
    } while (taken.has(code));
    taken.add(code);
    nextSeq.set(prefix, seq);
    return code;
  });
}

export interface SaveQuestionInput {
  id?: string;
  stem: string;
  context?: string;
  qtype: string;
  level: string;
  points: number;
  answer: Record<string, unknown>;
  solution?: string;
  standardIds: string[];
  subjectCode?: string;
  grade?: number;
}

export async function saveQuestion(input: SaveQuestionInput) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  const vErrs = validateQuestion(input);
  if (vErrs.length) return { error: vErrs.join(" ") };
  const profile = (await getProfile())!;
  const supabase = await createClient();
  await ensureTvcProfile();
  // Cap nhat: RLS cho phep owner hoac to_truong/bgh/admin cung truong.
  if (input.id) {
    const { data, error } = await supabase
      .from("tvc_questions")
      .update({
        stem: input.stem,
        context: input.context?.trim() || null,
        qtype: input.qtype,
        level: input.level,
        points: input.points,
        answer: input.answer,
        solution: input.solution ?? null,
        standard_ids: input.standardIds,
        subject_code: input.subjectCode ?? null,
        grade: input.grade ?? null,
      })
      .eq("id", input.id)
      .select("id");
    if (error || !data?.length)
      return { error: "Không lưu được (quyền: chủ sở hữu hoặc tổ trưởng/BGH cùng trường)." };
    await audit("questions.update", "questions", input.id, {});
    revalidatePath("/studio/questions");
    return { ok: true };
  }
  const [code] = await allocateQuestionCodes(supabase, profile.id, [input]);
  const { error } = await supabase.from("tvc_questions").insert({
    owner_id: profile.id,
    school_id: profile.school_id ?? null,
    code,
    stem: input.stem,
    context: input.context?.trim() || null,
    qtype: input.qtype,
    level: input.level,
    points: input.points,
    answer: input.answer,
    solution: input.solution ?? null,
    standard_ids: input.standardIds,
    subject_code: input.subjectCode ?? null,
    grade: input.grade ?? null,
    source: "manual",
  });
  if (error) return { error: "Không lưu được câu hỏi." };
  revalidatePath("/studio/questions");
  return { ok: true };
}

export async function deleteQuestion(id: string) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  const supabase = await createClient();
  // RLS: owner hoac to_truong/bgh/admin cung truong
  const { data, error } = await supabase
    .from("tvc_questions")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "Không xóa được." };
  revalidatePath("/studio/questions");
  return { ok: true };
}

const QUESTION_LIST_COLS =
  "id, owner_id, code, stem, qtype, level, points, standard_ids, subject_code, grade, source, review_state, created_at";

export async function setQuestionReviewState(
  id: string,
  state: "unreviewed" | "approved" | "flagged",
) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  const supabase = await createClient();
  // RLS: owner tu duyet cau minh; to_truong/bgh/admin duyet cau cung truong
  const { data, error } = await supabase
    .from("tvc_questions")
    .update({ review_state: state })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "Không cập nhật được trạng thái." };
  await audit("questions.review", "questions", id, { state });
  return { ok: true };
}

export async function bulkSetQuestionReviewState(
  ids: string[],
  state: "unreviewed" | "approved" | "flagged",
) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  if (!ids.length) return { error: "Chưa chọn câu hỏi." };
  if (ids.length > 200) return { error: "Mỗi lần tối đa 200 câu." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tvc_questions")
    .update({ review_state: state })
    .in("id", ids)
    .select("id");
  if (error) return { error: error.message };
  const n = data?.length ?? 0;
  if (!n) return { error: "Không cập nhật được (quyền sở hữu)." };
  const profile = await getProfile();
  await supabase.from("tvc_audit_logs").insert({
    actor_id: profile?.id ?? null,
    action: `question.bulk_${state}`,
    entity: "question",
    entity_id: null,
    meta: { count: n },
  });
  return { ok: true, count: n };
}

export async function listQuestionsChunk(offset: number) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tvc_questions")
    .select(QUESTION_LIST_COLS)
    .order("created_at", { ascending: false })
    .range(offset, offset + 999);
  if (error) return { error: "Không tải được câu hỏi." };
  return { rows: data ?? [] };
}

export async function getQuestionDetail(id: string) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  const supabase = await createClient();
  // RLS: doc cau hoi cung truong
  const { data, error } = await supabase
    .from("tvc_questions")
    .select("answer, solution, context")
    .eq("id", id)
    .single();
  if (error || !data) return { error: "Không tải được chi tiết câu hỏi." };
  return {
    answer: data.answer as Record<string, unknown>,
    solution: data.solution as string | null,
    context: data.context as string | null,
  };
}

export async function importQuestions(rows: SaveQuestionInput[]) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  const profile = (await getProfile())!;
  const skipped: string[] = [];
  const valid = rows.filter((r, i) => {
    const errs = validateQuestion(r);
    if (errs.length) skipped.push(`Dòng ${i + 1}: ${errs.join(" ")}`);
    return !errs.length;
  });
  if (!valid.length)
    return {
      error: `Tất cả ${rows.length} dòng đều lỗi. ${skipped.slice(0, 3).join(" | ")}`,
    };
  const supabase = await createClient();
  await ensureTvcProfile();
  const codes = await allocateQuestionCodes(supabase, profile.id, valid);
  const { error } = await supabase.from("tvc_questions").insert(
    valid.map((r, i) => ({
      owner_id: profile.id,
      code: codes[i],
      stem: r.stem,
      context: r.context?.trim() || null,
      qtype: r.qtype,
      level: r.level,
      points: r.points,
      answer: r.answer,
      solution: r.solution ?? null,
      standard_ids: r.standardIds,
      subject_code: r.subjectCode ?? null,
      grade: r.grade ?? null,
      source: "imported" as const,
    })),
  );
  if (error) return { error: "Import thất bại - kiểm tra template." };
  await audit("questions.import", "questions", "batch", {
    count: valid.length,
    skipped: skipped.length,
  });
  revalidatePath("/studio/questions");
  return { ok: true, count: valid.length, skipped };
}

// ---------- Kho ngữ liệu (V-01) ----------

export interface ImportLiteratureInput {
  title: string;
  author?: string;
  text_type: string;
  difficulty: number;
  topics: string[];
  grade_min: number;
  grade_max: number;
  content: string;
  license_note?: string;
}

export async function importLiterature(rows: ImportLiteratureInput[]) {
  const err = await checkActionRole([...TOOL_ROLES]);
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("tvc_literature_texts").insert(
    rows.map((r) => ({
      title: r.title,
      author: r.author || null,
      text_type: r.text_type || "Văn bản",
      difficulty: r.difficulty || 2,
      topics: r.topics,
      grade_min: r.grade_min || 1,
      grade_max: r.grade_max || 5,
      content: r.content,
      license_note:
        r.license_note ||
        "Ngữ liệu do giáo viên cung cấp - cần rà soát quyền trước khi xuất bản",
      source: "licensed" as const,
      standard_ids: [],
    })),
  );
  if (error) return { error: "Import thất bại - kiểm tra template." };
  await audit("literature.import", "literature_texts", "batch", {
    count: rows.length,
  });
  revalidatePath("/studio/literature");
  return { ok: true, count: rows.length };
}

// ---------- YCCĐ theo trường (CR-023) ----------

export interface SaveStandardInput {
  id?: string; // co id = sua, khong co = them moi
  code: string;
  subject_code: string;
  grade: number;
  strand: string;
  lesson_ref?: string;
  description: string;
  competencies?: string[];
}

export async function saveStandard(input: SaveStandardInput) {
  const err = await checkActionRole([...STD_ADMIN_ROLES]);
  if (err) return { error: err };
  const profile = (await getProfile())!;
  if (!profile.school_id) return { error: "Tài khoản chưa gắn trường." };
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]+(\.[0-9A-Z]+)+$/.test(code) || code.length > 30)
    return { error: "Mã YCCĐ không hợp lệ (vd: TOAN3.1.2)." };
  if (input.description.trim().length < 10)
    return { error: "Mô tả YCCĐ quá ngắn." };
  if (input.grade < 1 || input.grade > 12)
    return { error: "Khối lớp không hợp lệ." };

  const supabase = await createClient();
  const row = {
    code,
    subject_code: input.subject_code,
    grade: input.grade,
    strand: input.strand.trim(),
    lesson_ref: input.lesson_ref?.trim() || "",
    description: input.description.trim(),
    competencies: input.competencies ?? [],
    version: "2025-2026",
    status: "active",
    prerequisite_ids: [],
    school_id: profile.school_id,
  };
  const q = input.id
    ? supabase
        .from("tvc_curriculum_standards")
        .update(row)
        .eq("id", input.id)
        .eq("school_id", profile.school_id)
        .select("id")
    : supabase.from("tvc_curriculum_standards").insert(row).select("id");
  const { data, error } = await q;
  if (error)
    return {
      error: error.message.includes("duplicate")
        ? "Mã YCCĐ đã tồn tại."
        : "Không lưu được YCCĐ.",
    };
  if (input.id && !data?.length) return { error: "Không tìm thấy YCCĐ của trường." };
  await audit("standards.save", "curriculum_standards", code, {
    school: profile.school_id,
  });
  revalidatePath("/studio/yccd");
  return { ok: true };
}

export async function deleteStandard(id: string) {
  const err = await checkActionRole([...STD_ADMIN_ROLES]);
  if (err) return { error: err };
  const profile = (await getProfile())!;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tvc_curriculum_standards")
    .delete()
    .eq("id", id)
    .eq("school_id", profile.school_id ?? "")
    .select("id");
  if (error || !data?.length) return { error: "Không xóa được." };
  await audit("standards.delete", "curriculum_standards", id);
  revalidatePath("/studio/yccd");
  return { ok: true };
}

export async function toggleStandardStatus(id: string, active: boolean) {
  const err = await checkActionRole([...STD_ADMIN_ROLES]);
  if (err) return { error: err };
  const profile = (await getProfile())!;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tvc_curriculum_standards")
    .update({ status: active ? "active" : "inactive" })
    .eq("id", id)
    .eq("school_id", profile.school_id ?? "")
    .select("id");
  if (error || !data?.length) return { error: "Không cập nhật được." };
  revalidatePath("/studio/yccd");
  return { ok: true };
}

// ---------- CR-026: Biểu mẫu KHBD theo trường ----------
export interface KhbdActivityInput {
  name: string;
  minutes?: number;
  hint?: string;
}

export async function saveKhbdTemplate(input: {
  id?: string;
  name: string;
  activities: KhbdActivityInput[];
  include_review: boolean;
  include_signoff: boolean;
  is_default?: boolean;
}) {
  const err = await checkActionRole([...STD_ADMIN_ROLES]);
  if (err) return { error: err };
  const profile = (await getProfile())!;
  if (!profile.school_id) return { error: "Tài khoản chưa gắn trường." };
  const acts = (input.activities ?? [])
    .map((a) => ({
      name: String(a.name ?? "").trim(),
      minutes: Number(a.minutes) || undefined,
      hint: String(a.hint ?? "").trim() || undefined,
    }))
    .filter((a) => a.name);
  if (!input.name.trim()) return { error: "Chưa nhập tên biểu mẫu." };
  if (!acts.length) return { error: "Biểu mẫu cần ít nhất 1 hoạt động." };
  await ensureTvcProfile();

  const supabase = await createClient();
  // Chi 1 mac dinh moi truong: dat mac dinh -> bo mac dinh cac mau truong khac
  if (input.is_default) {
    await supabase
      .from("tvc_khbd_templates")
      .update({ is_default: false })
      .eq("school_id", profile.school_id)
      .eq("is_default", true)
      .neq("id", input.id ?? "00000000-0000-0000-0000-000000000000");
  }
  const row = {
    name: input.name.trim(),
    activities: acts,
    include_review: input.include_review,
    include_signoff: input.include_signoff,
    is_default: !!input.is_default,
    school_id: profile.school_id,
  };
  const q = input.id
    ? supabase
        .from("tvc_khbd_templates")
        .update(row)
        .eq("id", input.id)
        .eq("school_id", profile.school_id)
        .select("id")
    : supabase
        .from("tvc_khbd_templates")
        .insert({ ...row, created_by: profile.id })
        .select("id");
  const { data, error } = await q;
  if (error || !data?.length)
    return { error: error?.message ?? "Không lưu được biểu mẫu." };
  await audit(
    input.id ? "khbd_template.update" : "khbd_template.create",
    "khbd_templates",
    data[0].id,
  );
  revalidatePath("/studio/mau-khbd");
  return { ok: true, id: data[0].id };
}

export async function deleteKhbdTemplate(id: string) {
  const err = await checkActionRole([...STD_ADMIN_ROLES]);
  if (err) return { error: err };
  const profile = (await getProfile())!;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tvc_khbd_templates")
    .delete()
    .eq("id", id)
    .eq("school_id", profile.school_id ?? "")
    .select("id");
  if (error || !data?.length) return { error: "Không xóa được." };
  await audit("khbd_template.delete", "khbd_templates", id);
  revalidatePath("/studio/mau-khbd");
  return { ok: true };
}

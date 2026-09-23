"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export interface StudentRecordPatch {
  full_name?: string;
  code?: string;
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  national_id?: string | null;
}

const EDITABLE = [
  "full_name",
  "code",
  "dob",
  "gender",
  "address",
  "national_id",
] as const;

const FIELD_LABEL: Record<string, string> = {
  full_name: "Họ tên",
  code: "Mã HS",
  dob: "Ngày sinh",
  gender: "Giới tính",
  address: "Địa chỉ",
  national_id: "Mã định danh",
};

/**
 * Sua ho so hoc sinh truc tiep tren giao dien.
 * GVCN: chi HS lop chu nhiem minh. BGH: HS toan truong.
 * Moi truong thay doi ghi 1 dong student_record_history + audit log.
 */
export async function updateStudentRecord(
  studentId: string,
  patch: StudentRecordPatch,
): Promise<{ updated: number; error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { updated: 0, error: deny };
  const profile = await getProfile();
  if (!profile?.school_id) return { updated: 0, error: "Thiếu hồ sơ trường." };

  const supabase = await createClient();
  const { data: st, error: stErr } = await supabase
    .from("students")
    .select(
      "id,class_id,full_name,code,dob,gender,address,national_id,classes!inner(school_id,gvcn_id)",
    )
    .eq("id", studentId)
    .single();
  if (stErr || !st) return { updated: 0, error: "Không tìm thấy học sinh." };

  const cls = Array.isArray(st.classes) ? st.classes[0] : st.classes;
  if (!cls || cls.school_id !== profile.school_id) {
    return { updated: 0, error: "Học sinh không thuộc trường của bạn." };
  }
  if (profile.role === "gvcn" && cls.gvcn_id !== profile.id) {
    return {
      updated: 0,
      error: "Chỉ được sửa hồ sơ học sinh lớp bạn chủ nhiệm.",
    };
  }

  // Diff - chi giu truong thay doi
  const cur = st as unknown as Record<string, string | null>;
  const changed: Record<string, string | null> = {};
  for (const f of EDITABLE) {
    const next = patch[f] === undefined ? undefined : (patch[f] ?? null);
    if (next === undefined) continue;
    const nv = typeof next === "string" ? next.trim() || null : next;
    if (nv !== (cur[f] ?? null)) changed[f] = nv;
  }
  if (Object.keys(changed).length === 0) {
    return { updated: 0, error: "Không có thay đổi nào." };
  }

  if (changed.full_name === null || changed.full_name === "") {
    return { updated: 0, error: "Họ tên không được để trống." };
  }
  if (changed.code === null || changed.code === "") {
    return { updated: 0, error: "Mã học sinh không được để trống." };
  }
  if (changed.national_id && !/^\d{10}$/.test(changed.national_id)) {
    return { updated: 0, error: "Mã định danh phải gồm đúng 10 chữ số." };
  }

  const { error: upErr } = await supabase
    .from("students")
    .update(changed)
    .eq("id", studentId);
  if (upErr) return { updated: 0, error: upErr.message };

  // Lich su tung truong - tab "Lich su cap nhat ho so" doc bang nay.
  const history = Object.entries(changed).map(([field, nv]) => ({
    student_id: studentId,
    changed_by: profile.id,
    field,
    old_value: cur[field] ?? null,
    new_value: nv,
  }));
  await supabase.from("student_record_history").insert(history);

  logAudit(supabase, {
    action: "Sửa hồ sơ học sinh",
    entity: "students",
    entityId: studentId,
    payload: {
      fields: Object.keys(changed).map((f) => FIELD_LABEL[f] ?? f),
    },
  });

  revalidatePath("/records/students");
  revalidatePath("/register/roster");
  return { updated: Object.keys(changed).length };
}

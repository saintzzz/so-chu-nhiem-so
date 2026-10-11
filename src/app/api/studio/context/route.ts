import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasAnyRole } from "@/lib/roles";
import type { Role } from "@/types";

const TOOL_ROLES: Role[] = ["gvcn", "gvbm", "to_truong", "bgh", "admin"];

/** GET /api/studio/context?kind=subjects|grades|standards|matrices&subject=&grade= */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId)
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role,concurrent_roles")
    .eq("id", userId)
    .single();
  if (!profile || !hasAnyRole(profile, TOOL_ROLES))
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });


  // r16 L: loi doc nguon khong duoc bien thanh list rong - chi tra []
  // khi query thanh cong va thuc su khong co du lieu.
  const srcFail = (label: string, err: { message: string } | null) => {
    if (!err) return null;
    console.error(`[studio/context] ${label}:`, err.message);
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn." },
      { status: 500 },
    );
  };

  const kind = req.nextUrl.searchParams.get("kind");
  const subject = req.nextUrl.searchParams.get("subject");
  const grade = req.nextUrl.searchParams.get("grade");

  if (kind === "subjects") {
    const { data, error } = await supabase
      .from("tvc_subjects")
      .select("*")
      .order("code");
    const f = srcFail("subjects", error);
    if (f) return f;
    return NextResponse.json({ data: data ?? [] });
  }

  if (kind === "grades") {
    if (subject) {
      const { data, error } = await supabase
        .from("tvc_subjects")
        .select("grade_min, grade_max")
        .eq("code", subject)
        .single();
      const f = srcFail("grades", error?.code === "PGRST116" ? null : error);
      if (f) return f;
      if (!data) {
        return NextResponse.json(
          { error: "Không tìm thấy môn học." },
          { status: 404 },
        );
      }
      const list = Array.from(
        { length: data.grade_max - data.grade_min + 1 },
        (_, i) => data.grade_min + i,
      );
      return NextResponse.json({ data: list });
    }
    return NextResponse.json({
      data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    });
  }

  if (kind === "standards") {
    let q = supabase
      .from("tvc_curriculum_standards")
      .select("id, code, subject_code, grade, strand, lesson_ref, description, school_id, status")
      .order("grade")
      .order("code");
    if (req.nextUrl.searchParams.get("all_status") !== "1")
      q = q.eq("status", "active");
    if (subject) q = q.eq("subject_code", subject);
    if (grade) q = q.eq("grade", Number(grade));
    const { data, error } = await q.limit(500);
    const f = srcFail("standards", error);
    if (f) return f;
    return NextResponse.json({ data: data ?? [] });
  }

  if (kind === "matrices") {
    const { data, error } = await supabase
      .from("tvc_matrices")
      .select(
        "id, title, subject_code, grade, total_points, duration_min, created_at",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const f = srcFail("matrices", error);
    if (f) return f;
    return NextResponse.json({ data: data ?? [] });
  }

  // DC-06 (CR-044): chon KHBD da luu lam nguon sinh slide ngay trong form
  if (kind === "lesson_plans") {
    const { data, error } = await supabase
      .from("tvc_materials")
      .select("id, title, subject_code, grade, standard_ids")
      .eq("type", "lesson_plan")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const f = srcFail("lesson_plans", error);
    if (f) return f;
    return NextResponse.json({ data: data ?? [] });
  }

  if (kind === "khbd_templates") {
    const { data, error } = await supabase
      .from("tvc_khbd_templates")
      .select("id, name, activities, include_review, include_signoff, is_default, school_id")
      .order("is_default", { ascending: false })
      .order("name");
    const f = srcFail("khbd_templates", error);
    if (f) return f;
    return NextResponse.json({ data: data ?? [] });
  }

  return NextResponse.json({ error: "kind không hợp lệ." }, { status: 400 });
}

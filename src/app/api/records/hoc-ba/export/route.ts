import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { must } from "@/lib/supabase/must";
import {
  getStudentYearEndBundle,
  getClassYearEndBundles,
} from "@/lib/hocba";
import { buildHocBaModel, hocBaDocx } from "@/lib/hocba-docx";
import { hocBaPdf } from "@/lib/hocba-pdf";
import { sortByVietnameseName } from "@/lib/utils";

/**
 * GET /api/records/hoc-ba/export?format=docx|pdf&student=<id>
 * GET /api/records/hoc-ba/export?format=docx|pdf&class=<id>   (BGH only)
 * Export chi gvcn lop minh + bgh; pht/so_gd/ubnd/con lai -> 403.
 */
export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const canExport = hasRole(profile, "gvcn") || hasRole(profile, "bgh");
  if (!canExport) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") ?? "docx";
  if (format !== "docx" && format !== "pdf") {
    return NextResponse.json({ error: "invalid format" }, { status: 400 });
  }
  const studentId = sp.get("student");
  const classId = sp.get("class");
  if (!studentId && !classId) {
    return NextResponse.json({ error: "missing student or class" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    if (classId) {
      // Export ca lop - BGH only (design rev2).
      if (!hasRole(profile, "bgh")) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      const { data: cls } = await must(
        supabase
          .from("classes")
          .select("id,name,school_id,academic_year_id,schools(name),academic_years(name)")
          .eq("id", classId)
          .maybeSingle(),
        "export/class",
      );
      if (!cls || (cls.school_id as string) !== profile.school_id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      const c = cls as unknown as { name: string; schools: { name: string } | null; academic_years: { name: string } | null };
      const { bundles } = await getClassYearEndBundles(classId);
      const models = sortByVietnameseName(bundles, (b) => b.student.full_name).map((b) =>
        buildHocBaModel(b, {
          schoolName: c.schools?.name ?? "",
          className: c.name,
          yearName: c.academic_years?.name ?? "",
        }),
      );
      return fileResponse(models, format, `hoc-ba-${c.name}`);
    }

    // Export 1 HS
    const { data: stu } = await must(
      supabase
        .from("students")
        .select("id,class_id,classes(name,school_id,academic_year_id,gvcn_id,schools(name),academic_years(name))")
        .eq("id", studentId!)
        .maybeSingle(),
      "export/student",
    );
    if (!stu) return NextResponse.json({ error: "not found" }, { status: 404 });
    const cls = (stu as unknown as { classes: {
      name: string; school_id: string; academic_year_id: string | null;
      gvcn_id: string | null;
      schools: { name: string } | null; academic_years: { name: string } | null;
    } }).classes;
    const ok = hasRole(profile, "bgh")
      ? cls.school_id === profile.school_id
      : cls.gvcn_id === profile.id;
    if (!ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!cls.academic_year_id) {
      return NextResponse.json({ error: "class missing academic year" }, { status: 422 });
    }
    const bundle = await getStudentYearEndBundle(studentId!, cls.academic_year_id);
    if (!bundle) return NextResponse.json({ error: "not found" }, { status: 404 });
    const models = [
      buildHocBaModel(bundle, {
        schoolName: cls.schools?.name ?? "",
        className: cls.name,
        yearName: cls.academic_years?.name ?? "",
      }),
    ];
    return fileResponse(models, format, `hoc-ba-${bundle.student.code ?? studentId}`);
  } catch (e) {
    console.error("[hocba/export]", e);
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }
}

async function fileResponse(
  models: ReturnType<typeof buildHocBaModel>[],
  format: "docx" | "pdf",
  name: string,
) {
  const buf = format === "docx" ? await hocBaDocx(models) : await hocBaPdf(models);
  const mime =
    format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}.${format}"`,
    },
  });
}

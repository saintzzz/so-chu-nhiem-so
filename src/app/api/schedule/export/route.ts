import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { hasRole } from "@/lib/roles";

// CR-073: TKB export CSV per lop (bgh/pht) - deterministic, UTF-8 BOM
// cho Excel VN.
export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasRole(profile, "bgh") && !hasRole(profile, "pht"))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const classId = req.nextUrl.searchParams.get("class");
  if (!classId) return NextResponse.json({ error: "missing class" }, { status: 400 });
  const supabase = await createClient();
  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id,name,school_id")
    .eq("id", classId)
    .maybeSingle();
  if (clsErr) {
    console.error("[schedule/export] classes:", clsErr.message);
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }
  if (!cls || cls.school_id !== profile.school_id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: entries, error } = await supabase
    .from("timetable_entries")
    .select("weekday,period,room,subject_id,teacher_id,subjects(name)")
    .eq("class_id", classId)
    .order("weekday")
    .order("period");
  if (error) {
    console.error("[schedule/export]", error.message);
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }
  const teacherIds = [...new Set((entries ?? []).map((e) => e.teacher_id).filter(Boolean))] as string[];
  // bounded-ok: teacherIds la GV day trong 1 lop (<= so tiet/tuan ~40)
  const { data: teachers, error: teaErr } = teacherIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", teacherIds)
    : { data: [], error: null };
  if (teaErr) {
    console.error("[schedule/export] teachers:", teaErr.message);
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }
  const teaName = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));
  const esc = (s: string | null) => `"${(s ?? "").replace(/"/g, '""')}"`;
  const rows = (entries ?? []).map((e) => {
    const st = Array.isArray(e.subjects) ? e.subjects[0] : e.subjects;
    return [
      e.weekday, e.period,
      esc(st?.name ?? ""), esc(e.teacher_id ? teaName.get(e.teacher_id) ?? "" : ""), esc(e.room),
    ].join(",");
  });
  const csv = "﻿Thu,Tiet,Mon,Giao_vien,Phong\n" + rows.join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tkb-${encodeURIComponent(cls.name)}.csv"`,
    },
  });
}

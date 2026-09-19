"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";

interface ClassRow {
  id: string;
  name: string;
  grade: number;
  gvcn_id: string | null;
}
interface TeacherRow {
  id: string;
  full_name: string;
  role: string;
}
interface SubjectRow {
  id: string;
  name: string;
}
interface Pair {
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  gvcn: "GVCN",
  gvbm: "GVBM",
  to_truong: "Tổ trưởng",
};

export function AssignmentsBoard({
  classes,
  teachers,
  subjects,
  teacherSubjects,
  pairs,
}: {
  classes: ClassRow[];
  teachers: TeacherRow[];
  subjects: SubjectRow[];
  teacherSubjects: { teacher_id: string; subject_id: string }[];
  pairs: Pair[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Homeroom assignment ---
  const [gvcnDraft, setGvcnDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(classes.map((c) => [c.id, c.gvcn_id ?? ""])),
  );

  // --- Teacher subjects (qualifications) ---
  const [tsDraft, setTsDraft] = useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {};
    for (const t of teacherSubjects) {
      m[t.teacher_id] = m[t.teacher_id] ?? new Set();
      m[t.teacher_id].add(t.subject_id);
    }
    return m;
  });
  const [tsTeacher, setTsTeacher] = useState(teachers[0]?.id ?? "");

  // --- Teaching assignment grid ---
  const [gridClass, setGridClass] = useState(classes[0]?.id ?? "");
  const [gridDraft, setGridDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(pairs.map((p) => [`${p.class_id}|${p.subject_id}`, p.teacher_id ?? ""])),
  );

  const teacherName = useMemo(
    () => new Map(teachers.map((t) => [t.id, t.full_name])),
    [teachers],
  );
  const qualified = (subjectId: string) =>
    teachers.filter(
      (t) => tsDraft[t.id]?.has(subjectId) || t.role !== "gvbm",
    );

  function flash(ok: boolean, msg: string) {
    if (ok) {
      setMessage(msg);
      setError(null);
      router.refresh();
    } else {
      setError(msg);
      setMessage(null);
    }
  }

  function saveHomeroom() {
    startTransition(async () => {
      const supabase = createClient();
      for (const c of classes) {
        const next = gvcnDraft[c.id] || null;
        if (next === c.gvcn_id) continue;
        const { error: err } = await supabase
          .from("classes")
          .update({ gvcn_id: next })
          .eq("id", c.id);
        if (err) {
          flash(false, err.message);
          return;
        }
      }
      flash(true, "Đã lưu phân công chủ nhiệm.");
    });
  }

  function saveTeacherSubjects() {
    startTransition(async () => {
      const supabase = createClient();
      const { error: delErr } = await supabase
        .from("teacher_subjects")
        .delete()
        .eq("teacher_id", tsTeacher);
      if (delErr) {
        flash(false, delErr.message);
        return;
      }
      const rows = [...(tsDraft[tsTeacher] ?? [])].map((subject_id) => ({
        teacher_id: tsTeacher,
        subject_id,
      }));
      if (rows.length) {
        const { error: insErr } = await supabase
          .from("teacher_subjects")
          .insert(rows);
        if (insErr) {
          flash(false, insErr.message);
          return;
        }
      }
      flash(true, "Đã lưu môn phụ trách.");
    });
  }

  function saveGrid() {
    startTransition(async () => {
      const supabase = createClient();
      for (const p of pairs.filter((x) => x.class_id === gridClass)) {
        const key = `${p.class_id}|${p.subject_id}`;
        const next = gridDraft[key] || null;
        if (next === p.teacher_id) continue;
        const { error: err } = await supabase
          .from("timetable_entries")
          .update({ teacher_id: next })
          .eq("class_id", p.class_id)
          .eq("subject_id", p.subject_id);
        if (err) {
          flash(false, err.message);
          return;
        }
      }
      flash(true, "Đã lưu phân công giảng dạy (áp dụng cho toàn bộ tiết trong TKB).");
    });
  }

  const classPairs = pairs.filter((p) => p.class_id === gridClass);
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6">
      {(message || error) && (
        <div
          className={`rounded-xl border p-3 text-sm ${error ? "border-destructive text-error" : "border-border text-success"}`}
        >
          {error ?? message}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">1. Phân công giáo viên chủ nhiệm</h2>
        <DataTable
          columns={["Lớp", "Khối", "GVCN phụ trách"]}
          footer={
            <>
              <span>{classes.length} lớp</span>
              <Button size="sm" onClick={saveHomeroom} disabled={pending}>
                Lưu phân công CN
              </Button>
            </>
          }
        >
          {classes.map((c) => (
            <tr key={c.id}>
              <td className="font-medium">{c.name}</td>
              <td className="text-muted-foreground">Khối {c.grade}</td>
              <td>
                <select
                  value={gvcnDraft[c.id] ?? ""}
                  onChange={(e) =>
                    setGvcnDraft((p) => ({ ...p, [c.id]: e.target.value }))
                  }
                  className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  <option value="">- Chưa phân công -</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({ROLE_LABEL[t.role] ?? t.role})
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </DataTable>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">2. Môn phụ trách của giáo viên</h2>
        <div className="flex items-center gap-3">
          <select
            value={tsTeacher}
            onChange={(e) => setTsTeacher(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({ROLE_LABEL[t.role] ?? t.role})
              </option>
            ))}
          </select>
          <Button size="sm" onClick={saveTeacherSubjects} disabled={pending}>
            Lưu môn phụ trách
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-5">
          {subjects.map((s) => {
            const checked = tsDraft[tsTeacher]?.has(s.id) ?? false;
            return (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setTsDraft((prev) => {
                      const next = { ...prev };
                      const set = new Set(next[tsTeacher] ?? []);
                      if (e.target.checked) set.add(s.id);
                      else set.delete(s.id);
                      next[tsTeacher] = set;
                      return next;
                    });
                  }}
                  className="accent-primary"
                />
                {s.name}
              </label>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">3. Phân công giảng dạy theo lớp</h2>
        <div className="flex items-center gap-3">
          <select
            value={gridClass}
            onChange={(e) => setGridClass(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={saveGrid} disabled={pending}>
            Lưu phân công giảng dạy
          </Button>
        </div>
        <DataTable columns={["Môn học", "Giáo viên hiện tại", "Phân công"]}>
          {classPairs.map((p) => {
            const key = `${p.class_id}|${p.subject_id}`;
            const opts = qualified(p.subject_id);
            return (
              <tr key={key}>
                <td className="font-medium">
                  {subjectName.get(p.subject_id) ?? "-"}
                </td>
                <td className="text-muted-foreground">
                  {p.teacher_id ? (teacherName.get(p.teacher_id) ?? "-") : "-"}
                </td>
                <td>
                  <select
                    value={gridDraft[key] ?? ""}
                    onChange={(e) =>
                      setGridDraft((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    <option value="">- Chưa phân công -</option>
                    {opts.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </DataTable>
        <p className="text-xs text-muted-foreground">
          Danh sách giáo viên gợi ý theo môn phụ trách ở mục 2 (GVBM); GVCN/Tổ
          trưởng vẫn có thể được phân công kiêm nhiệm.
        </p>
      </section>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GradeStudent {
  id: string;
  code: string;
  full_name: string;
}

export interface ExistingGrade {
  id: string;
  student_id: string;
  score: number;
}

/** Editable score grid - saves via upsert on existing ids + insert for new. */
export function GradesEditor({
  students,
  grades,
  subjectId,
  term,
  meId,
}: {
  students: GradeStudent[];
  grades: ExistingGrade[];
  subjectId: string;
  term: string;
  meId: string;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(grades.map((g) => [g.student_id, String(g.score)])),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    setError(null);
    const rows: {
      id?: string;
      student_id: string;
      subject_id: string;
      term: string;
      assessment_type: string;
      score: number;
      entered_by: string;
    }[] = [];
    const deletions: string[] = [];

    for (const s of students) {
      const raw = (scores[s.id] ?? "").trim();
      const existing = grades.find((g) => g.student_id === s.id);
      if (!raw) {
        if (existing) deletions.push(existing.id);
        continue;
      }
      const score = Number(raw.replace(",", "."));
      if (Number.isNaN(score) || score < 0 || score > 10) {
        setError(`Điểm không hợp lệ cho học sinh ${s.full_name} (0-10).`);
        return;
      }
      if (existing && Number(existing.score) === score) continue;
      rows.push({
        ...(existing ? { id: existing.id } : {}),
        student_id: s.id,
        subject_id: subjectId,
        term,
        assessment_type: "hoc_ky",
        score,
        entered_by: meId,
      });
    }

    startTransition(async () => {
      const supabase = createClient();
      if (deletions.length) {
        const { error: err } = await supabase
          .from("grades")
          .delete()
          .in("id", deletions);
        if (err) {
          setError(err.message);
          return;
        }
      }
      if (rows.length) {
        const { error: err } = await supabase.from("grades").upsert(rows);
        if (err) {
          setError(err.message);
          return;
        }
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <DataTable
        columns={["Mã HS", "Họ và tên", "Điểm (0-10)"]}
        footer={
          <>
            <span>{students.length} học sinh</span>
            <span className="flex items-center gap-3">
              {saved && <span className="text-success">Đã lưu điểm.</span>}
              {error && <span className="text-error">{error}</span>}
              <Button onClick={save} disabled={pending} size="sm">
                {pending ? "Đang lưu…" : "Lưu điểm"}
              </Button>
            </span>
          </>
        }
      >
        {students.map((s) => {
          const raw = scores[s.id] ?? "";
          const invalid =
            raw.trim() !== "" &&
            (Number.isNaN(Number(raw.replace(",", "."))) ||
              Number(raw.replace(",", ".")) < 0 ||
              Number(raw.replace(",", ".")) > 10);
          return (
            <tr key={s.id}>
              <td className="font-mono text-xs text-muted-foreground">
                {s.code}
              </td>
              <td className="font-medium">{s.full_name}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  inputMode="decimal"
                  value={raw}
                  onChange={(e) => {
                    setSaved(false);
                    setScores((prev) => ({
                      ...prev,
                      [s.id]: e.target.value,
                    }));
                  }}
                  className={cn(
                    "h-8 w-24 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring",
                    invalid && "border-destructive",
                  )}
                  placeholder="-"
                />
              </td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}

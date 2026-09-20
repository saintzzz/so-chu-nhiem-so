"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { sortByVietnameseName } from "@/lib/utils";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

export { NLPC_ATTRIBUTES } from "@/lib/nlpc";
import { NLPC_ATTRIBUTES } from "@/lib/nlpc";

const COMMENT_GROUPS = [
  { grp: "nlc", label: "Nhận xét năng lực chung" },
  { grp: "nldt", label: "Nhận xét năng lực đặc thù" },
  { grp: "pc", label: "Nhận xét phẩm chất" },
] as const;

const LEVELS = ["", "T", "H", "C"] as const;

interface Student {
  id: string;
  code: string;
  full_name: string;
}

export interface NlpcEval {
  student_id: string;
  attribute_code: string;
  level: string | null;
}

export interface NlpcCommentRow {
  student_id: string;
  grp: string;
  comment: string | null;
}

type Level = "" | "T" | "H" | "C";

/** Bảng đánh giá NLPC tiểu học - mỗi HS một dòng: 15 mức T/H/C + 3 nhận xét nhóm. */
export function NlpcEditor({
  students: rawStudents,
  evaluations,
  comments,
  term,
  meId,
}: {
  students: Student[];
  evaluations: NlpcEval[];
  comments: NlpcCommentRow[];
  term: string;
  meId: string;
}) {
  const students = sortByVietnameseName(rawStudents, (s) => s.full_name);
  const router = useRouter();
  const [levels, setLevels] = useState<Record<string, Record<string, Level>>>(
    () => {
      const init: Record<string, Record<string, Level>> = {};
      for (const s of students) {
        init[s.id] = {};
        for (const a of NLPC_ATTRIBUTES) {
          const ev = evaluations.find(
            (e) => e.student_id === s.id && e.attribute_code === a.code,
          );
          init[s.id][a.code] = (ev?.level as Level) ?? "";
        }
      }
      return init;
    },
  );
  const [groupComments, setGroupComments] = useState<
    Record<string, Record<string, string>>
  >(() => {
    const init: Record<string, Record<string, string>> = {};
    for (const s of students) {
      init[s.id] = {};
      for (const g of COMMENT_GROUPS) {
        init[s.id][g.grp] =
          comments.find((c) => c.student_id === s.id && c.grp === g.grp)
            ?.comment ?? "";
      }
    }
    return init;
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setLevel(studentId: string, code: string, level: Level) {
    setSaved(false);
    setLevels((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [code]: level },
    }));
  }

  function setComment(studentId: string, grp: string, value: string) {
    setSaved(false);
    setGroupComments((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [grp]: value },
    }));
  }

  function save() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const studentIds = students.map((s) => s.id);

      const { error: delErr } = await supabase
        .from("competency_evaluations")
        .delete()
        .in("student_id", studentIds)
        .eq("term", term);
      if (delErr) {
        setError(delErr.message);
        return;
      }
      const { error: delComErr } = await supabase
        .from("nlpc_comments")
        .delete()
        .in("student_id", studentIds)
        .eq("term", term);
      if (delComErr) {
        setError(delComErr.message);
        return;
      }

      const evalRows: Record<string, unknown>[] = [];
      const commentRows: Record<string, unknown>[] = [];
      for (const s of students) {
        for (const a of NLPC_ATTRIBUTES) {
          const lv = levels[s.id]?.[a.code];
          if (lv) {
            evalRows.push({
              student_id: s.id,
              term,
              attribute_code: a.code,
              level: lv,
              evaluated_by: meId,
            });
          }
        }
        for (const g of COMMENT_GROUPS) {
          const c = groupComments[s.id]?.[g.grp]?.trim();
          if (c) {
            commentRows.push({
              student_id: s.id,
              term,
              grp: g.grp,
              comment: c,
              evaluated_by: meId,
            });
          }
        }
      }
      if (evalRows.length) {
        const { error: insErr } = await supabase
          .from("competency_evaluations")
          .insert(evalRows);
        if (insErr) {
          setError(insErr.message);
          return;
        }
      }
      if (commentRows.length) {
        const { error: insErr } = await supabase
          .from("nlpc_comments")
          .insert(commentRows);
        if (insErr) {
          setError(insErr.message);
          return;
        }
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          Đánh giá năng lực & phẩm chất (tiểu học) - mức T/H/C
        </span>
        <span className="flex items-center gap-3">
          {saved && <span className="text-sm text-success">Đã lưu NLPC.</span>}
          {error && <span className="text-sm text-error">{error}</span>}
          <Button onClick={save} disabled={pending} size="sm">
            {pending ? "Đang lưu…" : "Lưu đánh giá NLPC"}
          </Button>
        </span>
      </div>
      <DataTable
        columns={[
          "STT",
          "Họ và tên",
          ...NLPC_ATTRIBUTES.map((a) => a.label),
          ...COMMENT_GROUPS.map((g) => g.label),
        ]}
        footer={<span>{students.length} học sinh</span>}
      >
        {students.map((s, idx) => (
          <tr key={s.id}>
            <td className="text-muted-foreground">{idx + 1}</td>
            <td className="font-medium">{s.full_name}</td>
            {NLPC_ATTRIBUTES.map((a) => (
              <td key={a.code}>
                <select
                  value={levels[s.id]?.[a.code] ?? ""}
                  onChange={(e) =>
                    setLevel(s.id, a.code, e.target.value as Level)
                  }
                  className="h-7 w-12 rounded-md border border-border bg-background px-1 text-xs outline-none focus:border-ring"
                  aria-label={`${a.label} - ${s.full_name}`}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l || "-"}
                    </option>
                  ))}
                </select>
              </td>
            ))}
            {COMMENT_GROUPS.map((g) => (
              <td key={g.grp}>
                <AutoGrowTextarea
                  value={groupComments[s.id]?.[g.grp] ?? ""}
                  onChange={(e) => setComment(s.id, g.grp, e.target.value)}
                  bare
                  className="w-40 text-xs"
                />
              </td>
            ))}
          </tr>
        ))}
      </DataTable>
      <p className="text-xs text-muted-foreground">
        Mức: T - Hoàn thành tốt · H - Hoàn thành · C - Chưa hoàn thành. Nhóm
        cột: 3 năng lực chung, 7 năng lực đặc thù, 5 phẩm chất.
      </p>
    </div>
  );
}

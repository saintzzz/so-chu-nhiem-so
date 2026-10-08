import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { PageHeader } from "@/components/page-header";
import { ScoringGrid } from "@/components/emulation/scoring-grid";
import type { ScoreCell } from "@/components/emulation/scoring-grid";
import { currentPeriodVN } from "@/lib/utils";
import { hasRole } from "@/lib/roles";

interface CriterionRow {
  id: string;
  name: string;
  max_score: number;
  category: string | null;
}

interface ClassRow {
  id: string;
  name: string;
}

interface ScoreRow {
  id: string;
  class_id: string;
  criterion_id: string;
  score: number;
}

export default async function EmulationScoringPage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const PERIOD = currentPeriodVN();
  const supabase = await createClient();

  // R9-01: emulation_scores truoc day query khong phan trang - PostgREST cat
  // ngam ~1000 rows va loi bi nuot, luoi cham diem hien thieu du lieu. Doc het
  // qua fetchAllRows (order id on dinh); loi/truncated -> notice.
  const [{ data: critRaw, error: critErr }, { data: classesRaw, error: clsErr }, scoresRes, { data: ownRaw }] =
    await Promise.all([
      supabase
        .from("emulation_criteria")
        .select("id,name,max_score,category")
        .order("name", { ascending: true }),
      supabase
        .from("classes")
        .select("id,name")
        .eq("status", "active")
        .order("name", { ascending: true }),
      fetchAllRows<ScoreRow>((f, t) =>
        supabase
          .from("emulation_scores")
          .select("id,class_id,criterion_id,score")
          .eq("period", PERIOD)
          .order("id")
          .range(f, t),
      ),
      // GVCN chỉ chấm lớp chủ nhiệm của mình; BGH chấm tất cả.
      hasRole(profile, "gvcn")
        ? supabase.from("classes").select("id").eq("gvcn_id", profile.id)
        : Promise.resolve({ data: [] }),
    ]);

  const errors: string[] = [];
  if (critErr) {
    errors.push("emulation_criteria");
    console.error("[emulation/scoring] emulation_criteria:", critErr.message);
  }
  if (clsErr) {
    errors.push("classes");
    console.error("[emulation/scoring] classes:", clsErr.message);
  }
  if (scoresRes.error || scoresRes.truncated) {
    errors.push("emulation_scores");
    console.error(
      "[emulation/scoring] emulation_scores:",
      scoresRes.error ?? "truncated",
    );
  }

  const editableClassIds =
    hasRole(profile, "gvcn")
      ? ((ownRaw ?? []) as { id: string }[]).map((c) => c.id)
      : (classesRaw ?? []).map((c: { id: string }) => c.id);

  const criteria = (critRaw ?? []) as CriterionRow[];
  const classes = (classesRaw ?? []) as ClassRow[];
  const initialScores: Record<string, ScoreCell> = {};
  for (const s of errors.length ? [] : scoresRes.rows) {
    initialScores[`${s.class_id}|${s.criterion_id}`] = {
      id: s.id,
      score: s.score,
    };
  }

  return (
    <>
      <PageHeader
        section="Thi đua"
        title="Thu thập & tính điểm thi đua"
        description={`Kỳ thi đua ${PERIOD} - nhập điểm theo tiêu chí cho từng lớp`}
      />

      {errors.length > 0 ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải đủ dữ liệu nguồn để chấm điểm - vui lòng thử lại.
        </p>
      ) : (
        <ScoringGrid
          period={PERIOD}
          criteria={criteria}
          classes={classes}
          initialScores={initialScores}
          editableClassIds={editableClassIds}
        />
      )}
    </>
  );
}

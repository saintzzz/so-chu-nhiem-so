import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ScoringGrid } from "@/components/emulation/scoring-grid";
import type { ScoreCell } from "@/components/emulation/scoring-grid";

const PERIOD = "2026-T9";

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
  await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  const [{ data: critRaw }, { data: classesRaw }, { data: scoresRaw }] =
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
      supabase
        .from("emulation_scores")
        .select("id,class_id,criterion_id,score")
        .eq("period", PERIOD),
    ]);

  const criteria = (critRaw ?? []) as CriterionRow[];
  const classes = (classesRaw ?? []) as ClassRow[];
  const initialScores: Record<string, ScoreCell> = {};
  for (const s of (scoresRaw ?? []) as ScoreRow[]) {
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

      <ScoringGrid
        period={PERIOD}
        criteria={criteria}
        classes={classes}
        initialScores={initialScores}
      />
    </>
  );
}

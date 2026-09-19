import { Trophy } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ChartCard, BarChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { cn } from "@/lib/utils";

const PERIOD = "2026-T9";

interface CriterionRow {
  id: string;
  name: string;
  max_score: number;
}

interface ClassRow {
  id: string;
  name: string;
  gvcn_id: string | null;
}

interface ScoreRow {
  class_id: string;
  criterion_id: string;
  score: number;
}

const RANK_TONES = [
  "bg-warning-bg text-warning",
  "bg-muted text-muted-foreground",
  "bg-muted text-muted-foreground",
];

export default async function EmulationRankingPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: critRaw }, { data: classesRaw }, { data: scoresRaw }] =
    await Promise.all([
      supabase
        .from("emulation_criteria")
        .select("id,name,max_score")
        .order("name", { ascending: true }),
      supabase
        .from("classes")
        .select("id,name,gvcn_id")
        .eq("status", "active")
        .order("name", { ascending: true }),
      supabase
        .from("emulation_scores")
        .select("class_id,criterion_id,score")
        .eq("period", PERIOD),
    ]);

  const criteria = (critRaw ?? []) as CriterionRow[];
  const classes = (classesRaw ?? []) as ClassRow[];
  const scores = (scoresRaw ?? []) as ScoreRow[];

  const scoreMap = new Map<string, number>();
  for (const s of scores) {
    scoreMap.set(`${s.class_id}|${s.criterion_id}`, s.score);
  }

  const ranked = classes
    .map((c) => {
      const perCriterion = criteria.map(
        (cr) => scoreMap.get(`${c.id}|${cr.id}`) ?? null,
      );
      const total = perCriterion.reduce<number>(
        (s, v) => s + (v ?? 0),
        0,
      );
      return { cls: c, perCriterion, total };
    })
    .sort((a, b) => b.total - a.total);

  const chartData = ranked.map((r) => ({
    label: r.cls.name,
    value: r.total,
  }));
  const top = ranked[0] ?? null;
  const ownClassId = classes.find((c) => c.gvcn_id === profile.id)?.id ?? null;
  const maxTotal = criteria.reduce((s, c) => s + c.max_score, 0);

  return (
    <>
      <PageHeader
        section="Phân hệ X - Thi đua"
        title="Xếp hạng & khen thưởng"
        description={`Kết quả thi đua kỳ ${PERIOD} giữa các lớp`}
      />

      {top && top.total > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-success-bg p-4 shadow-[var(--shadow-sm-token)]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success text-primary-foreground">
            <Trophy className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-success">
              Khen thưởng: Lớp {top.cls.name}
            </p>
            <p className="mt-0.5 text-sm text-success">
              Dẫn đầu thi đua kỳ {PERIOD} với {top.total}/{maxTotal} điểm — đề
              xuất cờ thi đua và ghi nhận trước toàn trường.
            </p>
          </div>
        </div>
      )}

      <div className="mb-4">
        <ChartCard
          title="Tổng điểm thi đua theo lớp"
          ariaDescription="Biểu đồ cột thể hiện tổng điểm thi đua của từng lớp"
          tableContent={
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Lớp</th>
                  <th className="py-2 font-medium">Tổng điểm</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((d) => (
                  <tr
                    key={d.label}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-2 pr-4">{d.label}</td>
                    <td className="py-2 font-medium">{d.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          {chartData.length > 0 ? (
            <BarChart data={chartData} />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Chưa có dữ liệu thi đua
            </p>
          )}
        </ChartCard>
      </div>

      <DataTable
        columns={[
          "Hạng",
          "Lớp",
          ...criteria.map((c) => c.name),
          `Tổng (/${maxTotal})`,
        ]}
        footer={<span>{ranked.length} lớp tham gia xếp hạng</span>}
      >
        {ranked.map((r, i) => (
          <tr
            key={r.cls.id}
            className={cn(
              r.cls.id === ownClassId && "bg-primary-bg/40",
              i === 0 && "font-medium",
            )}
          >
            <td>
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                  i < 3 ? RANK_TONES[i] : "text-foreground",
                )}
              >
                {i + 1}
              </span>
            </td>
            <td>
              {r.cls.name}
              {r.cls.id === ownClassId && (
                <span className="ml-2 rounded-full bg-primary-bg px-2 py-0.5 text-xs font-medium text-primary">
                  Lớp mình
                </span>
              )}
            </td>
            {r.perCriterion.map((v, j) => (
              <td key={criteria[j].id}>{v ?? "—"}</td>
            ))}
            <td className="font-semibold">{r.total}</td>
          </tr>
        ))}
        {ranked.length === 0 && (
          <tr>
            <td colSpan={criteria.length + 3} className="py-8 text-center text-muted-foreground">
              Chưa có dữ liệu xếp hạng cho kỳ {PERIOD}
            </td>
          </tr>
        )}
      </DataTable>
    </>
  );
}

import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus, ClassRoom, Student } from "@/types";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { ChartCard, BarChart } from "@/components/charts";
import { Sparkles } from "lucide-react";
import { aiProviderLabel, generateText } from "@/lib/ai";

interface ClassStats {
  id: string;
  name: string;
  size: number;
  attendancePct: number | null;
  avgScore: number | null;
  violations: number;
}

export default async function RecordsReportPage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await classQuery;
  const classes = (classData ?? []) as ClassRoom[];
  const classIds = classes.map((c) => c.id);

  const { data: studentData } = classIds.length
    ? await supabase
        .from("students")
        .select("id,class_id")
        .in("class_id", classIds)
    : { data: [] };
  const students = (studentData ?? []) as Pick<Student, "id" | "class_id">[];
  const idsByClass = new Map<string, string[]>();
  for (const s of students) {
    const arr = idsByClass.get(s.class_id) ?? [];
    arr.push(s.id);
    idsByClass.set(s.class_id, arr);
  }

  const stats: ClassStats[] = await Promise.all(
    classes.map(async (c) => {
      const ids = idsByClass.get(c.id) ?? [];
      if (ids.length === 0) {
        return {
          id: c.id,
          name: c.name,
          size: 0,
          attendancePct: null,
          avgScore: null,
          violations: 0,
        };
      }
      const [totalRes, absentRes, gradesRes, violRes] = await Promise.all([
        supabase
          .from("attendance_records")
          .select("id", { count: "exact", head: true })
          .in("student_id", ids),
        supabase
          .from("attendance_records")
          .select("status")
          .in("student_id", ids)
          .in("status", ["excused", "unexcused"])
          .limit(5000),
        supabase
          .from("grades")
          .select("score")
          .in("student_id", ids)
          .limit(5000),
        supabase
          .from("conduct_records")
          .select("id", { count: "exact", head: true })
          .in("student_id", ids)
          .eq("type", "vi_pham"),
      ]);
      const total = totalRes.count ?? 0;
      const absent = ((absentRes.data ?? []) as { status: AttendanceStatus }[])
        .length;
      const scores = (gradesRes.data ?? []) as { score: number }[];
      const avg =
        scores.length > 0
          ? scores.reduce((a, g) => a + g.score, 0) / scores.length
          : null;
      return {
        id: c.id,
        name: c.name,
        size: ids.length,
        attendancePct:
          total > 0 ? Math.round(((total - absent) / total) * 1000) / 10 : null,
        avgScore: avg !== null ? Math.round(avg * 10) / 10 : null,
        violations: violRes.count ?? 0,
      };
    }),
  );

  const totalStudents = stats.reduce((a, s) => a + s.size, 0);
  const pctValues = stats.filter((s) => s.attendancePct !== null);
  const avgPct =
    pctValues.length > 0
      ? Math.round(
          (pctValues.reduce((a, s) => a + (s.attendancePct ?? 0), 0) /
            pctValues.length) *
            10,
        ) / 10
      : null;
  const scoreValues = stats.filter((s) => s.avgScore !== null);
  const avgScore =
    scoreValues.length > 0
      ? Math.round(
          (scoreValues.reduce((a, s) => a + (s.avgScore ?? 0), 0) /
            scoreValues.length) *
            10,
        ) / 10
      : null;
  const totalViolations = stats.reduce((a, s) => a + s.violations, 0);

  const ruleNarrative: string[] = [];
  const bestAtt = [...stats].sort(
    (a, b) => (b.attendancePct ?? 0) - (a.attendancePct ?? 0),
  )[0];
  const worstAtt = [...stats].sort(
    (a, b) => (a.attendancePct ?? 99) - (b.attendancePct ?? 99),
  )[0];
  const mostViol = [...stats].sort((a, b) => b.violations - a.violations)[0];
  if (stats.length > 0 && bestAtt) {
    ruleNarrative.push(
      `Lớp ${bestAtt.name} có tỷ lệ chuyên cần cao nhất (${bestAtt.attendancePct}%), trong khi lớp ${worstAtt?.name} thấp nhất (${worstAtt?.attendancePct}%).`,
    );
  }
  if (mostViol && mostViol.violations > 0) {
    ruleNarrative.push(
      `Lớp ${mostViol.name} ghi nhận nhiều vi phạm nhất (${mostViol.violations} lượt) - GVCN nên rà soát các em vi phạm lặp lại và phối hợp phụ huynh.`,
    );
  } else if (stats.length > 0) {
    ruleNarrative.push("Chưa ghi nhận vi phạm nào trong giai đoạn này.");
  }
  if (avgScore !== null) {
    ruleNarrative.push(
      `Điểm trung bình chung đạt ${avgScore}. ${avgScore >= 7 ? "Kết quả học tập khá tốt, tiếp tục duy trì." : "Cần rà soát các em có điểm dưới trung bình để lập kế hoạch hỗ trợ kịp thời."}`,
    );
  }
  if (avgPct !== null && avgPct < 95) {
    ruleNarrative.push(
      `Chuyên cần trung bình ${avgPct}% - dưới mục tiêu 95%. Đề xuất nhắc phụ huynh các em vắng không phép trong tuần tới.`,
    );
  }

  const aiText =
    stats.length > 0
      ? await generateText(
          `Dữ liệu tổng hợp các lớp (JSON): ${JSON.stringify(
            stats.map((s) => ({
              lop: s.name,
              si_so: s.size,
              chuyen_can_pct: s.attendancePct,
              diem_tb: s.avgScore,
              vi_pham: s.violations,
            })),
          )}. Hãy viết 3-5 nhận xét phân tích ngắn gọn bằng tiếng Việt cho giáo viên chủ nhiệm/ban giám hiệu: lớp nổi bật, lớp cần chú ý, xu hướng và 1-2 đề xuất hành động cụ thể. Mỗi nhận xét một dòng, không đánh số, không ký tự đầu dòng.`,
          {
            system:
              "Bạn là trợ lý phân tích dữ liệu giáo dục cho trường THCS Việt Nam. Trả lời ngắn gọn, thực tế, không emoji.",
            maxTokens: 1024,
          },
        )
      : null;
  const aiNarrative = aiText
    ? aiText
        .split(/\n+/)
        .map((l) => l.replace(/^[\s\-*•\d.)\]]+/, "").trim())
        .filter(Boolean)
    : null;
  const narrative = aiNarrative && aiNarrative.length > 0 ? aiNarrative : ruleNarrative;
  const aiLabel = aiNarrative ? aiProviderLabel() : null;

  return (
    <div>
      <PageHeader
        section="Phân hệ I - Hồ sơ lớp học"
        title="Báo cáo tổng hợp (AI)"
        description="Số liệu tổng hợp theo lớp: sĩ số, chuyên cần, điểm trung bình và vi phạm, kèm gợi ý phân tích."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng sĩ số" value={totalStudents} />
        <StatCard
          label="Chuyên cần TB"
          value={avgPct !== null ? `${avgPct}%` : "-"}
          tone={avgPct !== null && avgPct >= 95 ? "success" : "warning"}
        />
        <StatCard label="Điểm TB chung" value={avgScore ?? "-"} />
        <StatCard
          label="Tổng vi phạm"
          value={totalViolations}
          tone={totalViolations > 0 ? "warning" : "success"}
        />
      </div>

      <div className="mb-4">
        <DataTable
          columns={[
            "Lớp",
            "Sĩ số",
            "% Chuyên cần",
            "Điểm TB",
            "Vi phạm",
            "Đánh giá nhanh",
          ]}
          footer={<span>{stats.length} lớp</span>}
        >
          {stats.map((s) => {
            const good =
              (s.attendancePct ?? 0) >= 95 &&
              (s.avgScore ?? 0) >= 6.5 &&
              s.violations <= 2;
            const risk =
              (s.attendancePct ?? 100) < 90 || (s.avgScore ?? 10) < 5;
            return (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td>
                <td>{s.size}</td>
                <td>
                  {s.attendancePct !== null ? `${s.attendancePct}%` : "-"}
                </td>
                <td>{s.avgScore ?? "-"}</td>
                <td>{s.violations}</td>
                <td>
                  <StatusBadge
                    label={good ? "Tốt" : risk ? "Cần chú ý" : "Ổn định"}
                    tone={good ? "success" : risk ? "error" : "warning"}
                  />
                </td>
              </tr>
            );
          })}
          {stats.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-muted-foreground">
                Chưa có dữ liệu lớp để tổng hợp.
              </td>
            </tr>
          )}
        </DataTable>
      </div>

      {stats.length >= 2 && (
        <div className="mb-4">
          <ChartCard
            title="Tỷ lệ chuyên cần theo lớp (%)"
            ariaDescription="Biểu đồ cột so sánh tỷ lệ chuyên cần giữa các lớp"
          >
            <BarChart
              data={stats.map((s) => ({
                label: s.name,
                value: s.attendancePct ?? 0,
              }))}
            />
          </ChartCard>
        </div>
      )}

      <div className="rounded-xl border border-primary/20 bg-primary-bg p-4 shadow-[var(--shadow-sm-token)]">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-primary">
            {aiLabel ? `Phân tích AI (${aiLabel})` : "Gợi ý (phân tích tự động)"}
          </h2>
        </div>
        {narrative.length > 0 ? (
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
            {narrative.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Chưa đủ dữ liệu để tạo gợi ý.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {aiLabel
            ? "Nội dung do AI tạo từ số liệu thống kê của lớp - chỉ mang tính tham khảo, giáo viên cần rà soát trước khi dùng."
            : "Gợi ý được sinh tự động từ số liệu thống kê của lớp - chỉ mang tính tham khảo."}
        </p>
      </div>
    </div>
  );
}

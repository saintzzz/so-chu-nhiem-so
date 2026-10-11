import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";
import { isoDateVN } from "@/lib/utils";
import { hasAnyRole } from "@/lib/roles";
import { aliasNonce, minimizeDeep, mergePiiNames } from "@/lib/ai-privacy";
import { schoolPiiNames } from "@/lib/ai-pii-roster";

/**
 * AI báo cáo bằng chữ cho cấp quản lý (Sở/Phòng/UBND) - dùng cho /dept/dashboard.
 * Tổng hợp số liệu các trường trong phạm vi -> nhận xét.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (
    !profile ||
    !hasAnyRole(profile, ["so_gd", "ubnd", "admin"])
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const supabase = await createClient();
  // R16-15: aggregate trong SQL thay vi keo raw students+attendance ve app -
  // o quy mo 100k HS, 20 ngay diem danh ~2M rows, vuot cap fetchAllRows.
  const cutoff = isoDateVN(new Date(Date.now() - 30 * 86400000));
  const { data: stats, error: statsErr } = await supabase.rpc(
    "scn_dept_brief_stats",
    { p_since: cutoff },
  );
  if (statsErr) {
    console.error("[ai/dept-brief] stats rpc:", statsErr.message);
    return NextResponse.json(
      { error: "Không tải đủ dữ liệu nguồn." },
      { status: 500 },
    );
  }

  const statRows = (stats ?? []) as {
    school_id: string;
    school_name: string;
    class_count: number;
    student_count: number;
    att_total: number;
    att_absent: number;
  }[];
  const perSchool = statRows.map(
    (s) => ({
      truong: s.school_name,
      so_lop: Number(s.class_count),
      so_hs: Number(s.student_count),
      chuyen_can_pct:
        s.att_total > 0
          ? Math.round(((s.att_total - s.att_absent) / s.att_total) * 100)
          : null,
    }),
  );

  // r14 M + r15 M: ten truong la du lieu DB tuy y (createSchool chi check
  // non-empty <=200 ky tu) - co the chua ten nguoi that. Alias moi truong
  // thanh TRxx (self-contained, khong can roster cross-school); names
  // longest-first nen toan ten truong duoc alias tron ven. Dept user co
  // school_id NULL -> roster rong van duoc TR-alias + redact cau truc.
  const aNonce = aliasNonce();
  const schoolAliases = statRows
    .filter((s) => s.school_name)
    .map((s, i) => ({
      name: s.school_name,
      alias: `⟦TR${String(i + 1).padStart(2, "0")}·${aNonce}⟧`,
    }));
  let allNames: import("@/lib/ai-privacy").PiiName[] = schoolAliases;
  if (profile.school_id) {
    const roster = await schoolPiiNames(profile.school_id);
    if (roster.error) {
      return NextResponse.json(
        { error: "Không tải được dữ liệu nguồn, thử lại sau." },
        { status: 500 },
      );
    }
    allNames = mergePiiNames(schoolAliases, roster.names);
  }
  const minSchool = minimizeDeep(perSchool, allNames);

  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "dept-brief",
    system:
      "Bạn là trợ lý phân tích cho cán bộ quản lý giáo dục (Sở GD&ĐT, UBND cấp xã). Viết báo cáo ngắn gọn, khách quan, theo số liệu. Không emoji.",
    pii: { names: allNames, source: perSchool },
    prompt: `Viết bản tin tổng hợp cho cán bộ quản lý giáo dục từ số liệu các trường (JSON): ${JSON.stringify(minSchool)}.

Viết 4-6 nhận xét: tổng quan quy mô, trường có chuyên cần tốt/kém nhất (nêu tên + %), trường cần hỗ trợ, 1-2 đề xuất hành động cho cấp quản lý. Mỗi nhận xét 1 dòng, không đánh số.`,
    expectedShape: '{"lines": ["nhận xét 1", "nhận xét 2"]}',
    maxTokens: 1000,
    parse: (text) => {
      try {
        const o = JSON.parse(text) as { lines?: string[] };
        if (Array.isArray(o.lines) && o.lines.length) {
          return { lines: o.lines.filter((l) => typeof l === "string") };
        }
      } catch {
        /* fallthrough */
      }
      const lines = parseLines(text);
      return lines ? { lines } : null;
    },
    fallback: () => {
      const lines: string[] = [];
      const totalCls = perSchool.reduce((s, x) => s + x.so_lop, 0);
      const totalStu = perSchool.reduce((s, x) => s + x.so_hs, 0);
      lines.push(
        `Hệ thống có ${perSchool.length} trường, ${totalCls} lớp, ${totalStu} học sinh.`,
      );
      const withAtt = perSchool.filter((x) => x.chuyen_can_pct !== null);
      const sorted = [...withAtt].sort(
        (a, b) => (b.chuyen_can_pct ?? 0) - (a.chuyen_can_pct ?? 0),
      );
      if (sorted.length) {
        lines.push(
          `Chuyên cần cao nhất: ${sorted[0].truong} (${sorted[0].chuyen_can_pct}%).`,
        );
        const low = sorted[sorted.length - 1];
        if (sorted.length > 1)
          lines.push(
            `Chuyên cần thấp nhất: ${low.truong} (${low.chuyen_can_pct}%) - cần theo dõi.`,
          );
      }
      const noData = perSchool.filter((x) => x.chuyen_can_pct === null);
      if (noData.length) {
        lines.push(
          `${noData.length} trường chưa có dữ liệu điểm danh 30 ngày: ${noData.map((x) => x.truong).join(", ")}.`,
        );
      }
      lines.push(
        "Đề xuất: rà soát trường chuyên cần thấp và trường chưa báo cáo dữ liệu.",
      );
      return { lines };
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOOL_MAP } from "@/lib/tvc/registry";
import { fbMatrix } from "@/lib/tvc/fallbacks";
import { generateDoc } from "@/lib/tvc/ai-json";
import { fallbackToDevin } from "@/lib/devin";
import { ensureTvcProfile } from "@/lib/tvc/profile";
import { referencesMissingContext } from "@/lib/tvc/question-validate";
import type { ToolContext } from "@/lib/tvc/types";
import type { CurriculumStandard, DocContent, Question, Subject } from "@/types/tvc";

const TOOL_ROLES = ["gvcn", "gvbm", "to_truong", "bgh", "admin"];

interface MatrixCell {
  standard_id: string;
  standard_code?: string;
  level: string;
  qtype: string;
  count: number;
  points: number;
}

interface Picked {
  q: Question;
  cell: MatrixCell;
  review: boolean;
  dispStem?: string;
  dispCorrect?: string;
  dispLabel?: string;
}

const stemKey = (s: string) =>
  s
    .split(/\bA[.)]/)[0]
    .replace(/[-‐‑‒–—―]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hasControl = (s: string) => /[\x00-\x08\x0b-\x1f]/.test(s);

// Tach options A-D ra khoi stem, xao tron vi tri, gan lai nhan.
function shuffleMc(
  stem: string,
  correct: string | undefined,
): { stem: string; correct?: string } {
  const labelRe = /\b([A-D])[.)]\s*/g;
  const marks: { label: string; index: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(stem))) {
    marks.push({ label: m[1], index: m.index, end: m.index + m[0].length });
  }
  if (marks.length !== 4) return { stem, correct };
  const opts = marks.map((mk, i) => ({
    label: mk.label,
    text: stem
      .slice(mk.end, i + 1 < marks.length ? marks[i + 1].index : stem.length)
      .trim()
      .replace(/[.,;:]\s*$/, ""),
  }));
  if (opts.some((o) => !o.text)) return { stem, correct };
  const prefix = stem.slice(0, marks[0].index).trim();
  const contents = opts.map((o) => o.text);
  for (let i = contents.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [contents[i], contents[j]] = [contents[j], contents[i]];
  }
  const LETTERS = ["A", "B", "C", "D"];
  const newStem =
    prefix + "\n" + contents.map((c, i) => `${LETTERS[i]}. ${c}`).join("\n");
  let newCorrect: string | undefined;
  const cL = (correct ?? "").trim().match(/^([A-D])/)?.[1];
  if (cL) {
    const oldText = opts.find((o) => o.label === cL)?.text;
    const ni = oldText ? contents.indexOf(oldText) : -1;
    if (ni >= 0) newCorrect = LETTERS[ni];
  }
  return { stem: newStem, correct: newCorrect };
}

const PARTS: { qtype: string; title: string }[] = [
  {
    qtype: "multiple_choice",
    title: "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn",
  },
  { qtype: "true_false_4", title: "PHẦN II. Câu trắc nghiệm đúng sai" },
  { qtype: "short_answer", title: "PHẦN III. Câu trắc nghiệm trả lời ngắn" },
  { qtype: "essay", title: "PHẦN IV. Tự luận" },
];

function buildExamDoc(
  picked: Picked[],
  matrix: {
    title: string;
    subject_code: string | null;
    grade: number | null;
    duration_min: number | null;
    total_points: number | null;
  },
  opts: { variantLabel?: string; tfScore?: string; subjectName?: string },
): DocContent {
  const partOf = new Map<string, Picked[]>();
  for (const p of picked) {
    const k = p.q.qtype;
    partOf.set(k, [...(partOf.get(k) ?? []), p]);
  }
  const perPts = (p: Picked) =>
    Math.round((p.cell.points / Math.max(p.cell.count, 1)) * 100) / 100;

  // Cap TH (TT 22/2021): PHAN I TRAC NGHIEM (MC + Đ/S + TLN gop chung,
  // danh so Cau 1..n lien tuc) + PHAN II TU LUAN - dung mau de dinh ky TH.
  const th = (matrix.grade ?? 6) <= 5;
  const groups: { qtypes: string[]; title: string; roman: string }[] = th
    ? [
        {
          qtypes: ["multiple_choice", "true_false_4", "short_answer"],
          title: "PHẦN I. TRẮC NGHIỆM",
          roman: "I",
        },
        { qtypes: ["essay"], title: "PHẦN II. TỰ LUẬN", roman: "II" },
      ]
    : PARTS.map((p, i) => ({
        qtypes: [p.qtype],
        title: p.title,
        roman: ["I", "II", "III", "IV"][i],
      }));

  const sections: DocContent["sections"] = [];
  const ansRows: string[][] = [];
  groups.forEach((grp) => {
    const rows = grp.qtypes.flatMap((t) => partOf.get(t) ?? []);
    if (!rows.length) return;
    const pts = rows.reduce((s, p) => s + perPts(p), 0);
    const blocks: DocContent["sections"][0]["blocks"] = [];
    if (th && grp.roman === "I") {
      blocks.push({
        kind: "para",
        text: "Khoanh vào chữ cái đặt trước câu trả lời đúng hoặc thực hiện theo yêu cầu của từng câu (Đúng ghi Đ, sai ghi S vào ô trống).",
      });
    }
    let items: string[] = [];
    let lastCtx: string | null = null;
    const flushList = () => {
      if (items.length) blocks.push({ kind: "list", items });
      items = [];
    };
    rows.forEach((p, i) => {
      const qctx = p.q.context?.trim() || null;
      if (qctx !== lastCtx) {
        flushList();
        if (qctx)
          blocks.push({
            kind: "note",
            text: `Đọc đoạn văn sau và trả lời các câu hỏi phía dưới:\n\n${qctx}`,
          });
        lastCtx = qctx;
      }
      if (p.q.qtype === "multiple_choice") {
        const sh = shuffleMc(
          p.q.stem,
          typeof p.q.answer?.correct === "string" ? p.q.answer.correct : undefined,
        );
        p.dispStem = sh.stem;
        if (sh.correct) p.dispCorrect = sh.correct;
        items.push(`Câu ${i + 1}: ${sh.stem}`);
      } else {
        items.push(`Câu ${i + 1}: ${p.q.stem}`);
      }
    });
    flushList();
    sections.push({
      title: `${grp.title} (${Math.round(pts * 100) / 100} điểm)`,
      blocks,
    });
    rows.forEach((p, i) => {
      p.dispLabel = `Phần ${grp.roman} - Câu ${i + 1}`;
      const ans = p.dispCorrect ?? p.q.answer?.correct;
      ansRows.push([
        grp.roman,
        String(i + 1),
        p.q.code ?? "-",
        typeof ans === "string" ? ans : ans ? JSON.stringify(ans) : "-",
        String(perPts(p)),
      ]);
    });
  });

  const tfPart = th ? "I" : "II";
  const tfNote =
    opts.tfScore === "progressive"
      ? `Ghi chú chấm phần ${tfPart} (Đúng/Sai): mỗi câu gồm 4 ý - chấm lũy tiến theo QĐ 764/QĐ-BGDĐT: đúng 1 ý = 0,1đ; 2 ý = 0,25đ; 3 ý = 0,5đ; 4 ý = 1đ.`
      : `Ghi chú chấm phần ${tfPart} (Đúng/Sai): mỗi câu gồm 4 ý - chấm tuyến tính theo số ý đúng: đúng 1 ý = 0,25đ; 2 ý = 0,5đ; 3 ý = 0,75đ; 4 ý = 1đ.`;

  const unr = picked.filter(
    (p) =>
      !p.q.id.startsWith("missing-") &&
      (p.q.review_state ?? "unreviewed") !== "approved",
  );

  return {
    title: `${th ? "KIỂM TRA ĐỊNH KÌ" : "ĐỀ KIỂM TRA"}${opts.variantLabel ? ` ${opts.variantLabel}` : ""} - ${(matrix.title || `${opts.subjectName ?? "MÔN"}${matrix.grade ? ` LỚP ${matrix.grade}` : ""}`)
      .toUpperCase()
      .replace(/^MA TRẬN ĐỀ KIỂM TRA\s*/, "")
      .replace(/^[-\s]+/, "")
      .replace(/^MA TRẬN\s*-\s*/, "")}`,
    meta: [
      ["Môn học", opts.subjectName ?? matrix.subject_code ?? "-"],
      ["Khối lớp", matrix.grade ? `Lớp ${matrix.grade}` : "-"],
      [
        "Thời gian",
        `${matrix.duration_min} phút (không kể thời gian phát đề)`,
      ],
      ["Tổng điểm", String(matrix.total_points)],
      ["Số câu", String(picked.length)],
      ...(th
        ? ([
            ["Họ và tên học sinh", "................................................"],
            ["Lớp", "..........  Mã phách: .........."],
            [
              "Điểm - Nhận xét",
              "(Theo TT 22/2021: thang 10, không cho điểm 0 và điểm thập phân ở điểm tổng bài)",
            ],
          ] as [string, string][])
        : []),
    ],
    sections,
    appendix: [
      {
        title: "HƯỚNG DẪN CHẤM - ĐÁP ÁN",
        blocks: [
          {
            kind: "table",
            header: ["Phần", "Câu", "Mã câu hỏi", "Đáp án", "Điểm"],
            rows: ansRows,
          },
          ...(partOf.get("true_false_4")?.length
            ? [{ kind: "para" as const, text: tfNote }]
            : []),
          ...(unr.length
            ? [
                {
                  kind: "note" as const,
                  text: `${unr.length} câu trong đề chưa được đánh dấu "đã duyệt" trong ngân hàng câu hỏi - nên rà soát nội dung trước khi dùng thi chính thức: ${unr
                    .slice(0, 12)
                    .map((p) => p.q.code ?? "?")
                    .join(", ")}${unr.length > 12 ? ` ... và ${unr.length - 12} câu nữa` : ""}.`,
                },
              ]
            : []),
          ...picked
            .filter((p) => p.q.solution)
            .map((p) => ({
              kind: "para" as const,
              text: `${p.dispLabel ?? "Câu"}: ${p.q.solution}`,
            })),
          ...(() => {
            const noSol = picked.filter(
              (p) => !p.q.solution && !p.q.id.startsWith("missing-"),
            );
            return noSol.length
              ? [
                  {
                    kind: "para" as const,
                    text: `Câu chưa có lời giải (cần bổ sung trong ngân hàng): ${noSol
                      .map(
                        (p) =>
                          `${p.dispLabel ?? "?"}${p.q.code ? ` (${p.q.code})` : ""}`,
                      )
                      .join(", ")}.`,
                  },
                ]
              : [];
          })(),
        ],
      },
    ],
  };
}

function buildReviewDoc(matrixTitle: string, th: boolean): DocContent {
  return {
    title: "BIÊN BẢN PHẢN BIỆN ĐỀ KIỂM TRA",
    meta: [
      ["Đề kiểm tra", matrixTitle],
      ["Thời gian", "...... giờ ......, ngày ...../...../20......"],
      ["Địa điểm", "................................................"],
      ["Chủ tọa", "................................................"],
      ["Thư ký", "................................................"],
      ["Ủy viên", "................................................"],
    ],
    sections: [
      {
        title: "1. Thông qua quy trình phản biện",
        blocks: [
          {
            kind: "para",
            text: th
              ? "Chủ tọa thông qua quy trình phản biện đề kiểm tra; phổ biến các văn bản hướng dẫn liên quan: Thông tư 22/2021/TT-BGDĐT về đánh giá học sinh tiểu học (Điều 10 - đánh giá định kì, đề theo 4 mức); các hướng dẫn của Phòng GD&ĐT và nhà trường."
              : "Chủ tọa thông qua quy trình phản biện đề kiểm tra; phổ biến các văn bản hướng dẫn liên quan: Công văn số 7991/BGDĐT-GDTrH ngày 17/12/2024 của Bộ Giáo dục và Đào tạo; các hướng dẫn của Sở GD&ĐT và nhà trường.",
          },
        ],
      },
      {
        title: "2. Thông tin đề kiểm tra",
        blocks: [
          {
            kind: "list",
            items: [
              "Giáo viên ra đề: ................................................",
              "Giáo viên phản biện: ................................................",
              th
                ? "Hình thức: trắc nghiệm kết hợp tự luận (mức 1-4 theo TT 22/2021)."
                : "Hình thức: trắc nghiệm kết hợp tự luận (70% trắc nghiệm - 30% tự luận).",
              th
                ? "Cấu trúc: Phần I - trắc nghiệm (khoanh chữ cái, đúng/sai, điền/trả lời ngắn); Phần II - tự luận."
                : "Cấu trúc: Phần I - trắc nghiệm nhiều lựa chọn (3,0đ); Phần II - đúng/sai 4 ý (2,0đ); Phần III - trả lời ngắn (2,0đ); Phần IV - tự luận (3,0đ).",
              "Bộ hồ sơ kèm theo: đề chính thức, đề dự phòng, đáp án - hướng dẫn chấm, ma trận - bản đặc tả.",
            ],
          },
        ],
      },
      {
        title: "3. Nhận xét của giáo viên phản biện",
        blocks: [
          {
            kind: "table",
            header: ["Nội dung", "Đề chính thức", "Đề dự phòng"],
            rows: [
              [
                "Cấu trúc đề theo ma trận - bản đặc tả",
                "Đạt / Chưa đạt",
                "Đạt / Chưa đạt",
              ],
              [
                "Mức độ nhận thức đúng yêu cầu cần đạt",
                "Đạt / Chưa đạt",
                "Đạt / Chưa đạt",
              ],
              ["Đáp án và hướng dẫn chấm đầy đủ, đúng", "Đạt / Chưa đạt", "Đạt / Chưa đạt"],
              ["Chính tả, thuật ngữ, trình bày", "Đạt / Chưa đạt", "Đạt / Chưa đạt"],
            ],
          },
          { kind: "para", text: "Ý kiến cụ thể: ................................................" },
          { kind: "para", text: "Kết luận: Đề kiểm tra ĐẠT / CHƯA ĐẠT yêu cầu." },
        ],
      },
    ],
    appendix: [
      {
        title: "CHỮ KÝ",
        blocks: [
          {
            kind: "table",
            header: ["Chủ tọa", "Thư ký", "Ủy viên"],
            rows: [["(Ký, ghi rõ họ tên)", "(Ký, ghi rõ họ tên)", "(Ký, ghi rõ họ tên)"]],
          },
        ],
      },
    ],
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const tool = TOOL_MAP.get(code);
  if (!tool) {
    return NextResponse.json({ error: "Công cụ không tồn tại." }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId)
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const user = { id: userId };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id, full_name")
    .eq("id", user.id)
    .single();
  if (!profile || !TOOL_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }
  // FK tvc.* -> tvc.profiles: provisiona il profilo tvc al primo uso (CR-023)
  await ensureTvcProfile();

  const input = (await req.json().catch(() => ({}))) as Record<string, string>;

  let subject: Subject | null = null;
  let standards: CurriculumStandard[] = [];
  const grade = input.grade ? Number(input.grade) : null;

  if (input.subject) {
    const { data } = await supabase
      .from("tvc_subjects")
      .select("*")
      .eq("code", input.subject)
      .single();
    subject = (data as Subject | null) ?? null;
  }
  const stdIds = (input.standard_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (stdIds.length) {
    const { data } = await supabase
      .from("tvc_curriculum_standards")
      .select("*")
      .in("id", stdIds);
    standards = (data as CurriculumStandard[]) ?? [];
  }

  const ctx: ToolContext = { subject, grade, standards };

  // DC-01 (CR-026): nap bieu mau KHBD theo truong vao ctx.extra
  if (code === "DC-01" && input.khbd_template) {
    const { data: tpl } = await supabase
      .from("tvc_khbd_templates")
      .select("name, activities, include_review, include_signoff")
      .eq("id", input.khbd_template)
      .single();
    if (tpl) ctx.extra = { khbdTemplate: tpl };
  }

  // DC-03: sinh đề từ ngân hàng câu hỏi theo ma trận đã chọn
  if (code === "DC-03") {
    const matrixId = input.matrix_id;
    if (!matrixId) {
      return NextResponse.json({ error: "Chưa chọn ma trận." }, { status: 400 });
    }
    const { data: matrix } = await supabase
      .from("tvc_matrices")
      .select("*")
      .eq("id", matrixId)
      .eq("owner_id", user.id)
      .single();
    if (!matrix) {
      return NextResponse.json({ error: "Ma trận không tồn tại." }, { status: 404 });
    }
    const cells = (matrix.cells as MatrixCell[]) ?? [];
    const pack = input.pack ?? "full";
    const tfScore = input.tf_score ?? "linear";

    const approvedOnly = input.approved_only === "yes";
    const used = new Set<string>();
    const usedStems = new Set<string>();
    const usable = (x: Question, extraUsed?: Set<string>) =>
      !used.has(x.id) &&
      !extraUsed?.has(x.id) &&
      !usedStems.has(stemKey(x.stem)) &&
      !hasControl(x.stem) &&
      (x.review_state ?? "unreviewed") !== "flagged" &&
      (!approvedOnly || x.review_state === "approved") &&
      !referencesMissingContext(x.stem, x.context) &&
      (x.qtype !== "multiple_choice" ||
        ["A", "B", "C", "D"].every((l) =>
          new RegExp(`\\b${l}[.)]`).test(x.stem),
        ));
    const pickFrom = async (
      cell: MatrixCell,
      extraQtype: boolean,
    ): Promise<Question[]> => {
      let q = supabase
        .from("tvc_questions")
        .select("*")
        .eq("owner_id", user.id)
        .contains("standard_ids", [cell.standard_id])
        .limit(Math.max(cell.count * 8, 24));
      if (!extraQtype) q = q.eq("qtype", cell.qtype);
      const { data } = await q;
      return ((data as Question[]) ?? []).filter((x) => usable(x));
    };

    const missingQ = (cell: MatrixCell, i: number): Question => ({
      id: `missing-${cell.standard_id}-${cell.qtype}-${cell.level}-${i}`,
      owner_id: user.id,
      code: null,
      stem: `[THIẾU CÂU HỎI - cần bổ sung vào ngân hàng: ${cell.standard_code ?? ""} / ${cell.level} / ${cell.qtype}]`,
      context: null,
      qtype: cell.qtype as Question["qtype"],
      level: cell.level as Question["level"],
      points: cell.points,
      answer: {},
      solution: null,
      standard_ids: [cell.standard_id],
      subject_code: matrix.subject_code,
      grade: matrix.grade,
      source: "generated",
      review_state: "unreviewed",
      created_at: "",
    });

    // Rút cho 1 mã đề; excludeIds = câu đã dùng ở đề trước (đề dự phòng ưu tiên câu khác)
    const buildPicked = async (
      excludeIds: Set<string>,
      excludeStems: Set<string>,
    ): Promise<Picked[]> => {
      const result: Picked[] = [];
      for (const cell of cells) {
        const sameQtype = await pickFrom(cell, false);
        const t1 = sameQtype.filter((x) => x.level === cell.level);
        const t2 = sameQtype.filter((x) => x.level !== cell.level);
        const t3 = (await pickFrom(cell, true)).filter(
          (x) => !sameQtype.includes(x),
        );
        const fresh = [...t1, ...t2, ...t3].filter(
          (x) => !excludeIds.has(x.id) && !excludeStems.has(stemKey(x.stem)),
        );
        const rest = [...t1, ...t2, ...t3].filter(
          (x) => excludeIds.has(x.id) || excludeStems.has(stemKey(x.stem)),
        );
        const pool = [...fresh, ...rest];
        for (let i = 0; i < cell.count; i++) {
          const q = pool[i];
          if (q) {
            used.add(q.id);
            usedStems.add(stemKey(q.stem));
            result.push({
              q,
              cell,
              review:
                q.level !== cell.level ||
                q.qtype !== cell.qtype ||
                excludeIds.has(q.id),
            });
          } else {
            result.push({ q: missingQ(cell, i), cell, review: true });
          }
        }
      }
      return result;
    };

    // Đề chính thức
    const pickedCT = await buildPicked(new Set(), new Set());
    const { data: exam, error: exErr } = await supabase
      .from("tvc_exams")
      .insert({
        owner_id: user.id,
        matrix_id: matrixId,
        title: matrix.title,
        subject_code: matrix.subject_code,
        grade: matrix.grade,
        total_points: matrix.total_points,
        config: {
          shuffle: input.shuffle === "yes",
          pack,
          tf_score: tfScore,
          missing: pickedCT.filter((p) => p.q.id.startsWith("missing-")).length,
          unreviewed: pickedCT.filter(
            (p) =>
              !p.q.id.startsWith("missing-") &&
              (p.q.review_state ?? "unreviewed") !== "approved",
          ).length,
        },
      })
      .select()
      .single();
    if (exErr || !exam) {
      return NextResponse.json({ error: "Không lưu được đề." }, { status: 500 });
    }
    const realCT = pickedCT.filter((p) => !p.q.id.startsWith("missing-"));
    if (realCT.length) {
      await supabase.from("tvc_exam_questions").insert(
        realCT.map((p, i) => ({
          exam_id: exam.id,
          question_id: p.q.id,
          position: i + 1,
          points: p.cell.points / Math.max(p.cell.count, 1),
          needs_review: p.review,
        })),
      );
    }

    const subjectName = subject?.name ?? matrix.subject_code ?? "-";
    const docCT = buildExamDoc(
      pickedCT,
      { ...matrix, title: matrix.title },
      { tfScore, subjectName },
    );

    // Đề dự phòng + biên bản phản biện (pack=full)
    let docDB: DocContent | null = null;
    let docBBPB: DocContent | null = null;
    if (pack === "full") {
      const ctIds = new Set(realCT.map((p) => p.q.id));
      const ctStems = new Set(realCT.map((p) => stemKey(p.q.stem)));
      const pickedDB = await buildPicked(ctIds, ctStems);
      const realDB = pickedDB.filter((p) => !p.q.id.startsWith("missing-"));
      const { data: examDB } = await supabase
        .from("tvc_exams")
        .insert({
          owner_id: user.id,
          matrix_id: matrixId,
          title: `${matrix.title} - DỰ PHÒNG`,
          subject_code: matrix.subject_code,
          grade: matrix.grade,
          total_points: matrix.total_points,
          config: { pack: "du_phong", tf_score: tfScore },
        })
        .select()
        .single();
      if (examDB && realDB.length) {
        await supabase.from("tvc_exam_questions").insert(
          realDB.map((p, i) => ({
            exam_id: examDB.id,
            question_id: p.q.id,
            position: i + 1,
            points: p.cell.points / Math.max(p.cell.count, 1),
            needs_review: p.review,
          })),
        );
      }
      docDB = buildExamDoc(
        pickedDB,
        { ...matrix, title: matrix.title },
        { variantLabel: "DỰ PHÒNG", tfScore, subjectName },
      );
      docBBPB = buildReviewDoc(matrix.title, (matrix.grade ?? 6) <= 5);
    }

    await supabase.from("tvc_generations").insert({
      user_id: user.id,
      tool_code: code,
      input,
      output: {
        exam_id: exam.id,
        missing: pickedCT.filter((p) => p.q.id.startsWith("missing-")).length,
      },
      provider: "question-bank",
      model: null,
    });

    return NextResponse.json({
      doc: docCT,
      docDB,
      docBBPB,
      examId: exam.id,
      missing: pickedCT.filter((p) => p.q.id.startsWith("missing-")).length,
      review: pickedCT.filter(
        (p) => p.review && !p.q.id.startsWith("missing-"),
      ).length,
      provider: "question-bank",
      usedFallback: true,
    });
  }

  // DC-02: rule-based, đồng thời trả cells/spec để lưu ma trận
  if (code === "DC-02") {
    const r = fbMatrix(input, ctx);
    await supabase.from("tvc_generations").insert({
      user_id: user.id,
      tool_code: code,
      input,
      output: { cells: r.cells.length },
      provider: "rule-based",
      model: null,
    });
    return NextResponse.json({
      doc: r.doc,
      matrix: { cells: r.cells, spec: r.spec },
      provider: "rule-based",
      usedFallback: true,
    });
  }

  // Các tool còn lại: AI -> engine dự phòng (quota) -> rule-based
  const { system, prompt } = tool.buildPrompt(input, ctx);
  const ai = await generateDoc(system, prompt);

  if (!ai.doc && ai.error === "quota") {
    const job = await fallbackToDevin({
      supabase,
      kind: `tvc-tool:${code}`,
      prompt: `${system}\n\n${prompt}`,
      expectedShape:
        '{"title":"...","meta":[["nhan","gia tri"]],"sections":[{"title":"...","blocks":[{"kind":"para|list|table|note|kv","text|items|rows|header":"..."}]}]}',
      createdBy: user.id,
      req,
    });
    if (job) {
      await supabase.from("tvc_generations").insert({
        user_id: user.id,
        tool_code: code,
        input,
        output: { pending_job: job.jobId },
        provider: "fallback-engine",
        model: null,
      });
      return NextResponse.json({
        pending: true,
        jobId: job.jobId,
        sessionUrl: job.devinUrl,
      });
    }
  }

  const doc = ai.doc ?? tool.fallback(input, ctx);
  const provider = ai.doc ? ai.provider : "rule-based";

  await supabase.from("tvc_generations").insert({
    user_id: user.id,
    tool_code: code,
    input,
    output: doc,
    provider: provider ?? ai.provider,
    model: null,
  });

  return NextResponse.json({
    doc,
    provider: provider ?? "rule-based",
    usedFallback: !ai.doc,
    aiError: ai.error,
  });
}

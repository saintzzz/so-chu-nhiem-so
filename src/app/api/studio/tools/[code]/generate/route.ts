import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOOL_MAP } from "@/lib/tvc/registry";
import { fbMatrix } from "@/lib/tvc/fallbacks";
import { generateDoc, sectionsLookEnglish } from "@/lib/tvc/ai-json";
import { sanitizeKhbdDoc, docToPlainText } from "@/lib/tvc/khbd-doc";
import { fallbackToDevin } from "@/lib/devin";
import { takeAiQuota, recordAiUsage } from "@/lib/ai-quota";
import {
  redactPiiText,
  minimizePrompt,
  minimizeDeep,
  deanonymizeDeep,
  collectUsedNames,
} from "@/lib/ai-privacy";
import { schoolPiiNames } from "@/lib/ai-pii-roster";
import { ensureTvcProfile } from "@/lib/tvc/profile";
import { hasFeature } from "@/lib/permissions";
import { referencesMissingContext } from "@/lib/tvc/question-validate";
import { renderFigure } from "@/lib/tvc/figures";
import type { ToolContext } from "@/lib/tvc/types";
import type { CurriculumStandard, DocContent, Question, Subject } from "@/types/tvc";
import type { Role } from "@/types";
import { hasAnyRole } from "@/lib/roles";

const TOOL_ROLES: Role[] = ["gvcn", "gvbm", "to_truong", "bgh", "admin"];

// CR-042: sinh doc dai bang AI can >60s khi plan cho phep; khong anh huong
// neu Vercel cap thap hon (mac dinh van 60s, AI timeout 55s van vua).
export const maxDuration = 120;

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
      // CR-031: cau co hinh -> chen image block ngay sau cau
      const media = (p.q as { media?: { kind: string; spec?: never; path?: string; alt?: string }[] }).media;
      if (media?.length) {
        flushList();
        for (const m of media) {
          if (m.kind === "figure" && m.spec) {
            blocks.push({
              kind: "image",
              svg: renderFigure(m.spec as never),
              caption: m.alt,
            });
          } else if (m.kind === "image" && m.path) {
            blocks.push({ kind: "image", path: m.path, caption: m.alt });
          }
        }
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
  // R3: deadline chung cua route - TTS + upload chi la "nice-to-have", khong
  // duoc pha vao timeout 120s (r3 finding 7).
  const routeStartedAt = Date.now();
  const ROUTE_BUDGET_MS = 115_000;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId)
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const user = { id: userId };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id, full_name, concurrent_roles")
    .eq("id", user.id)
    .single();
  if (!profile || !hasAnyRole(profile, TOOL_ROLES)) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }
  // CR-034: feature grant studio.ai chan o tang route, khong chi page
  if (!(await hasFeature("studio.ai")) || !(await hasFeature("studio"))) {
    return NextResponse.json({ error: "Tính năng đã bị quản trị tắt." }, { status: 403 });
  }
  // FK tvc.* -> tvc.profiles: provisiona il profilo tvc al primo uso (CR-023)
  await ensureTvcProfile();

  // R16: khong tin body la Record<string,string> - coerce tung value ve
  // string, bo qua object/array/number khong hop le (tranh .split() 500
  // va prompt injection qua field dai bat thuong).
  const rawInput = (await req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const input: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawInput ?? {})) {
    if (typeof v === "string") input[k] = v.slice(0, 4000);
    else if (typeof v === "number" || typeof v === "boolean")
      input[k] = String(v);
  }

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

  // DC-06 (CR-042): sinh slide tu giao an da soan - nap noi dung KHBD
  // vao prompt thay vi bat GV nhap lai mon/khoi/YCCD. RLS tu loc quyen
  // doc material (cua minh / xuat ban / cung truong).
  if (code === "DC-06" && input.material_id) {
    const { data: mat } = await supabase
      .from("tvc_materials")
      .select("id, title, type, subject_code, grade, standard_ids, content")
      .eq("id", input.material_id)
      .single();
    if (!mat || mat.type !== "lesson_plan") {
      return NextResponse.json(
        { error: "Không tìm thấy giáo án nguồn (hoặc học liệu không phải KHBD)." },
        { status: 404 },
      );
    }
    // Bu trong tu material khi input thieu - API caller khong can truyen lai.
    if (!ctx.subject && mat.subject_code) {
      const { data } = await supabase
        .from("tvc_subjects")
        .select("*")
        .eq("code", mat.subject_code)
        .single();
      subject = (data as Subject | null) ?? null;
      ctx.subject = subject;
    }
    if (!ctx.grade && mat.grade) ctx.grade = mat.grade;
    if (!ctx.standards.length && mat.standard_ids?.length) {
      const { data } = await supabase
        .from("tvc_curriculum_standards")
        .select("*")
        .in("id", mat.standard_ids);
      standards = (data as CurriculumStandard[]) ?? [];
      ctx.standards = standards;
    }
    ctx.extra = {
      ...(ctx.extra ?? {}),
      khbdText: docToPlainText(mat.content as DocContent),
    };
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
    // R16: fetch 1 lan cho toan bo cells (truoc day 2 query noi tiep/cell)
    // va day eligibility filter xuong DB - truoc day limit truoc roi moi
    // loc review_state nen cau hop le nam sau limit bi bo sot.
    const allStdIds = [...new Set(cells.map((c) => c.standard_id))];
    // R2: fetch theo tung standard co cap rieng thay vi 1 query cap chung -
    // standard "hot" truoc day an het 5000 slots lam cell khac doi cau.
    // Moi standard lay toi da 300 ung vien (du cho moi cell dung no).
    // R4: cap theo (standard x qtype) van co the loc sot level can - 200
    // cau "nhan biet" an het slot cua 1 cau "van dung" cung qtype. Fetch
    // theo bo ba (standard x qtype x level) khop chinh xac yeu cau cell,
    // cong pool nho moi standard cho cac tier thay the (khac qtype/level).
    const TRIPLE_LIMIT = 120;
    const POOL_LIMIT = 80;
    const CHUNK = 8;
    const triples = [
      ...new Map(
        cells.map((c) => [
          `${c.standard_id}|${c.qtype}|${c.level}`,
          { sid: c.standard_id, qt: c.qtype, lv: c.level },
        ]),
      ).values(),
    ];
    const jobs = [
      ...triples.map((p) => ({
        sid: p.sid,
        qt: p.qt as string | null,
        lv: p.lv as string | null,
        limit: TRIPLE_LIMIT,
      })),
      ...allStdIds.map((sid) => ({
        sid,
        qt: null as string | null,
        lv: null as string | null,
        limit: POOL_LIMIT,
      })),
    ];
    const rawBank: Question[] = [];
    let bankFailed = false;
    for (let i = 0; i < jobs.length; i += CHUNK) {
      const batch = await Promise.all(
        jobs.slice(i, i + CHUNK).map((j) => {
          let q = supabase
            .from("tvc_questions")
            .select("*")
            .overlaps("standard_ids", [j.sid])
            .limit(j.limit);
          if (j.qt) q = q.eq("qtype", j.qt);
          if (j.lv) q = q.eq("level", j.lv);
          if (approvedOnly) q = q.eq("review_state", "approved");
          else q = q.neq("review_state", "flagged");
          return q;
        }),
      );
      for (const r of batch) {
        if (r.error) {
          bankFailed = true;
          console.error("[studio] exam bank fetch:", r.error.message);
        } else {
          rawBank.push(...((r.data ?? []) as Question[]));
        }
      }
    }
    // Loi DB khac voi "ngan hang thieu cau" - bao ro de GV khong nham.
    if (bankFailed) {
      return NextResponse.json(
        { error: "Không đọc được ngân hàng câu hỏi - vui lòng thử lại." },
        { status: 500 },
      );
    }
    const seenQ = new Set<string>();
    const bank = rawBank.filter((q) =>
      seenQ.has(q.id) ? false : (seenQ.add(q.id), true),
    );

    const pickFrom = (
      cell: MatrixCell,
      extraQtype: boolean,
    ): Question[] =>
      bank.filter(
        (x) =>
          (x.standard_ids ?? []).includes(cell.standard_id) &&
          (extraQtype || x.qtype === cell.qtype) &&
          usable(x),
      );

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
        const sqIds = new Set(sameQtype.map((x) => x.id));
        const t1 = sameQtype.filter((x) => x.level === cell.level);
        const t2 = sameQtype.filter((x) => x.level !== cell.level);
        const t3 = (await pickFrom(cell, true)).filter((x) => !sqIds.has(x.id));
        const fresh = [...t1, ...t2, ...t3].filter(
          (x) => !excludeIds.has(x.id) && !excludeStems.has(stemKey(x.stem)),
        );
        const rest = [...t1, ...t2, ...t3].filter(
          (x) => excludeIds.has(x.id) || excludeStems.has(stemKey(x.stem)),
        );
        const pool = [...fresh, ...rest];
        // Recheck used/stem at pick time - same question can appear in pools
        // of different cells; never insert the same question twice.
        let taken = 0;
        for (const q of pool) {
          if (taken >= cell.count) break;
          if (used.has(q.id) || usedStems.has(stemKey(q.stem))) continue;
          used.add(q.id);
          usedStems.add(stemKey(q.stem));
          taken++;
          result.push({
            q,
            cell,
            review:
              q.level !== cell.level ||
              q.qtype !== cell.qtype ||
              excludeIds.has(q.id),
          });
        }
        while (taken < cell.count) {
          result.push({ q: missingQ(cell, taken), cell, review: true });
          taken++;
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
      const { error: eqErr } = await supabase.from("tvc_exam_questions").insert(
        realCT.map((p, i) => ({
          exam_id: exam.id,
          question_id: p.q.id,
          position: i + 1,
          points: p.cell.points / Math.max(p.cell.count, 1),
          needs_review: p.review,
        })),
      );
      if (eqErr) {
        // Roll back the orphan exam row - a saved exam with no questions
        // is a silent integrity failure.
        await supabase.from("tvc_exams").delete().eq("id", exam.id);
        return NextResponse.json(
          { error: "Không lưu được câu hỏi của đề." },
          { status: 500 },
        );
      }
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
        const { error: eqDbErr } = await supabase
          .from("tvc_exam_questions")
          .insert(
            realDB.map((p, i) => ({
              exam_id: examDB.id,
              question_id: p.q.id,
              position: i + 1,
              points: p.cell.points / Math.max(p.cell.count, 1),
              needs_review: p.review,
            })),
          );
        if (eqDbErr) {
          await supabase.from("tvc_exams").delete().eq("id", examDB.id);
        }
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
  // CR-049 r9 H8 + r10 H8: input free-text (van ban/KHBD user dan vao)
  // co the chua ten HS/GV/PH - pseudonymize theo roster truoc ca
  // provider lan Devin (fail-closed). minimizeDeep TREN input TRUOC
  // khi buildPrompt JSON.stringify no - serialize truoc se lam ten
  // thanh chuoi escape khong khop regex redact.
  const roster = await schoolPiiNames((profile as { school_id?: string | null }).school_id ?? "",
  );
  if (roster.error) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  // CR-049 r12 H3: deanon/pii_map chi pham vi ten co trong input caller
  // - chan inject alias "HS001..." vao field tool de echo lo ten HS/GV/PH
  // ngoai pham vi campus (roster la full-school).
  // CR-049 r13 M: ctx cung la source - DC-06 nhung khbdText tu giao an
  // trong DB, DC-01 nhung template; ten trong do bi minimizePrompt alias
  // nhung neu thieu khoi used se khong duoc restore (alias leak output).
  const usedNames = collectUsedNames({ input, ctx }, roster.names);
  const { system, prompt } = tool.buildPrompt(
    minimizeDeep(input, roster.names),
    ctx,
  );
  const safePrompt = minimizePrompt(prompt, roster.names);
  // Tool tieng Anh: noi dung phai la tieng Anh - model yeu doi khi viet
  // tieng Viet, validate bat va retry voi nhac nho ro rang.
  const ENGLISH_TOOLS = new Set(["A-01", "A-03"]);
  const quotaOk = await takeAiQuota(`tvc-tool:${code}`, user.id);
  const ai = quotaOk
    ? await generateDoc(
        system,
        safePrompt,
        ENGLISH_TOOLS.has(code)
          ? {
          validate: sectionsLookEnglish,
          retryNote:
            "output truoc SAI YEU CAU: noi dung viet bang tieng Viet. Hoi thoai/bai doc va bai tap phai viet hoan toan bang TIENG ANH. Tra ve JSON hop le voi noi dung tieng Anh.",
          }
        : undefined,
    )
    // budget_block -> 'error' (khong qua Devin tra phi; chi quota cua
    // PROVIDER moi fallback).
    : { doc: null, provider: null, error: "error" };
  void recordAiUsage(
    `tvc-tool:${code}`,
    user.id,
    ai.provider,
    quotaOk ? (ai.doc ? "ok" : "error") : "budget_block",
  );

  // R4: Devin fallback cung nam trong budget route - tao session toi 20s
  // + insert/select jobs, khong duoc bat dau khi da gan het gio.
  const routeLeftForFallback =
    ROUTE_BUDGET_MS - (Date.now() - routeStartedAt);
  if (
    !ai.doc &&
    (ai.error === "quota" || ai.error === "bad_json") &&
    routeLeftForFallback > 15_000
  ) {
    const job = await fallbackToDevin({
      supabase,
      kind: `tvc-tool:${code}`,
      prompt: redactPiiText(`${system}\n\n${safePrompt}`),
      piiMap: usedNames,
      expectedShape:
        '{"title":"...","meta":[["nhan","gia tri"]],"sections":[{"title":"...","blocks":[{"kind":"para|list|table|note|kv","text|items|rows|header":"..."}]}]}',
      createdBy: user.id,
      req,
      timeoutMs: routeLeftForFallback - 5_000,
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

  // CR-037: DC-01 loc section lac de (dap an/phieu bai tap bi AI them vao
  // giao an); doc AI thieu khung bat buoc -> rule-based fallback.
  const aiDocRaw =
    code === "DC-01" && ai.doc ? sanitizeKhbdDoc(ai.doc) : ai.doc;
  // r9: doc tu provider mang alias HSxxx - khoi phuc ten that truoc
  // khi luu/tra ve (Devin async da duoc callback deanon).
  // r10 M: deanon tren cau truc da co, khong phai chuoi JSON tho -
  // deanonymizeNames(stringify) co the pha cau truc JSON khi ten that
  // chua ky tu dac biet.
  const aiDoc = aiDocRaw ? deanonymizeDeep(aiDocRaw, usedNames) : aiDocRaw;
  const doc = aiDoc ?? tool.fallback(input, ctx);
  const provider = aiDoc ? ai.provider : "rule-based";

  // A-03: TTS that cho hoi thoai - tach lượt "Name: line", tong hop 2 giong,
  // upload bucket tvc-media, chen block audio vao dau section hoi thoai.
  // Khong co OPENAI_API_KEY / TTS loi -> doc giu nguyen, khong chan generate.
  let audioPath: string | null = null;
  // CR-049 r6 H1: quota bi chan -> khong goi TTS tra phi (doc van tra
  // rule-based, chi thieu audio); chi khi con budget moi synthesize.
  if (code === "A-03" && doc?.sections?.length && quotaOk) {
    try {
      const { extractDialogueTurns, synthesizeDialogue, uploadTtsAudio } =
        await import("@/lib/tvc/tts");
      // CR-049 r10 H: TTS doc doc CON ALIAS (aiDocRaw truoc deanon) -
      // khong gui ten HS/GV that cho TTS provider.
      const turns = extractDialogueTurns(aiDocRaw ?? doc);
      const routeLeft = ROUTE_BUDGET_MS - (Date.now() - routeStartedAt);
      if (turns.length >= 2 && routeLeft >= 25_000) {
        const audio = await synthesizeDialogue(turns, routeLeft - 15_000);
        // R4: upload cung nam trong deadline route - ket qua TTS ve sau
        // khi het budget bi bo, khong upload muon.
        const leftAfter = ROUTE_BUDGET_MS - (Date.now() - routeStartedAt);
        if (audio && leftAfter > 8_000) {
          audioPath = await uploadTtsAudio(
            (profile as { school_id?: string | null }).school_id ?? null,
            audio,
          );
          if (audioPath) {
            const secIdx = doc.sections.findIndex((s) =>
              extractDialogueTurns({ sections: [s] }).length >= 2,
            );
            const target = secIdx >= 0 ? secIdx : 0;
            doc.sections[target].blocks = [
              {
                kind: "audio",
                path: audioPath,
                caption: `Audio hội thoại - ${turns.length} lượt`,
              },
              ...(doc.sections[target].blocks ?? []),
            ];
          }
        }
      }
    } catch (e) {
      console.error("[a03-tts] skipped:", e instanceof Error ? e.message : e);
    }
  }

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

import type { DocBlock, DocContent, DocSection, CurriculumStandard } from "@/types/tvc";
import type { ToolContext } from "./types";
import { LEVEL_LABEL, QTYPE_LABEL } from "./types";

type Input = Record<string, string>;

const stdList = (ctx: ToolContext): CurriculumStandard[] =>
  ctx.standards.length
    ? ctx.standards
    : [
        {
          id: "",
          code: "-",
          subject_code: "",
          grade: ctx.grade ?? 0,
          strand: "",
          lesson_ref: "",
          description: "Theo yêu cầu cần đạt của bài học đã chọn",
          competencies: [],
          version: "2025-2026",
          status: "active" as const,
        },
      ];

const stdDesc = (ctx: ToolContext) =>
  ctx.standards.map((s) => s.description).join("; ") ||
  "yêu cầu cần đạt của bài học";

const subjectName = (ctx: ToolContext) => ctx.subject?.name ?? "môn học";

// ---------- DC-01: Kế hoạch bài dạy ----------
interface KhbdTpl {
  name: string;
  activities: { name: string; minutes?: number; hint?: string }[];
  include_review: boolean;
  include_signoff: boolean;
}
const DEFAULT_KHBD: KhbdTpl = {
  name: "Khung 4 hoạt động (tham khảo Phụ lục IV - CV 5512)",
  activities: [
    { name: "Khởi động", minutes: 5, hint: "Tạo tâm thế, kết nối kiến thức cũ với bài học mới." },
    { name: "Khám phá", minutes: 20, hint: "" },
    { name: "Luyện tập", minutes: 12, hint: "Củng cố, vận dụng kiến thức vừa học vào bài tập cụ thể." },
    { name: "Vận dụng", minutes: 8, hint: "Vận dụng kiến thức vào tình huống thực tiễn, phát triển năng lực." },
  ],
  include_review: true,
  include_signoff: true,
};
// CR-037: cau truc moi hoat dong theo CV 5512 - cac buoc to chuc kem
// noi dung/san pham tuong ung (cot 2 cua bang).
interface KhbdStep {
  act: string;
  content: string;
}
const KHBD_STEPS: Record<string, KhbdStep[]> = {
  "Khởi động": [
    {
      act: "GV nêu câu hỏi/tình huống mở đầu gắn trực tiếp với nội dung bài học; HS suy nghĩ, trả lời theo ý kiến cá nhân.",
      content: "[GV điền câu hỏi/tình huống mở đầu cụ thể của bài]",
    },
    {
      act: "GV gọi 2-3 HS phát biểu, nhận xét câu trả lời, dẫn dắt vào bài mới.",
      content: "[Dự kiến câu trả lời của HS]",
    },
  ],
  "Khám phá": [
    {
      act: "GV tổ chức HS đọc thông tin, quan sát ví dụ/tình huống; HS làm việc cá nhân ghi nhận thông tin.",
      content: "[GV điền tư liệu/ví dụ/câu hỏi khám phá cụ thể]",
    },
    {
      act: "HS thảo luận nhóm đôi/nhóm 4 theo nhiệm vụ; GV quan sát, hỗ trợ nhóm gặp khó khăn.",
      content: "[Dự kiến sản phẩm thảo luận nhóm - đáp án/kết luận của các nhóm]",
    },
    {
      act: "Đại diện nhóm trình bày, nhóm khác nhận xét bổ sung; GV chốt kiến thức trọng tâm, ghi bảng.",
      content: "[GV ghi kiến thức chốt đầy đủ - định nghĩa/công thức/quy tắc]",
    },
  ],
  "Luyện tập": [
    {
      act: "HS làm bài tập cá nhân mức Biết - Hiểu; GV bao quát lớp, giúp HS yếu.",
      content: "[GV điền đề bài luyện tập cụ thể + đáp án dự kiến]",
    },
    {
      act: "HS đổi bài chấm chéo theo đáp án GV cung cấp; GV chữa lỗi sai phổ biến trước lớp.",
      content: "Kết quả chấm chéo và lỗi sai được sửa",
    },
  ],
  "Vận dụng": [
    {
      act: "GV giao nhiệm vụ vận dụng gắn bối cảnh thực tế; HS thực hiện cá nhân/nhóm và trình bày sản phẩm.",
      content: "[Dự kiến sản phẩm/bài giải của HS]",
    },
    {
      act: "GV nhận xét sản phẩm, dặn dò chuẩn bị bài sau.",
      content: "Nhận xét tổng kết và hướng dẫn về nhà",
    },
  ],
};
const KHBD_PRODUCT: Record<string, string> = {
  "Khởi động": "Câu trả lời/chia sẻ ban đầu của HS về tình huống mở đầu.",
  "Khám phá": "Kết quả thảo luận và ghi chép kiến thức trọng tâm của bài.",
  "Luyện tập": "Bài tập hoàn chỉnh trong vở, đã được chấm chéo và sửa lỗi.",
  "Vận dụng": "Sản phẩm vận dụng liên hệ thực tế của HS.",
};
const KHBD_ASSESS: Record<string, string> = {
  "Khởi động": "GV quan sát mức độ tham gia, ghi nhận HS tích cực phát biểu.",
  "Khám phá": "GV đánh giá qua sản phẩm nhóm, câu trả lời trình bày và mức độ chính xác của kiến thức chốt.",
  "Luyện tập": "GV đánh giá qua bài làm cá nhân và kết quả chấm chéo; ghi nhận HS cần hỗ trợ thêm.",
  "Vận dụng": "GV nhận xét sản phẩm vận dụng, đánh giá khả năng liên hệ kiến thức với thực tế.",
};
export function fbLessonPlan(input: Input, ctx: ToolContext): DocContent {
  const stds = stdList(ctx);
  const title = input.lesson || ctx.standards[0]?.lesson_ref || "Bài dạy";
  const tpl = (ctx.extra?.khbdTemplate as KhbdTpl | undefined) ?? DEFAULT_KHBD;
  // CR-037: moi hoat dong du 5 muc a)-d) + bang to chuc 2 cot theo CV 5512
  const act = (a: KhbdTpl["activities"][number], i: number, goal: string, content: string): DocSection => {
    const steps = KHBD_STEPS[a.name] ?? [
      { act: "GV tổ chức hoạt động theo nhiệm vụ đã thiết kế; HS thực hiện cá nhân/nhóm và trình bày kết quả.", content },
      { act: "GV nhận xét, chốt ý chính của hoạt động.", content },
    ];
    const base = a.name.replace(/^Hoạt động\s*/i, "");
    return {
      title: `Hoạt động ${i + 1}. ${base}${a.minutes ? ` (${a.minutes} phút)` : ""}`,
      blocks: [
        { kind: "heading", level: 3, text: "a) Mục tiêu" },
        { kind: "para", text: goal },
        { kind: "heading", level: 3, text: "b) Nội dung" },
        { kind: "para", text: content },
        { kind: "heading", level: 3, text: "c) Tổ chức hoạt động" },
        {
          kind: "table",
          header: ["Hoạt động của giáo viên và học sinh", "Nội dung"],
          rows: steps.map((s) => [s.act, s.content]),
        },
        { kind: "heading", level: 3, text: "d) Sản phẩm" },
        { kind: "para", text: KHBD_PRODUCT[base] ?? "Sản phẩm học tập của HS sau hoạt động." },
        { kind: "heading", level: 3, text: "đ) Đánh giá" },
        { kind: "para", text: KHBD_ASSESS[base] ?? "GV quan sát, nhận xét và ghi nhận kết quả của HS." },
      ],
    };
  };
  return {
    title: `KẾ HOẠCH BÀI DẠY - ${title.toUpperCase()}`,
    meta: [
      ["Môn học", subjectName(ctx)],
      ["Khối lớp", ctx.grade ? `Lớp ${ctx.grade}` : "-"],
      ["Thời lượng", input.duration || "1 tiết"],
      ["Biểu mẫu", tpl.name],
      [
        "Yêu cầu cần đạt",
        stds
          .map((s) => s.code)
          .filter((c) => c !== "-")
          .join(", ") || "-",
      ],
    ],
    sections: [
      {
        title: "I. MỤC TIÊU",
        blocks: [
          {
            kind: "note",
            text: "BẢN KHUNG MẪU - AI tạm không khả dụng. Các mục trong ngoặc [ ] cần giáo viên điền câu hỏi/nội dung cụ thể của bài trước khi dùng.",
          },
          { kind: "heading", level: 3, text: "1. Về kiến thức" },
          { kind: "list", items: stds.map((s) => s.description) },
          { kind: "heading", level: 3, text: "2. Về năng lực" },
          {
            kind: "list",
            items: [
              "Năng lực chung: tự chủ và tự học, giao tiếp và hợp tác, giải quyết vấn đề và sáng tạo.",
              `Năng lực đặc thù môn ${subjectName(ctx)} theo yêu cầu cần đạt của bài học.`,
            ],
          },
          { kind: "heading", level: 3, text: "3. Về phẩm chất" },
          {
            kind: "list",
            items: ["Chăm chỉ, trách nhiệm, trung thực trong học tập."],
          },
        ],
      },
      {
        title: "II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU",
        blocks: [
          {
            kind: "list",
            items: [
              "Giáo viên: máy chiếu, bài trình chiếu, phiếu học tập.",
              "Học sinh: sách giáo khoa, vở ghi, đồ dùng học tập.",
            ],
          },
        ],
      },
      {
        title: "III. TIẾN TRÌNH DẠY HỌC",
        blocks: [],
      },
      ...tpl.activities.map((a, i) =>
        act(
          a,
          i,
          a.hint ||
            (a.name === "Khám phá"
              ? `Hình thành kiến thức mới: ${stdDesc(ctx)}.`
              : "Thực hiện nhiệm vụ học tập của hoạt động."),
          // CR-042: danh dau cho trong can GV dien, khong viet noi dung gia
          a.name === "Khám phá"
            ? `Nội dung trọng tâm: ${stdDesc(ctx)}. [GV điền: câu hỏi/bài tập/nhiệm vụ cụ thể của hoạt động]`
            : `[GV điền: câu hỏi/nhiệm vụ/bài tập cụ thể của hoạt động ${a.name} - bám mục tiêu và YCCĐ của bài]`,
        ),
      ),
      ...(tpl.include_review
        ? [
            {
              title: "IV. ĐIỀU CHỈNH SAU BÀI DẠY",
              blocks: [
                {
                  kind: "para",
                  text: ".........................................................................................................................................................................",
                },
                {
                  kind: "para",
                  text: ".........................................................................................................................................................................",
                },
              ],
            } as DocSection,
          ]
        : []),
      ...(tpl.include_signoff
        ? [
            {
              title: "KÝ DUYỆT",
              blocks: [
                {
                  kind: "table",
                  header: ["TỔ TRƯỞNG KIỂM TRA", "NGƯỜI SOẠN"],
                  rows: [["(Ký và ghi rõ họ tên)", "(Ký và ghi rõ họ tên)"]],
                },
              ],
            } as DocSection,
          ]
        : []),
    ],
    appendix: [
      {
        title: "PHỤ LỤC: DỰ KIẾN SẢN PHẨM VÀ ĐÁNH GIÁ",
        blocks: [
          {
            kind: "table",
            header: ["Hoạt động", "Sản phẩm học sinh", "Phương án đánh giá"],
            rows: [
              ["Khởi động", "Câu trả lời miệng", "Quan sát, hỏi đáp nhanh"],
              [
                "Khám phá",
                "Phiếu học tập nhóm",
                "Đánh giá theo tiêu chí sản phẩm nhóm",
              ],
              ["Luyện tập", "Bài làm cá nhân", "Chấm chéo, chữa lỗi"],
              ["Vận dụng", "Sản phẩm vận dụng", "Nhận xét định tính"],
            ],
          },
        ],
      },
    ],
  };
}

// ---------- DC-02: Ma trận đề + bản đặc tả ----------
export interface MatrixCellOut {
  standard_id: string;
  standard_code: string;
  level: string;
  qtype: string;
  count: number;
  points: number;
}

export interface MatrixResult {
  doc: DocContent;
  cells: MatrixCellOut[];
  spec: {
    standard_id: string;
    standard_code: string;
    requirement: string;
    competencies: string[];
    level: string;
    qtype: string;
    count: number;
    points: number;
  }[];
}

// Nhan muc do theo khung: cap TH dung TT 22/2021 (Muc 1-4), THCS/THPT dung CV 7991.
export function levelLabel(level: string, framework: "tt22" | "cv7991" = "cv7991"): string {
  if (framework === "tt22") {
    return (
      {
        biet: "Mức 1 (Nhận biết)",
        hieu: "Mức 2 (Hiểu)",
        van_dung: "Mức 3 (Vận dụng)",
        van_dung_cao: "Mức 4 (Vận dụng linh hoạt)",
      }[level] ?? level
    );
  }
  return LEVEL_LABEL[level] ?? level;
}

export function fbMatrix(input: Input, ctx: ToolContext): MatrixResult {
  const stds = ctx.standards.length
    ? ctx.standards
    : ([
        {
          id: "x",
          code: "YCCD",
          description: "Yêu cầu cần đạt của phạm vi kiểm tra",
        },
      ] as CurriculumStandard[]);
  const total = Number(input.total_points) || 10;
  const duration = Number(input.duration) || 45;
  const nStd = stds.length;

  // Cap TH (lop <= 5): de dinh ky theo TT 22/2021 Dieu 10 - 4 muc
  // (Nhan biet / Hieu / Van dung / Van dung linh hoat), TN + TL thang 10.
  // Cap THCS/THPT: CV 7991 - TN 3.0 - Đ/S 2.0 - TL ngan 2.0 - Tu luan 3.0.
  const th = (ctx.grade ?? 6) <= 5;
  const framework = th ? "tt22" : "cv7991";
  const cells: MatrixCellOut[] = [];
  const spec: MatrixResult["spec"] = [];
  const typeCycle = ["multiple_choice", "true_false_4", "short_answer", "essay"];
  const typeWeight: Record<string, number> = th
    ? { multiple_choice: 3, true_false_4: 1.5, short_answer: 1, essay: 4.5 }
    : { multiple_choice: 3, true_false_4: 2, short_answer: 2, essay: 3 };
  const unit: Record<string, number> = th
    ? { multiple_choice: 0.5, true_false_4: 1, short_answer: 0.5, essay: 2.5 }
    : { multiple_choice: 0.25, true_false_4: 0.5, short_answer: 1, essay: 3 };
  // Muc do phan bo theo vong trong moi dang thuc - tranh ma tran don dieu.
  // TH (TT22): 4 muc la chuan chinh thuc (Muc 4 = van_dung_cao).
  // THCS/THPT (CV 7991): 3 muc Biet-Hieu-Van dung; "Vận dụng cao" chi xuat hien
  // khi nguoi dung bat tuy chon (input.vdc=1) - dung cho de nang cao/BDHSG.
  const useVdc = input.vdc === "1" || input.vdc === "yes";
  const typeLevelCycle: Record<string, string[]> = th
    ? {
        multiple_choice: ["biet", "hieu", "biet", "hieu", "van_dung"],
        true_false_4: ["biet", "hieu", "van_dung"],
        short_answer: ["hieu", "van_dung"],
        essay: ["van_dung", "van_dung_cao"],
      }
    : {
        multiple_choice: ["biet", "hieu", "biet", "van_dung"],
        true_false_4: ["hieu", "biet", "van_dung", "hieu"],
        short_answer: ["hieu", "van_dung", "hieu", "van_dung"],
        essay: useVdc
          ? ["van_dung", "van_dung_cao"]
          : ["van_dung", "hieu", "van_dung"],
      };
  const totalWeight = Object.values(typeWeight).reduce((a, b) => a + b, 0);

  stds.forEach((s, si) => {
    const share = total / nStd;
    typeCycle.forEach((qtype, ti) => {
      const pts = Math.round((share * typeWeight[qtype] / totalWeight) * 4) / 4;
      if (pts <= 0) return;
      const count = Math.max(1, Math.round(pts / unit[qtype]));
      const cyc = typeLevelCycle[qtype];
      const level = cyc[si % cyc.length];
      cells.push({ standard_id: s.id, standard_code: s.code, level, qtype, count, points: pts });
      spec.push({
        standard_id: s.id,
        standard_code: s.code,
        requirement: s.description,
        competencies: s.competencies ?? [],
        level,
        qtype,
        count,
        points: pts,
      });
      void ti;
    });
  });

  // Bu chenh lech do lam tron: phan bo +-0.25 vao cac cell lon nhat truoc,
  // khong de cell nao xuong duoi diem toi thieu cua 1 cau.
  let diff = Math.round((total - cells.reduce((a, c) => a + c.points, 0)) * 100) / 100;
  const order = cells
    .map((c, i) => ({ i, pts: c.points }))
    .sort((a, b) => b.pts - a.pts);
  let guard = 1000;
  while (Math.abs(diff) >= 0.25 && guard-- > 0) {
    const step = diff > 0 ? 0.25 : -0.25;
    // Uu tien cell con du diem toi thieu 1 cau; neu khong co (tong nho,
    // cell deu thap) thi relax xuong floor 0.25 - van khong am.
    const target =
      order.find(({ i }) => cells[i].points + step >= unit[cells[i].qtype]) ??
      order.find(({ i }) => cells[i].points + step >= 0.25);
    if (!target) break;
    const cell = cells[target.i];
    cell.points = Math.round((cell.points + step) * 100) / 100;
    spec[target.i].points = cell.points;
    diff = Math.round((diff - step) * 100) / 100;
  }

  const totalCount = cells.reduce((a, c) => a + c.count, 0);
  const totalPts = Math.round(cells.reduce((a, c) => a + c.points, 0) * 100) / 100;

  const TERM_LABEL: Record<string, string> = {
    gk1: "GIỮA HỌC KÌ I",
    ck1: "CUỐI HỌC KÌ I",
    gk2: "GIỮA HỌC KÌ II",
    ck2: "CUỐI HỌC KÌ II",
    tx: "THƯỜNG XUYÊN",
  };
  const termLabel = TERM_LABEL[input.term ?? ""] ?? "ĐỊNH KÌ";

  const doc: DocContent = {
    title: `MA TRẬN ĐỀ KIỂM TRA ${termLabel} - ${subjectName(ctx).toUpperCase()}${ctx.grade ? ` LỚP ${ctx.grade}` : ""}`,
    meta: [
      ["Môn học", subjectName(ctx)],
      ["Khối lớp", ctx.grade ? `Lớp ${ctx.grade}` : "-"],
      ["Đợt kiểm tra", termLabel],
      ["Thời gian", `${duration} phút`],
      ["Tổng điểm", `${total} điểm`],
      [
        "Khung",
        th
          ? "TT 22/2021/TT-BGDĐT Điều 10: 4 mức (Nhận biết - Hiểu - Vận dụng - Vận dụng linh hoạt), TN kết hợp TL"
          : "CV 7991/BGDĐT-GDTrH: 3 mức độ x 4 dạng thức (3.0 - 2.0 - 2.0 - 3.0)",
      ],
    ],
    sections: [
      {
        title: "I. MA TRẬN ĐỀ",
        blocks: [
          {
            kind: "table",
            header: ["Yêu cầu cần đạt", "Mức độ", "Dạng thức", "Số câu", "Điểm"],
            rows: [
              ...cells.map((c) => [
                c.standard_code,
                levelLabel(c.level, framework),
                QTYPE_LABEL[c.qtype] ?? c.qtype,
                String(c.count),
                String(c.points),
              ]),
              ["TỔNG", "", "", String(totalCount), String(totalPts)],
            ],
          },
          {
            kind: "note",
            text: th
              ? `Đề kiểm tra định kỳ tiểu học theo TT 22/2021 (Điều 10): câu hỏi thiết kế theo 4 mức; bài chấm thang 10, không cho điểm 0, không cho điểm thập phân ở điểm tổng bài. Phân bổ: trắc nghiệm ${typeWeight.multiple_choice + typeWeight.true_false_4 + typeWeight.short_answer}đ - tự luận ${typeWeight.essay}đ.${
                  (input.term ?? "").startsWith("gk") && (ctx.grade ?? 0) <= 3
                    ? " Lưu ý: lớp 1-3 TT 22/2021 không bắt buộc kiểm tra giấy giữa kỳ - kiểm tra văn bản hướng dẫn của Sở GDĐT địa phương trước khi dùng."
                    : ""
                }`
              : `Phân bổ dạng thức theo CV 7991: trắc nghiệm ${typeWeight.multiple_choice}đ - đúng/sai ${typeWeight.true_false_4}đ - trả lời ngắn ${typeWeight.short_answer}đ - tự luận ${typeWeight.essay}đ (thang 10).`,
          },
        ],
      },
      {
        title: "II. BẢN ĐẶC TẢ",
        blocks: [
          {
            kind: "table",
            header: ["YCCĐ", "Yêu cầu kiểm tra", "Mức độ", "Dạng thức", "Năng lực", "Số câu", "Điểm"],
            rows: spec.map((s) => [
              s.standard_code,
              s.requirement,
              levelLabel(s.level, framework),
              QTYPE_LABEL[s.qtype] ?? s.qtype,
              (s.competencies ?? []).join(", ") || "-",
              String(s.count),
              String(s.points),
            ]),
          },
        ],
      },
    ],
  };
  return { doc, cells, spec };
}

// ---------- DC-05: Phiếu học tập ----------
export function fbWorksheet(input: Input, ctx: ToolContext): DocContent {
  const topic = input.lesson || ctx.standards[0]?.lesson_ref || "bài học";
  const task = (name: string, items: string[]): DocSection => ({
    title: name,
    blocks: [{ kind: "list", items }],
  });
  return {
    title: `PHIẾU HỌC TẬP - ${topic.toUpperCase()}`,
    meta: [
      ["Môn học", subjectName(ctx)],
      ["Khối lớp", ctx.grade ? `Lớp ${ctx.grade}` : "-"],
      ["Họ và tên", "................................................"],
      ["Lớp", ".........."],
    ],
    sections: [
      task("PHẦN I. KHỞI ĐỘNG", [
        "Câu 1. Viết lại những điều em đã biết về nội dung bài học (2 - 3 ý).",
        "Câu 2. Đặt 1 câu hỏi em muốn tìm hiểu trong bài hôm nay.",
      ]),
      task("PHẦN II. KHÁM PHÁ - LUYỆN TẬP", [
        `Câu 3. Nêu nội dung chính của bài học theo yêu cầu cần đạt: ${stdDesc(ctx)}.`,
        "Câu 4. Cho 1 ví dụ minh họa cho nội dung vừa học.",
        "Câu 5. Hoàn thành bài tập áp dụng theo hướng dẫn của giáo viên.",
      ]),
      task("PHẦN III. VẬN DỤNG", [
        "Câu 6. Vận dụng kiến thức để giải quyết tình huống thực tế sau: ................................",
        "Câu 7. Tự đánh giá mức độ hoàn thành của em: Tốt / Đạt / Cần cố gắng. Điều em còn chưa rõ: ........",
      ]),
    ],
    appendix: [
      {
        title: "ĐÁP ÁN GỢI Ý (dành cho giáo viên - tách riêng khi phát học sinh)",
        blocks: [
          {
            kind: "list",
            items: [
              "Câu 1-2: ghi nhận mức độ sẵn sàng, không chấm điểm.",
              "Câu 3-5: chấm theo mức đầy đủ ý theo yêu cầu cần đạt.",
              "Câu 6: đánh giá lập luận và tính hợp lý của phương án (rubric 3 mức).",
            ],
          },
        ],
      },
    ],
  };
}

// ---------- T-01: Biến thể bài toán ----------
export function fbVariants(input: Input, _ctx: ToolContext): DocContent {
  const src = input.problem ?? "";
  const count = Math.min(Math.max(Number(input.count) || 10, 5), 50);
  const nums = src.match(/-?\d+(?:[.,]\d+)?/g)?.map((n) => n.replace(",", ".")) ?? [];
  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    let v = src;
    nums.forEach((n, j) => {
      const base = parseFloat(n);
      const delta = (i + 1) * (base >= 100 ? 5 : base >= 10 ? 2 : 1) * (j % 2 === 0 ? 1 : -1);
      v = v.replace(n, String(base + delta));
    });
    items.push(v);
  }
  return {
    title: "BỘ BIẾN THỂ BÀI TOÁN",
    meta: [
      ["Bài gốc", src.slice(0, 120) + (src.length > 120 ? "..." : "")],
      ["Số biến thể", String(count)],
      [
        "Ghi chú",
        "Biến thể đổi số liệu, giữ nguyên cấu trúc - giáo viên rà soát trước khi dùng",
      ],
    ],
    sections: [
      { title: "BÀI TOÁN GỐC", blocks: [{ kind: "para", text: src }] },
      {
        title: "CÁC BIẾN THỂ",
        blocks: [{ kind: "list", items: items.map((v, i) => `Bài ${i + 1}: ${v}`) }],
      },
    ],
    appendix: [
      {
        title: "LỜI GIẢI GỢI Ý",
        blocks: [
          {
            kind: "note",
            text: "Các biến thể cùng cấu trúc với bài gốc - áp dụng cùng phương pháp giải, thay số liệu tương ứng. Giáo viên kiểm tra kết quả trước khi phát cho học sinh.",
          },
        ],
      },
    ],
  };
}

// ---------- T-02: Công thức ----------
export function fbFormula(input: Input, _ctx: ToolContext): DocContent {
  const tex = input.formula ?? "";
  return {
    title: "CÔNG THỨC ĐÃ SOẠN",
    sections: [
      { title: "Hiển thị", blocks: [{ kind: "formula", tex }] },
      { title: "Mã LaTeX", blocks: [{ kind: "para", text: tex }] },
    ],
  };
}

// ---------- V-02: Câu hỏi đọc hiểu ----------
export function fbReadingQuestions(input: Input, ctx: ToolContext): DocContent {
  const text = input.text ?? "";
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return {
    title: "BỘ CÂU HỎI ĐỌC HIỂU",
    meta: [
      ["Môn học", subjectName(ctx)],
      ["Khối lớp", ctx.grade ? `Lớp ${ctx.grade}` : "-"],
      ["Độ dài văn bản", `${wordCount} từ`],
    ],
    sections: [
      { title: "VĂN BẢN", blocks: [{ kind: "para", text }] },
      {
        title: "MỨC BIẾT - nhận diện và xác định thông tin",
        blocks: [
          {
            kind: "list",
            items: [
              "Câu 1 (TN nhiều lựa chọn): Văn bản viết về vấn đề/đối tượng nào? A. ... B. ... C. ... D. ...",
              "Câu 2 (Đúng - Sai, 4 ý): Xác định các phát biểu sau về chi tiết trong văn bản là đúng hay sai: a) ... b) ... c) ... d) ...",
            ],
          },
        ],
      },
      {
        title: "MỨC HIỂU - ý chính và ý đồ tác giả",
        blocks: [
          {
            kind: "list",
            items: [
              "Câu 3 (Trả lời ngắn): Nêu ý chính của văn bản trong 1 - 2 câu.",
              "Câu 4 (TN nhiều lựa chọn): Tác giả thể hiện thái độ/quan điểm gì qua văn bản? A. ... B. ... C. ... D. ...",
            ],
          },
        ],
      },
      {
        title: "MỨC VẬN DỤNG - liên hệ và đánh giá",
        blocks: [
          {
            kind: "list",
            items: [
              "Câu 5 (Tự luận): Em đồng tình hay không với quan điểm của tác giả? Trình bày ý kiến kèm lập luận và dẫn chứng.",
              "Câu 6 (Trả lời ngắn): Nêu thông điệp/bài học em rút ra và liên hệ thực tế bản thân.",
            ],
          },
        ],
      },
    ],
    appendix: [
      {
        title: "ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM",
        blocks: [
          {
            kind: "list",
            items: [
              "Câu 1-4: chấm theo đáp án đúng (giáo viên hoàn thiện phương án cụ thể).",
              "Câu 5: lập luận rõ, có dẫn chứng thuyết phục - 3 điểm theo rubric.",
              "Câu 6: liên hệ thực tế hợp lý - 2 điểm.",
            ],
          },
        ],
      },
    ],
  };
}

// ---------- A-01: Bài đọc theo cấp độ ----------
export function fbEnglishReading(input: Input, ctx: ToolContext): DocContent {
  const level = input.cefr || "A2";
  const text =
    "Every morning, Mai wakes up at six o'clock. She has breakfast with her family and then rides her bicycle to school. Her classes start at seven fifteen. At school, she studies many subjects such as Math, English and Science. She likes English best because she can sing songs and play games in class. After school, she does her homework and helps her mother cook dinner. Mai feels happy because every day she learns something new.";
  return {
    title: `READING PASSAGE - CEFR ${level}`,
    meta: [
      ["Chủ đề", input.topic || "Daily life"],
      ["Cấp độ", `Khung 6 bậc - ${level}`],
      ["Khối lớp", ctx.grade ? `Lớp ${ctx.grade}` : "-"],
    ],
    sections: [
      {
        title: "I. READING TEXT",
        blocks: [
          { kind: "heading", level: 3, text: "My School Day" },
          { kind: "para", text },
        ],
      },
      {
        title: "II. KEY VOCABULARY",
        blocks: [
          {
            kind: "table",
            header: ["Từ vựng", "Nghĩa", "Ví dụ trong bài"],
            rows: [
              ["wake up", "thức dậy", "wakes up at six o'clock"],
              ["ride a bicycle", "đạp xe đạp", "rides her bicycle to school"],
              ["subject", "môn học", "many subjects such as Math"],
              ["homework", "bài tập về nhà", "does her homework"],
            ],
          },
        ],
      },
      {
        title: "III. COMPREHENSION QUESTIONS",
        blocks: [
          {
            kind: "list",
            items: [
              "1. What time does Mai wake up? A. 5:00 B. 6:00 C. 7:00 D. 7:15",
              "2. How does she go to school? A. By bus B. By bicycle C. On foot D. By car",
              "3. Which subject does she like best? A. Math B. Science C. English D. Music",
              "4. True or False: Mai's classes start at 7:15.",
              "5. Answer shortly: What does Mai do after school?",
            ],
          },
        ],
      },
    ],
    appendix: [
      {
        title: "ANSWER KEY",
        blocks: [
          {
            kind: "list",
            items: [
              "1. B",
              "2. B",
              "3. C",
              "4. True",
              "5. She does her homework and helps her mother cook dinner.",
            ],
          },
        ],
      },
    ],
  };
}

// ---------- A-02: Bài tập từ vựng ----------
export function fbVocab(input: Input, _ctx: ToolContext): DocContent {
  const words = (input.words ?? "")
    .split(/[\n,;]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 20);
  const list = words.length
    ? words
    : ["apple", "school", "friend", "teacher", "book"];
  const scramble = (w: string) =>
    w.length > 2
      ? w[1] + w[0] + w.slice(2).split("").reverse().join("")
      : w.split("").reverse().join("");
  return {
    title: "BÀI TẬP TỪ VỰNG",
    meta: [["Số từ", String(list.length)]],
    sections: [
      {
        title: "1. Điền từ còn thiếu",
        blocks: [
          {
            kind: "list",
            items: list
              .slice(0, 8)
              .map(
                (w, i) =>
                  `${i + 1}. I like ________. (${w[0]}${"_".repeat(Math.max(w.length - 1, 1))})`,
              ),
          },
        ],
      },
      {
        title: "2. Nối từ với nghĩa",
        blocks: [
          {
            kind: "table",
            header: ["Từ", "Nghĩa (điền)"],
            rows: list.slice(0, 10).map((w) => [w, "........................"]),
          },
        ],
      },
      {
        title: "3. Sắp xếp lại chữ cái",
        blocks: [
          {
            kind: "list",
            items: list
              .slice(0, 8)
              .map((w, i) => `${i + 1}. ${scramble(w)} -> ________`),
          },
        ],
      },
      {
        title: "4. Đặt câu với từ cho trước",
        blocks: [
          {
            kind: "list",
            items: list
              .slice(0, 5)
              .map((w, i) => `${i + 1}. ${w}: ........................................`),
          },
        ],
      },
      {
        title: "5. Thẻ ghi nhớ (cắt rời, học 2 mặt)",
        blocks: [
          {
            kind: "table",
            header: ["Mặt trước (từ)", "Mặt sau (nghĩa + ví dụ)"],
            rows: list.map((w) => [w, "........................"]),
          },
        ],
      },
    ],
    appendix: [
      {
        title: "ĐÁP ÁN",
        blocks: [
          { kind: "list", items: [`Bài 3: ${list.slice(0, 8).join(", ")}`] },
        ],
      },
    ],
  };
}

// ---------- A-03: Hội thoại + nghe ----------
export function fbDialogue(input: Input, ctx: ToolContext): DocContent {
  const topic = input.topic || "Making friends";
  const level = input.cefr || "A2";
  const dialogue = [
    "Lan: Hi! My name is Lan. What is your name?",
    "Tom: Hi Lan. I am Tom. Nice to meet you.",
    "Lan: Nice to meet you too. Where are you from, Tom?",
    "Tom: I am from England. And you?",
    "Lan: I am from Viet Nam. Do you like our school?",
    "Tom: Yes, I do. The teachers are friendly and the food is great.",
  ];
  return {
    title: `DIALOGUE + LISTENING - ${topic.toUpperCase()}`,
    meta: [
      ["Cấp độ", level],
      ["Khối lớp", ctx.grade ? `Lớp ${ctx.grade}` : "-"],
      ["Nghe thử", "GV đọc mẫu cho lớp, hoặc phát bằng tính năng đọc văn bản của trình duyệt"],
    ],
    sections: [
      { title: "I. DIALOGUE", blocks: [{ kind: "list", items: dialogue }] },
      {
        title: "II. TRANSCRIPT (cho giáo viên)",
        blocks: [{ kind: "para", text: dialogue.join(" ") }],
      },
      {
        title: "III. LISTENING TASKS",
        blocks: [
          {
            kind: "list",
            items: [
              "Task 1. Listen and answer: Where is Tom from? A. Viet Nam B. England C. America D. Australia",
              "Task 2. Listen and tick True/False: Tom thinks the food is great. ( )",
              "Task 3. Listen and repeat: đọc lại 2 câu cuối theo ngữ điệu mẫu.",
              "Task 4. Role-play: đóng vai hội thoại theo cặp, thay tên và quốc gia của em.",
            ],
          },
        ],
      },
    ],
    appendix: [
      {
        title: "ANSWER KEY",
        blocks: [{ kind: "list", items: ["1. B", "2. True"] }],
      },
    ],
  };
}

// ---------- DC-06: Bai trinh chieu (slide) ----------
// Moi section = 1 slide. Gioi han noi dung/slide de khong tran khung.
export function fbSlides(input: Input, ctx: ToolContext): DocContent {
  const topic = input.lesson || ctx.standards[0]?.lesson_ref || "Bài học";
  const n = Math.min(Math.max(Number(input.slides) || 8, 6), 16);
  const slide = (t: string, items: string[], note?: string): DocSection => ({
    title: t,
    blocks: [
      { kind: "list", items },
      ...(note ? [{ kind: "note", text: `Ghi chú GV: ${note}` } as DocBlock] : []),
    ],
  });
  const all: DocSection[] = [
    {
      title: topic,
      blocks: [
        { kind: "para", text: `Môn: ${subjectName(ctx)} - Lớp ${ctx.grade ?? "?"}` },
        { kind: "para", text: "Giáo viên: ................................................" },
        {
          kind: "note",
          text: "Ghi chú GV: [BẢN KHUNG - các mục [ ] cần GV điền câu hỏi/nội dung cụ thể của bài trước khi chiếu]",
        },
      ],
    },
    slide(
      "MỤC TIÊU BÀI HỌC",
      [
        `Kiến thức: ${stdDesc(ctx)}.`,
        "Năng lực: tự chủ và tự học, giao tiếp và hợp tác, giải quyết vấn đề.",
        "Phẩm chất: trách nhiệm, chăm chỉ, trung thực.",
      ],
      "giới thiệu nhanh mục tiêu, không đọc nguyên văn - hỏi HS kỳ vọng vào bài.",
    ),
    slide(
      "KHỞI ĐỘNG",
      [
        "[GV điền câu hỏi/trò chơi mở đầu cụ thể của bài]",
        "Học sinh nêu điều đã biết, điều muốn tìm hiểu.",
        "Giáo viên dẫn dắt vào bài mới.",
      ],
      "[dự kiến câu trả lời của HS] - 2-3 phút, gọi 2-3 em phát biểu.",
    ),
    slide(
      "KHÁM PHÁ - NỘI DUNG CHÍNH",
      [
        `Nội dung trọng tâm: ${stdDesc(ctx)}.`,
        "[GV điền câu hỏi/nhiệm vụ khám phá cụ thể]",
        "Học sinh thảo luận nhóm đôi - báo cáo kết quả.",
      ],
      "[dự kiến kết quả thảo luận + kiến thức cần chốt] - chia nhóm đôi, quan sát nhóm yếu.",
    ),
    slide(
      "LUYỆN TẬP",
      [
        "[GV điền bài tập 1 - mức nhận biết, viết đề đầy đủ]",
        "[GV điền bài tập 2 - mức thông hiểu]",
        "[GV điền bài tập 3 - mức vận dụng]",
      ],
      "[đáp án từng bài tập] - HS làm cá nhân rồi chấm chéo.",
    ),
    slide(
      "VẬN DỤNG - MỞ RỘNG",
      [
        "[GV điền tình huống thực tiễn cụ thể]",
        "Sản phẩm: trình bày/poster/sơ đồ tư duy (tùy môn).",
        "Đánh giá nhanh theo rubric 3 mức.",
      ],
      "[dự kiến hướng giải quyết của HS] - khuyến khích nhiều cách làm.",
    ),
    slide(
      "TỔNG KẾT - DẶN DÒ",
      [
        "Chốt kiến thức: 3 ý chính của bài.",
        "Bài về nhà: ................................................",
        "Chuẩn bị bài sau: ........................................",
      ],
      "tóm tắt 3 ý chính, gọi 1-2 HS nhắc lại trước khi dặn dò.",
    ),
  ];
  return {
    title: `BÀI TRÌNH CHIẾU - ${topic.toUpperCase()}`,
    meta: [
      ["Môn học", subjectName(ctx)],
      ["Khối lớp", ctx.grade ? `Lớp ${ctx.grade}` : "-"],
      ["Số slide", String(n)],
    ],
    sections: all.slice(0, n),
  };
}

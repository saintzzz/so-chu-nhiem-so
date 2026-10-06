// Validate cau hoi truoc khi luu/import - chan loi data tu goc.
// Loi da gap: MC thieu options, dap an lech label, control char (\f -> \x0c),
// TF4 format lon xon, essay khong co loi giai that.

const QTYPES = ["multiple_choice", "true_false_4", "short_answer", "essay"] as const;

// Control char (trừ \n, \t) - \x0c (\f) tung lam hong \frac khi seed
const CONTROL_CHARS = /[\x00-\x08\x0b-\x1f\x7f]/;

// Option A./B./C./D. hoac A) B) C) D) - o dau dong hoac sau khoang trang
const OPTION_RE = /(?:^|\n|\s)([A-D])[.)]\s/gm;

// Menh de a) b) c) d) trong cau dung/sai
const TF_STMT_RE = /(?:^|\n|\s|\()([abcd])[.)]\s/gm;

// Dap an TF chuan: a-Đúng, b-Sai, c-Đúng, d-Sai (chap nhan ca D/S/T/F/True/False)
const TF_ANS_RE = /a\s*[-)]\s*(Đúng|Sai|Đ|S|T|F|True|False)/i;

// Stem tham chieu tai lieu kem theo (doan doc, hinh, bang...) nhung khong nhung
// noi dung - loi da gap: cau "the passage"/"doan van sau" khong co doan doc.
const CTX_REF_RE =
  /(the\s+(passage|text|reading|dialogue|poem|advert|notice)|đoạn\s+(trích|văn|thơ|sau)\s*(sau|trên|:)|văn bản\s*(sau|trên)|bài đọc|theo (bảng|sơ đồ|đồ thị)|bảng sau|đồ thị sau|sơ đồ sau)/i;

// Stem tham chieu HINH rieng - CR-031: duoc mien neu da co media dinh kem.
const IMG_REF_RE = /(như hình|theo hình|hình (vẽ|bên|sau|dưới)|ở hình|trong hình|theo tranh|nhìn (hình|tranh))/i;

const FIGURE_KINDS = [
  "triangle", "rectangle", "circle", "segment", "angle", "clock",
] as const;

export interface ValidateInput {
  stem: string;
  context?: string | null;
  qtype: string;
  answer: Record<string, unknown>;
  solution?: string | null;
  media?: { kind: string; spec?: Record<string, unknown>; path?: string }[] | null;
}

// Cau can context ma khong co: stem tham chieu tai lieu + context rong
// + phan sau cho tham chieu khong chua noi dung nhung (doan quote dai
// hoac khoi van ban >= 250 ky tu thi coi nhu da nhung context).
export function referencesMissingContext(
  stem: string,
  context?: string | null,
): boolean {
  if (context?.trim()) return false;
  const m = stem.match(CTX_REF_RE);
  if (!m) return false;
  // Tai lieu da nhung san: co doan quote dai (>=120 ky tu) bat ky dau trong stem.
  if (/['"“‘][^'"”’]{120,}['"”’]/.test(stem)) return false;
  const after = stem.slice((m.index ?? 0) + m[0].length);
  if (after.length > 250) return false;
  return !/['"“‘][^'"”’]{40,}['"”’]/.test(after);
}

function countMatches(re: RegExp, s: string): number {
  const seen = new Set<string>();
  for (const m of s.matchAll(re)) seen.add(m[1]);
  return seen.size;
}

function correctStr(answer: Record<string, unknown>): string {
  const c = answer?.correct;
  if (typeof c === "string") return c;
  if (c != null) return JSON.stringify(c);
  return Object.entries(answer ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join("; ");
}

export function validateQuestion(input: ValidateInput): string[] {
  const errs: string[] = [];
  const stem = (input.stem ?? "").trim();

  if (stem.length < 8) errs.push("Đề câu hỏi quá ngắn.");
  if (CONTROL_CHARS.test(stem)) errs.push("Đề câu hỏi chứa ký tự điều khiển lỗi (thường do \\f, \\b bị escape) - viết lại công thức LaTeX.");
  if (CONTROL_CHARS.test(input.solution ?? "")) errs.push("Lời giải chứa ký tự điều khiển lỗi.");
  const ansText = correctStr(input.answer ?? {});
  if (CONTROL_CHARS.test(ansText)) errs.push("Đáp án chứa ký tự điều khiển lỗi.");

  if (!QTYPES.includes(input.qtype as (typeof QTYPES)[number])) {
    errs.push(`Dạng câu hỏi không hợp lệ: ${input.qtype}`);
    return errs;
  }

  if (input.qtype === "multiple_choice") {
    const nOpts = countMatches(OPTION_RE, stem);
    if (nOpts < 4) errs.push(`Trắc nghiệm cần đủ 4 phương án A./B./C./D. trong đề (hiện có ${nOpts}).`);
    if (!/^[A-D]$/.test(ansText.trim().toUpperCase()))
      errs.push(`Đáp án trắc nghiệm phải là một chữ A-D (hiện: "${ansText.slice(0, 30) || "trống"}").`);
  }

  if (input.qtype === "true_false_4") {
    const nStmts = countMatches(TF_STMT_RE, stem);
    if (nStmts < 4) errs.push(`Câu Đúng/Sai cần đủ 4 mệnh đề a) b) c) d) (hiện có ${nStmts}).`);
    if (!TF_ANS_RE.test(ansText) || !/d\s*[-)]/i.test(ansText))
      errs.push(`Đáp án Đúng/Sai phải đủ 4 ý dạng "a-Đúng, b-Sai, c-Sai, d-Đúng" (hiện: "${ansText.slice(0, 50) || "trống"}").`);
  }

  if (input.qtype === "short_answer" && !ansText.trim())
    errs.push("Câu trả lời ngắn phải có đáp án.");

  if (input.qtype === "essay" && (input.solution ?? "").trim().length < 20)
    errs.push("Câu tự luận phải có lời giải/hướng dẫn chấm thật (tối thiểu 20 ký tự), không để placeholder.");

  // CR-031: validate media dinh kem
  const media = input.media ?? [];
  for (const m of media) {
    if (m.kind === "figure") {
      const k = m.spec?.kind;
      if (!k || !FIGURE_KINDS.includes(k as (typeof FIGURE_KINDS)[number]))
        errs.push(`Hình vẽ tham số không hợp lệ: ${JSON.stringify(m.spec)}`);
    } else if (m.kind === "image") {
      if (!m.path || m.path.includes(".."))
        errs.push("Ảnh đính kèm thiếu đường dẫn storage hợp lệ.");
    } else {
      errs.push(`Loại media không hợp lệ: ${m.kind}`);
    }
  }
  if (media.length > 4) errs.push("Mỗi câu tối đa 4 hình/ảnh.");

  // Stem tham chieu hinh: can co media HOAC context mo ta hinh
  const hasMedia = media.length > 0;
  if (IMG_REF_RE.test(stem) && !hasMedia && !(input.context ?? "").trim())
    errs.push("Câu tham chiếu hình/tranh nhưng chưa đính kèm hình - thêm Hình vẽ (SVG) hoặc tải ảnh ở mục Hình ảnh.");

  if (referencesMissingContext(stem, input.context) && !hasMedia)
    errs.push("Câu tham chiếu đoạn đọc/bảng nhưng chưa có ngữ cảnh kèm theo - nhập vào ô Ngữ cảnh hoặc nhúng trực tiếp vào đề.");

  return errs;
}

"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CurriculumStandard, QReviewState, Question, Subject } from "@/types/tvc";
import { saveQuestion, deleteQuestion, importQuestions, getQuestionDetail, listQuestionsChunk, setQuestionReviewState, bulkSetQuestionReviewState } from "@/lib/tvc/actions";
import { LEVEL_LABEL, QTYPE_LABEL } from "@/lib/tvc/types";
import { MathText } from "@/components/tvc/math-text";
import { useTvcAiJob } from "@/hooks/use-tvc-ai-job";
import { Plus, Trash2, Download, Loader2, ScanLine } from "lucide-react";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

const LATEX_SNIPPETS: { label: string; tex: string }[] = [
  { label: "a/b", tex: "\\frac{a}{b}" },
  { label: "√x", tex: "\\sqrt{x}" },
  { label: "x²", tex: "x^{2}" },
  { label: "xᵢ", tex: "x_{i}" },
  { label: "∫", tex: "\\int_{a}^{b} f(x)\\,dx" },
  { label: "∑", tex: "\\sum_{i=1}^{n} x_i" },
  { label: "vec", tex: "\\vec{AB}" },
  { label: "π", tex: "\\pi" },
  { label: "±", tex: "\\pm" },
  { label: "≤", tex: "\\leq" },
  { label: "≥", tex: "\\geq" },
  { label: "≠", tex: "\\neq" },
  { label: "∞", tex: "\\infty" },
  { label: "∠", tex: "\\angle ABC" },
  { label: "⇒", tex: "\\Rightarrow" },
  { label: "Δ", tex: "\\triangle ABC" },
];

const inputCls =
  "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

/** answer luu dang JSON {correct: "..."} - doi ra text de render. */
function formatAnswer(a: Record<string, unknown> | null | undefined): string {
  if (!a) return "";
  const c = a.correct;
  if (typeof c === "string") return c;
  if (c != null) return JSON.stringify(c);
  return Object.entries(a).map(([k, v]) => `${k}: ${String(v)}`).join("; ");
}

const REVIEW_META: Record<QReviewState, { label: string; cls: string }> = {
  unreviewed: { label: "Chưa duyệt", cls: "border-muted-foreground/40 text-muted-foreground" },
  approved: { label: "Đã duyệt", cls: "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" },
  flagged: { label: "Đánh dấu lỗi", cls: "border-destructive/40 bg-destructive/15 text-destructive" },
};

interface AiRow {
  stem: string;
  qtype: string;
  level: string;
  points: number;
  answer: string;
  solution: string;
  topic: string;
  subject?: string;
  grade?: number | null;
  standard_code: string;
  standardId: string;
}

export function QuestionBank({
  initial,
  subjects,
  total,
}: {
  initial: Question[];
  subjects: Subject[];
  total?: number;
}) {
  const [questions, setQuestions] = useState(initial);
  const [loadingMore, setLoadingMore] = useState(initial.length < (total ?? 0));
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState({ subject: "", qtype: "", level: "", review: "", q: "" });
  const [standards, setStandards] = useState<CurriculumStandard[]>([]);
  const [form, setForm] = useState({
    stem: "",
    context: "",
    qtype: "multiple_choice",
    level: "biet",
    points: "1",
    answer: "",
    solution: "",
    subject: "",
    grade: "",
    standardIds: [] as string[],
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  // AI import từ ảnh/PDF
  const [aiRows, setAiRows] = useState<AiRow[] | null>(null);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiScope, setAiScope] = useState({ subject: "", grade: "" });
  const [aiStandards, setAiStandards] = useState<CurriculumStandard[]>([]);
  // Trang dau da co san tu server - tai dan cac chunk con lai o background
  // de filter/tim kiem van hoat dong tren toan bo ngan hang.
  useEffect(() => {
    const want = total ?? initial.length;
    if (initial.length >= want) return;
    let cancelled = false;
    (async () => {
      let offset = initial.length;
      const acc: Question[] = [];
      while (offset < want) {
        const r = await listQuestionsChunk(offset);
        if (cancelled) return;
        if ("error" in r || !r.rows?.length) break;
        acc.push(...(r.rows as unknown as Question[]));
        offset += r.rows.length;
        if (r.rows.length < 1000) break;
      }
      if (!cancelled && acc.length) {
        setQuestions((p) => {
          const seen = new Set(p.map((x) => x.id));
          return [...p, ...acc.filter((x) => !seen.has(x.id))];
        });
      }
      if (!cancelled) setLoadingMore(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  // dap an/loi giai lazy-load khi expand - list khong ship 2 cot nang nay
  const [details, setDetails] = useState<Record<string, { answer: Record<string, unknown>; solution: string | null; context: string | null }>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const toggleExpand = (q: Question) => {
    setExpandedId((p) => (p === q.id ? null : q.id));
    if (expandedId === q.id || details[q.id]) return;
    setLoadingDetail(q.id);
    getQuestionDetail(q.id).then((r) => {
      if (!("error" in r)) setDetails((p) => ({ ...p, [q.id]: { answer: r.answer, solution: r.solution, context: r.context ?? null } }));
      setLoadingDetail((p) => (p === q.id ? null : p));
    });
  };
  const stemRef = useRef<HTMLTextAreaElement>(null);
  const aiJob = useTvcAiJob();

  const insertLatex = (tex: string) => {
    const ta = stemRef.current;
    if (!ta) return setForm((f) => ({ ...f, stem: f.stem + `$${tex}$` }));
    const s = ta.selectionStart ?? form.stem.length;
    const e = ta.selectionEnd ?? s;
    const insert = `$${tex}$`;
    const next = form.stem.slice(0, s) + insert + form.stem.slice(e);
    setForm({ ...form, stem: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + insert.length, s + insert.length);
    });
  };

  // load standards cho form khi chọn môn+khối
  useEffect(() => {
    if (!form.subject || !form.grade) return;
    fetch(`/api/studio/context?kind=standards&subject=${form.subject}&grade=${form.grade}`)
      .then((r) => r.json())
      .then((d) => setStandards(d.data ?? []));
  }, [form.subject, form.grade]);


  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;
  const filtered = useMemo(
    () =>
      questions.filter(
        (q) =>
          (!filter.subject || q.subject_code === filter.subject) &&
          (!filter.qtype || q.qtype === filter.qtype) &&
          (!filter.level || q.level === filter.level) &&
          (!filter.review || (q.review_state ?? "unreviewed") === filter.review) &&
          (!filter.q || q.stem.toLowerCase().includes(filter.q.toLowerCase())),
      ),
    [questions, filter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // ve trang 1 khi doi bo loc
  const setFilterPaged = (f: typeof filter) => { setFilter(f); setPage(1); };

  // Bulk review (CR-027): chon nhieu cau -> duyet/flag hang loat
  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) =>
    setSelIds((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const bulkReview = (state: "approved" | "flagged" | "unreviewed") => {
    if (!selIds.size) return;
    start(async () => {
      const res = await bulkSetQuestionReviewState([...selIds], state);
      if ("error" in res) {
        setError(res.error ?? "Lỗi.");
        return;
      }
      setQuestions((p) => p.map((q) => (selIds.has(q.id) ? { ...q, review_state: state } : q)));
      setMsg(`Đã cập nhật ${res.count} câu hỏi.`);
      setSelIds(new Set());
    });
  };

  const submit = () => {
    setError("");
    if (!form.stem.trim()) return setError("Chưa nhập nội dung câu hỏi.");
    if (!form.standardIds.length) return setError("Câu hỏi phải gắn ít nhất 1 mã yêu cầu cần đạt.");
    const std = standards.find((s) => s.id === form.standardIds[0]);
    start(async () => {
      const r = await saveQuestion({
        stem: form.stem,
        context: form.context || undefined,
        qtype: form.qtype,
        level: form.level,
        points: Number(form.points) || 1,
        answer: form.answer ? { correct: form.answer } : {},
        solution: form.solution || undefined,
        standardIds: form.standardIds,
        subjectCode: form.subject || std?.subject_code,
        grade: form.grade ? Number(form.grade) : std?.grade,
      });
      if (r.error) return setError(r.error);
      window.location.reload();
    });
  };

  /** Map rows tu AI: tu doan mon/khoi + goi y ma YCCD, tai ds chuan theo scope. */
  const applyAiRows = async (rows: Omit<AiRow, "standardId">[]) => {
    // Da so phieu cho mon/khoi tu ket qua AI
    const vote = (key: "subject" | "grade") => {
      const cnt = new Map<string, number>();
      for (const r of rows) {
        const v = String(r[key] ?? "");
        if (v) cnt.set(v, (cnt.get(v) ?? 0) + 1);
      }
      return [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    };
    const subject = aiScope.subject || vote("subject");
    const grade = aiScope.grade || vote("grade");
    setAiScope({ subject, grade });

    const qs = new URLSearchParams({ kind: "standards" });
    if (subject) qs.set("subject", subject);
    if (grade) qs.set("grade", grade);
    const all = await fetch(`/api/studio/context?${qs}`).then((r) => r.json());
    const stds = (all.data ?? []) as CurriculumStandard[];
    setAiStandards(stds);
    const byCode = new Map(stds.map((s) => [s.code, s.id]));
    setAiRows(
      rows.map((r) => ({
        ...r,
        standardId: r.standard_code ? (byCode.get(r.standard_code) ?? "") : "",
      })),
    );
  };

  /** Doi mon/khoi -> tai lai ds chuan va map lai ma YCCD AI goi y theo scope moi. */
  const changeAiScope = (subject: string, grade: string) => {
    setAiScope({ subject, grade });
    void (async () => {
      const qs = new URLSearchParams({ kind: "standards" });
      if (subject) qs.set("subject", subject);
      if (grade) qs.set("grade", grade);
      const all = await fetch(`/api/studio/context?${qs}`).then((r) => r.json());
      const stds = (all.data ?? []) as CurriculumStandard[];
      setAiStandards(stds);
      const byCode = new Map(stds.map((s) => [s.code, s.id]));
      setAiRows((p) =>
        (p ?? []).map((r) => ({
          ...r,
          standardId: r.standard_code ? (byCode.get(r.standard_code) ?? "") : "",
        })),
      );
    })();
  };

  const onExtractFile = (file: File) => {
    setError("");
    setAiScanning(true);
    void (async () => {
      try {
        let payload: Record<string, string>;
        if (/\.docx$/i.test(file.name)) {
          // docx: trích text + công thức OMML -> LaTeX phía client, gửi text cho AI
          const { docxToText } = await import("@/lib/tvc/docx-text");
          const text = await docxToText(file);
          if (!text.trim()) return setError("File Word không có nội dung đọc được.");
          payload = { text };
        } else {
          const b64 = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result ?? "").split(",")[1] ?? "");
            r.onerror = rej;
            r.readAsDataURL(file);
          });
          payload = { data: b64, mime: file.type };
        }
        const res = await fetch("/api/studio/questions/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as {
          rows?: Omit<AiRow, "standardId">[];
          error?: string;
          pending?: boolean;
          jobId?: string;
          sessionUrl?: string;
        };
        if (json.pending && json.jobId) {
          aiJob.start(json.jobId, json.sessionUrl ?? "", {
            onDone: (result: unknown) => {
              void (async () => {
                const rows = Array.isArray(result)
                  ? result
                  : Object.values(result as Record<string, unknown>).find(Array.isArray);
                if (Array.isArray(rows) && rows.length) {
                  await applyAiRows(rows as Omit<AiRow, "standardId">[]);
                } else {
                  setError("AI không đọc được câu hỏi nào từ file.");
                }
                setAiScanning(false);
              })();
            },
            onFail: () => {
              setError("AI xử lý gặp lỗi - thử lại sau.");
              setAiScanning(false);
            },
          });
          return; // aiScanning giu nguyen, ket thuc khi job xong
        }
        if (!res.ok || !json.rows) {
          return setError(json.error ?? "AI không đọc được file.");
        }
        if (!json.rows.length) return setError("Không tìm thấy câu hỏi nào trong file.");
        await applyAiRows(json.rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi khi đọc file.");
      } finally {
        setAiScanning(false);
      }
    })();
  };

  const confirmAiImport = () => {
    if (!aiRows) return;
    const rows = aiRows.filter((r) => r.standardId);
    if (!rows.length) return setError("Chọn mã YCCĐ cho ít nhất 1 câu hỏi.");
    start(async () => {
      const r = await importQuestions(
        rows.map((q) => {
          const std = aiStandards.find((s) => s.id === q.standardId);
          return {
            stem: q.stem,
            qtype: q.qtype,
            level: q.level,
            points: q.points,
            answer: q.answer ? { correct: q.answer } : {},
            solution: q.solution || undefined,
            standardIds: [q.standardId],
            subjectCode: std?.subject_code ?? aiScope.subject ?? undefined,
            grade: std?.grade ?? (aiScope.grade ? Number(aiScope.grade) : undefined),
          };
        }),
      );
      if (r.error) return setError(r.error);
      const skipNote = r.skipped?.length ? ` Bỏ qua ${r.skipped.length} dòng lỗi: ${r.skipped.slice(0, 3).join(" | ")}` : "";
      setMsg(`Đã import ${r.count} câu hỏi từ file.${skipNote}`);
      setAiRows(null);
      window.location.reload();
    });
  };

  // Template .xlsx dung chung cot voi parser import + sheet huong dan LaTeX
  const downloadTemplate = () => {
    void (async () => {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([
        ["stem", "context", "qtype", "level", "points", "answer", "solution", "standard_code"],
        [
          "Tính $\\frac{1}{2}+\\frac{1}{3}$ = ?",
          "",
          "multiple_choice",
          "biet",
          "0.25",
          "B",
          "A. $\\frac{2}{5}$ B. $\\frac{5}{6}$ C. 1 D. $\\frac{3}{5}$",
          "TOAN6.1.1",
        ],
        [
          "Xét tính đúng sai: a) $\\sqrt{9}=3$ b) $2^3=6$ c) $(-3)+(-5)=-8$ d) $\\pi=3{,}14$",
          "",
          "true_false_4",
          "hieu",
          "1",
          "a)D b)S c)D d)S",
          "b) sai vì $2^3=8$; d) sai vì $\\pi\\approx 3{,}14159$",
          "TOAN6.1.1",
        ],
        [
          "Tính nhanh: $25 \\cdot 13 \\cdot 4$ = ?",
          "",
          "short_answer",
          "hieu",
          "0.5",
          "1300",
          "$25 \\cdot 4 \\cdot 13 = 100 \\cdot 13 = 1300$",
          "TOAN6.1.1",
        ],
        [
          "Tìm $x$ biết $x^2 - 5x + 6 = 0$.",
          "",
          "essay",
          "van_dung",
          "2",
          "$x=2$ hoặc $x=3$",
          "Phân tích $(x-2)(x-3)=0$",
          "TOAN6.1.1",
        ],
      ]);
      ws["!cols"] = [{ wch: 60 }, { wch: 40 }, { wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 16 }, { wch: 50 }, { wch: 16 }];
      const guide = XLSX.utils.aoa_to_sheet([
        ["HƯỚNG DẪN NHẬP CÔNG THỨC TOÁN (MATH TYPE)"],
        [],
        ["Công thức viết bằng LaTeX, đặt trong dấu $ ... $ ngay trong ô. Hệ thống tự render thành công thức đẹp."],
        [],
        ["Muốn viết", "Gõ trong ô", "Hiển thị"],
        ["Phân số", "$\\frac{a}{b}$", "a trên b"],
        ["Căn bậc hai", "$\\sqrt{x}$", "√x"],
        ["Căn bậc n", "$\\sqrt[n]{x}$", "căn n của x"],
        ["Lũy thừa", "$x^{2}$", "x²"],
        ["Chỉ số dưới", "$x_{i}$", "xᵢ"],
        ["Tích phân", "$\\int_{a}^{b} f(x)\\,dx$", "∫"],
        ["Tổng", "$\\sum_{i=1}^{n} x_i$", "Σ"],
        ["Giới hạn", "$\\lim_{x \\to 0} f(x)$", "lim"],
        ["Vector", "$\\vec{AB}$", "→AB"],
        ["Ký hiệu hay dùng", "$\\pi$ $\\pm$ $\\leq$ $\\geq$ $\\neq$ $\\infty$ $\\angle$ $\\Rightarrow$", "π ± ≤ ≥ ≠ ∞ ∠ ⇒"],
        ["Công thức dòng riêng", "$$ ... $$", "to, can giữa"],
        [],
        ["Dạng thức (cột qtype): multiple_choice = TN nhiều lựa chọn | true_false_4 = Đúng-Sai 4 ý | short_answer = Trả lời ngắn | essay = Tự luận"],
        ["Mức độ (cột level): biet | hieu | van_dung | van_dung_cao"],
        ["Cột context: đoạn đọc/đoạn thơ/ngữ cảnh kèm câu hỏi - bắt buộc khi đề tham chiếu 'the passage', 'đoạn văn sau', 'như hình'... Các câu cùng một đoạn đọc điền cùng nội dung context."],
        ["Cột standard_code: mã yêu cầu cần đạt, VD TOAN6.1.1 - môn học và khối lớp được tự xác định theo mã (TOAN6.1.1 = Toán lớp 6, VAN9.3.1 = Ngữ văn lớp 9). Xem danh sách mã khi chọn công cụ trên dashboard."],
      ]);
      guide["!cols"] = [{ wch: 24 }, { wch: 46 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "cau_hoi");
      XLSX.utils.book_append_sheet(wb, guide, "huong_dan");
      XLSX.writeFile(wb, "template_cauhoi.xlsx");
    })();
  };

  // CSV/XLSX: parse bang theo template, bao chi tiet dong loi
  const onImportTable = (file: File) => {
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        let rows: string[][] = [];
        if (isXlsx) {
          try {
            const XLSX = await import("xlsx");
            const wb = XLSX.read(reader.result, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][])
              .map((r) => r.map((c) => String(c ?? "").trim()))
              .filter((r) => r.some((c) => c));
          } catch {
            return setError(
              "Không đọc được file Excel - file có thể bị hỏng. Mở bằng Excel, Save As lại thành .xlsx rồi thử lại.",
            );
          }
        } else {
          const text = String(reader.result ?? "");
          rows = text
            .split(/\r?\n/)
            .filter((l) => l.trim())
            .map((line) =>
              line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) =>
                c.trim().replace(/^"|"$/g, ""),
              ),
            );
        }
        const skipped: number[] = [];
        const valid = rows
          .slice(1) // bỏ header
          .map((cols, i) => {
            const [stem, context, qtype, level, points, answer, solution, standard_code] = cols;
            if (!stem || !standard_code) {
              skipped.push(i + 2); // so dong thuc trong file (dong 1 = header)
              return null;
            }
            return { stem, context, qtype, level, points, answer, solution, standard_code };
          })
          .filter(Boolean) as {
          stem: string; context: string; qtype: string; level: string; points: string;
          answer: string; solution: string; standard_code: string;
        }[];
        if (!valid.length) {
          return setError(
            `Không có dòng hợp lệ - tất cả ${rows.length - 1} dòng đều thiếu stem hoặc standard_code. Nhấn "Tải template" để lấy file mẫu đúng cột.`,
          );
        }
        start(async () => {
          const res = await fetch("/api/studio/context?kind=standards");
          const { data: all } = (await res.json()) as { data: CurriculumStandard[] };
          const byCode = new Map(all.map((s) => [s.code, s]));
          const badCodes = new Set<string>();
          const toInsert = valid
            .map((p) => {
              const std = byCode.get(p.standard_code);
              if (!std) {
                badCodes.add(p.standard_code);
                return null;
              }
              return {
                stem: p.stem,
                context: p.context || undefined,
                qtype: ["multiple_choice", "true_false_4", "short_answer", "essay"].includes(p.qtype)
                  ? p.qtype
                  : "multiple_choice",
                level: ["biet", "hieu", "van_dung", "van_dung_cao"].includes(p.level) ? p.level : "biet",
                points: Number(p.points) || 1,
                answer: p.answer ? { correct: p.answer } : {},
                solution: p.solution || undefined,
                standardIds: [std.id],
                subjectCode: std.subject_code,
                grade: std.grade,
              };
            })
            .filter(Boolean) as Parameters<typeof importQuestions>[0];
          if (!toInsert.length) {
            return setError(
              `Không dòng nào khớp mã YCCĐ. Mã không tồn tại: ${[...badCodes].slice(0, 5).join(", ")}${badCodes.size > 5 ? "..." : ""}. Kiểm tra cột standard_code - mã đúng dạng VD TOAN6.1.1, VAN9.3.1.`,
            );
          }
          const r = await importQuestions(toInsert);
          if (r.error) return setError(r.error);
          const notes: string[] = [`Đã import ${r.count} câu hỏi.`];
          if (skipped.length)
            notes.push(`Bỏ qua ${skipped.length} dòng thiếu dữ liệu (dòng ${skipped.slice(0, 5).join(", ")}).`);
          if (r.skipped?.length)
            notes.push(`Từ chối ${r.skipped.length} dòng không hợp lệ: ${r.skipped.slice(0, 3).join(" | ")}`);
          if (badCodes.size)
            notes.push(`Mã YCCĐ không khớp: ${[...badCodes].slice(0, 5).join(", ")}.`);
          setMsg(notes.join(" "));
          window.location.reload();
        });
      })();
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  /** Dispatcher: user dung dinh dang nao thi xu ly theo dinh dang do. */
  const onImportFile = (file: File) => {
    setError("");
    setMsg("");
    const name = file.name.toLowerCase();
    if (/\.(csv|xlsx?|xls)$/.test(name)) return onImportTable(file);
    if (/\.docx$/.test(name) || /\.pdf$/.test(name) || file.type.startsWith("image/")) {
      return onExtractFile(file);
    }
    if (/\.doc$/.test(name)) {
      return setError(
        "File .doc (Word 97-2003) chưa hỗ trợ - trong Word: File > Save As > chọn .docx hoặc .pdf rồi upload lại.",
      );
    }
    setError(
      `Định dạng ".${name.split(".").pop()}" chưa hỗ trợ. Hỗ trợ: .csv, .xlsx (theo template), .docx, .pdf, ảnh PNG/JPG/WEBP (đọc bằng AI).`,
    );
  };

  return (
    <div>
      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="rounded-lg border bg-card px-3 py-2 text-sm"
          placeholder="Tìm theo nội dung..."
          value={filter.q}
          onChange={(e) => setFilterPaged({ ...filter, q: e.target.value })}
        />
        <select
          className="rounded-lg border bg-card px-3 py-2 text-sm"
          value={filter.subject}
          onChange={(e) => setFilterPaged({ ...filter, subject: e.target.value })}
        >
          <option value="">Tất cả môn</option>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
        <select
          className="rounded-lg border bg-card px-3 py-2 text-sm"
          value={filter.qtype}
          onChange={(e) => setFilterPaged({ ...filter, qtype: e.target.value })}
        >
          <option value="">Mọi dạng thức</option>
          {Object.entries(QTYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          className="rounded-lg border bg-card px-3 py-2 text-sm"
          value={filter.level}
          onChange={(e) => setFilterPaged({ ...filter, level: e.target.value })}
        >
          <option value="">Mọi mức độ</option>
          {Object.entries(LEVEL_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          className="rounded-lg border bg-card px-3 py-2 text-sm"
          value={filter.review}
          onChange={(e) => setFilterPaged({ ...filter, review: e.target.value })}
        >
          <option value="">Mọi trạng thái</option>
          {Object.entries(REVIEW_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Tải template (.xlsx)
          </button>
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-3 py-2 text-sm hover:bg-muted"
            title="Hỗ trợ: .csv, .xlsx (theo template), .docx, .pdf, ảnh PNG/JPG/WEBP"
          >
            {aiScanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="h-4 w-4" />
            )}
            Import đề/câu hỏi
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.docx,.pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={aiScanning}
              onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])}
            />
          </label>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Thêm câu hỏi
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Import hỗ trợ: .csv/.xlsx theo template - .docx/.pdf/ảnh đọc tự động bằng AI, công thức toán giữ dạng LaTeX.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {msg && <p className="mt-3 text-sm text-emerald-300">{msg}</p>}
      {aiJob.job && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            AI đang đọc file - có thể mất vài phút, vui lòng chờ...
          </p>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="mt-4 rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold">Câu hỏi mới</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label className="text-sm font-medium">Nội dung câu hỏi *</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {LATEX_SNIPPETS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => insertLatex(s.tex)}
                    className="rounded border bg-muted/50 px-2 py-0.5 text-xs hover:bg-muted"
                    title={s.tex}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <AutoGrowTextarea
                ref={stemRef}
                className={inputCls}
                rows={3}
                value={form.stem}
                onChange={(e) => setForm({ ...form, stem: e.target.value })}
                placeholder="Công thức toán viết theo LaTeX: $\frac{a}{b}$, $x^2$, $\sqrt{x}$..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Công thức: đặt trong $...$ (inline) hoặc $$...$$ (display). VD: Tính $\frac&#123;1&#125;&#123;2&#125; + \frac&#123;1&#125;&#123;3&#125;$
              </p>
              {form.stem.includes("$") && (
                <div className="mt-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span className="mb-1 block text-xs text-muted-foreground">Xem trước:</span>
                  <MathText text={form.stem} />
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Môn học *</label>
              <select
                className={inputCls}
                value={form.subject}
                onChange={(e) => {
                  setStandards([]);
                  setForm({ ...form, subject: e.target.value, standardIds: [] });
                }}
              >
                <option value="">- Chọn -</option>
                {subjects.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Khối lớp *</label>
              <select
                className={inputCls}
                value={form.grade}
                onChange={(e) => {
                  setStandards([]);
                  setForm({ ...form, grade: e.target.value, standardIds: [] });
                }}
              >
                <option value="">- Chọn -</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>Lớp {g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Yêu cầu cần đạt * (chọn nhiều)</label>
              <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
                {standards.map((s) => (
                  <label key={s.id} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.standardIds.includes(s.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          standardIds: e.target.checked
                            ? [...form.standardIds, s.id]
                            : form.standardIds.filter((id) => id !== s.id),
                        })
                      }
                    />
                    <span>
                      <strong>{s.code}</strong> - {s.description.slice(0, 80)}
                    </span>
                  </label>
                ))}
                {!standards.length && (
                  <p className="text-xs text-muted-foreground">Chọn môn + khối trước.</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Dạng thức</label>
              <select
                className={inputCls}
                value={form.qtype}
                onChange={(e) => setForm({ ...form, qtype: e.target.value })}
              >
                {Object.entries(QTYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Mức độ</label>
              <select
                className={inputCls}
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              >
                {Object.entries(LEVEL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Điểm</label>
              <input
                type="number"
                step="0.25"
                className={inputCls}
                value={form.points}
                onChange={(e) => setForm({ ...form, points: e.target.value })}
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-sm font-medium">Ngữ cảnh kèm câu hỏi (đoạn đọc / đoạn thơ / mô tả hình)</label>
              <AutoGrowTextarea
                className={inputCls}
                rows={3}
                value={form.context}
                onChange={(e) => setForm({ ...form, context: e.target.value })}
                placeholder="Bắt buộc khi đề tham chiếu 'the passage', 'đoạn văn sau', 'như hình'... VD: đoạn văn đọc hiểu mà các câu hỏi bên dưới bám vào."
              />
            </div>
            {form.qtype !== "essay" && (
              <div className="md:col-span-3">
                <label className="text-sm font-medium">Đáp án *</label>
                <input
                  className={inputCls}
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  placeholder={
                    form.qtype === "multiple_choice"
                      ? "VD: B"
                      : form.qtype === "true_false_4"
                        ? "VD: a-Đúng, b-Sai, c-Sai, d-Đúng"
                        : "Đáp án ngắn gọn (VD: 42, Hà Nội)"
                  }
                />
              </div>
            )}
            <div className="md:col-span-3">
              <label className="text-sm font-medium">Lời giải / Hướng dẫn chấm</label>
              <AutoGrowTextarea
                className={inputCls}
                rows={2}
                value={form.solution}
                onChange={(e) => setForm({ ...form, solution: e.target.value })}
                placeholder="VD: Đáp án B. Giải thích: $x = \\frac{-b}{2a}$ ..."
              />
              {form.solution.includes("$") && (
                <div className="mt-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span className="mb-1 block text-xs text-muted-foreground">Xem trước:</span>
                  <MathText text={form.solution} />
                </div>
              )}
            </div>
          </div>
          <button
            onClick={submit}
            disabled={pending}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu câu hỏi
          </button>
        </div>
      )}

      {/* AI extract preview */}
      {aiRows && (
        <div className="mt-4 rounded-xl border border-primary/40 bg-card p-5 shadow-sm">
          <h3 className="font-semibold">AI đọc được {aiRows.length} câu hỏi - kiểm tra trước khi import</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <select
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              value={aiScope.subject}
              onChange={(e) => changeAiScope(e.target.value, "")}
            >
              <option value="">- Môn áp dụng -</option>
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
            <select
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              value={aiScope.grade}
              onChange={(e) => changeAiScope(aiScope.subject, e.target.value)}
            >
              <option value="">- Khối -</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>Lớp {g}</option>
              ))}
            </select>
          </div>
          {(() => {
            const suggested = aiRows.filter((r) => r.standardId).length;
            const hints: string[] = [];
            if (aiScope.subject)
              hints.push(`AI nhận diện: ${subjects.find((s) => s.code === aiScope.subject)?.name ?? aiScope.subject}${aiScope.grade ? ` lớp ${aiScope.grade}` : ""} - kiểm tra lại trước khi import`);
            if (suggested < aiRows.length)
              hints.push(`${aiRows.length - suggested} câu chưa gợi ý được mã YCCĐ - chọn thủ công`);
            return hints.length ? (
              <p className="mt-1.5 text-xs text-muted-foreground">{hints.join(". ")}</p>
            ) : null;
          })()}
          <div className="mt-3 max-h-96 space-y-3 overflow-y-auto">
            {aiRows.map((r, i) => (
              <div key={i} className="rounded-lg border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 text-sm">
                    {r.topic && (
                      <span className="mb-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {r.topic}
                      </span>
                    )}
                    {r.standard_code && (
                      <span className="mb-1 ml-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        AI gợi ý: {r.standard_code}
                      </span>
                    )}
                    <MathText text={r.stem} className="line-clamp-3" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {QTYPE_LABEL[r.qtype] ?? r.qtype} - {LEVEL_LABEL[r.level] ?? r.level} - {r.points}đ
                    </p>
                    {r.answer && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        ĐA: <MathText text={r.answer} />
                      </div>
                    )}
                  </div>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setAiRows((p) => (p ?? []).filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <select
                  className="mt-2 w-full rounded-lg border bg-card px-2 py-1.5 text-xs"
                  value={r.standardId}
                  onChange={(e) =>
                    setAiRows((p) =>
                      (p ?? []).map((x, j) =>
                        j === i ? { ...x, standardId: e.target.value } : x,
                      ),
                    )
                  }
                >
                  <option value="">- Gắn mã YCCĐ -</option>
                  {aiStandards.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.description.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={confirmAiImport}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {aiRows.filter((r) => r.standardId).length} câu đã gắn mã
            </button>
            <button
              onClick={() => setAiRows(null)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Bulk bar */}
      {selIds.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">Đã chọn {selIds.size} câu</span>
          <button
            className="rounded-lg border border-emerald-400/40 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-400/15"
            disabled={pending}
            onClick={() => bulkReview("approved")}
          >
            Đánh dấu đã duyệt
          </button>
          <button
            className="rounded-lg border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/15"
            disabled={pending}
            onClick={() => bulkReview("flagged")}
          >
            Đánh dấu lỗi
          </button>
          <button
            className="rounded-lg border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            disabled={pending}
            onClick={() => bulkReview("unreviewed")}
          >
            Về chưa duyệt
          </button>
          <button
            className="ml-auto rounded-lg border px-2.5 py-1 text-xs hover:bg-muted"
            onClick={() => setSelIds(new Set())}
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* List */}
      <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-3">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả trang"
                  checked={pageRows.length > 0 && pageRows.every((q) => selIds.has(q.id))}
                  onChange={(e) =>
                    setSelIds((p) => {
                      const n = new Set(p);
                      for (const q of pageRows) {
                        if (e.target.checked) n.add(q.id);
                        else n.delete(q.id);
                      }
                      return n;
                    })
                  }
                />
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Mã</th>
              <th className="px-4 py-3 font-medium">Câu hỏi</th>
              <th className="px-4 py-3 font-medium">Dạng</th>
              <th className="px-4 py-3 font-medium">Mức</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Điểm</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Nguồn</th>
              <th className="px-4 py-3 font-medium">Duyệt</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {pageRows.map((q) => (
              <Fragment key={q.id}>
              <tr className="hover:bg-muted/40">
                <td className="px-2 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Chọn câu ${q.code ?? q.id}`}
                    checked={selIds.has(q.id)}
                    onChange={() => toggleSel(q.id)}
                  />
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                  {q.code ?? "-"}
                </td>
                <td
                  className="max-w-md cursor-pointer px-4 py-3"
                  title="Bấm để xem đáp án / lời giải"
                  onClick={() => toggleExpand(q)}
                >
                  <MathText
                    text={q.stem}
                    className={expandedId === q.id ? "" : "line-clamp-2"}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {QTYPE_LABEL[q.qtype] ?? q.qtype}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {LEVEL_LABEL[q.level] ?? q.level}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {q.points}
                </td>
                <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                  {q.source === "imported" ? "Import" : q.source === "generated" ? "Sinh tự động" : "Tự soạn"}
                </td>
                <td className="px-4 py-3">
                  <button
                    className={`inline-flex cursor-pointer items-center rounded-full border px-2 py-0.5 text-xs ${REVIEW_META[(q.review_state ?? "unreviewed") as QReviewState].cls}`}
                    title="Bấm để đổi trạng thái duyệt (đã duyệt / đánh dấu lỗi)"
                    onClick={() => toggleExpand(q)}
                  >
                    {REVIEW_META[(q.review_state ?? "unreviewed") as QReviewState].label}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await deleteQuestion(q.id);
                        setQuestions((p) => p.filter((x) => x.id !== q.id));
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
              {expandedId === q.id && (
                <tr className="bg-muted/20">
                  <td colSpan={9} className="px-4 py-3 text-sm">
                    <div className="mb-2 flex items-center gap-2">
                      {(q.review_state ?? "unreviewed") !== "approved" && (
                        <button
                          className="rounded-lg border border-emerald-400/40 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-400/15"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const r = await setQuestionReviewState(q.id, "approved");
                              if (!("error" in r)) setQuestions((p) => p.map((x) => x.id === q.id ? { ...x, review_state: "approved" } : x));
                            })
                          }
                        >
                          Đánh dấu đã duyệt
                        </button>
                      )}
                      {(q.review_state ?? "unreviewed") !== "flagged" && (
                        <button
                          className="rounded-lg border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/15"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const r = await setQuestionReviewState(q.id, "flagged");
                              if (!("error" in r)) setQuestions((p) => p.map((x) => x.id === q.id ? { ...x, review_state: "flagged" } : x));
                            })
                          }
                        >
                          Đánh dấu lỗi (chặn khỏi đề)
                        </button>
                      )}
                      {(q.review_state ?? "unreviewed") !== "unreviewed" && (
                        <button
                          className="rounded-lg border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const r = await setQuestionReviewState(q.id, "unreviewed");
                              if (!("error" in r)) setQuestions((p) => p.map((x) => x.id === q.id ? { ...x, review_state: "unreviewed" } : x));
                            })
                          }
                        >
                          Về chưa duyệt
                        </button>
                      )}
                    </div>
                    {loadingDetail === q.id && !details[q.id] && (
                      <p className="text-muted-foreground">Đang tải...</p>
                    )}
                    {details[q.id] && (
                      <>
                        {details[q.id].context && (
                          <div className="mb-2 rounded-lg border border-info/30 bg-info-bg p-2">
                            <span className="font-medium text-muted-foreground">Ngữ cảnh: </span>
                            <MathText text={details[q.id].context!} className="whitespace-pre-line" />
                          </div>
                        )}
                        {formatAnswer(details[q.id].answer) && (
                          <p className="mb-1">
                            <span className="font-medium text-muted-foreground">Đáp án: </span>
                            <MathText text={formatAnswer(details[q.id].answer)} />
                          </p>
                        )}
                        {details[q.id].solution && (
                          <p>
                            <span className="font-medium text-muted-foreground">Lời giải: </span>
                            <MathText text={details[q.id].solution!} />
                          </p>
                        )}
                        {!formatAnswer(details[q.id].answer) && !details[q.id].solution && (
                          <p className="text-muted-foreground">Chưa có đáp án / lời giải.</p>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  Chưa có câu hỏi nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {filtered.length}/{questions.length} câu hỏi - dùng cho công cụ DC-03 (sinh đề theo ma trận)
          {loadingMore && " - đang tải đủ ngân hàng..."}
        </span>
        {pageCount > 1 && (
          <span className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border px-2 py-0.5 disabled:opacity-40"
            >
              Trước
            </button>
            Trang {page}/{pageCount}
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded border px-2 py-0.5 disabled:opacity-40"
            >
              Sau
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

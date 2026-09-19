"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { semesterAverage } from "@/lib/tt22";
import { downloadXlsxTemplate, parseSpreadsheet } from "@/lib/excel";
import { cn } from "@/lib/utils";

export interface GradeStudent {
  id: string;
  code: string;
  national_id: string | null;
  full_name: string;
  dob: string | null;
}

export interface ExistingGrade {
  id: string;
  student_id: string;
  assessment_type: "ddg_tx" | "ddg_gk" | "ddg_ck";
  score: number | null;
  result: "dat" | "chua_dat" | null;
  comment: string | null;
  level: "T" | "H" | "C" | null;
}

type Level = "" | "T" | "H" | "C";

interface CellState {
  tx: string;
  gk: string;
  ck: string;
  result: "" | "dat" | "chua_dat";
  commentCk: string;
  // Tiểu học: mức T/H/C theo đợt + điểm KTĐK + nhận xét
  levelGk: Level;
  commentGk: string;
  levelCk: Level;
  ktdk: string;
}

const EMPTY_CELL: CellState = {
  tx: "",
  gk: "",
  ck: "",
  result: "",
  commentCk: "",
  levelGk: "",
  commentGk: "",
  levelCk: "",
  ktdk: "",
};

const LEVEL_LABEL: Record<Level, string> = {
  "": "-",
  T: "T",
  H: "H",
  C: "C",
};

function parseScores(raw: string): number[] | null {
  const parts = raw
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return [];
  const nums: number[] = [];
  for (const p of parts) {
    const n = Number(p.replace(",", "."));
    if (Number.isNaN(n) || n < 0 || n > 10) return null;
    nums.push(n);
  }
  return nums;
}

function parseScore(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  if (Number.isNaN(n) || n < 0 || n > 10) return undefined;
  return n;
}

function cellAvg(c: CellState): number | null {
  const tx = parseScores(c.tx);
  const gk = c.gk.trim() === "" ? null : Number(c.gk.replace(",", "."));
  const ck = c.ck.trim() === "" ? null : Number(c.ck.replace(",", "."));
  if (tx === null) return null;
  if (gk != null && (Number.isNaN(gk) || gk < 0 || gk > 10)) return null;
  if (ck != null && (Number.isNaN(ck) || ck < 0 || ck > 10)) return null;
  const rows = [
    ...tx.map((score) => ({ assessment_type: "ddg_tx", score })),
    ...(gk != null ? [{ assessment_type: "ddg_gk", score: gk }] : []),
    ...(ck != null ? [{ assessment_type: "ddg_ck", score: ck }] : []),
  ];
  return semesterAverage(rows);
}

function cellInvalid(c: CellState, isTh: boolean): boolean {
  if (isTh) {
    return parseScore(c.ktdk) === undefined;
  }
  if (parseScores(c.tx) === null) return true;
  for (const v of [c.gk, c.ck]) {
    if (parseScore(v) === undefined) return true;
  }
  return false;
}

function isEmpty(c: CellState): boolean {
  return (
    !c.tx.trim() &&
    !c.gk.trim() &&
    !c.ck.trim() &&
    !c.result &&
    !c.commentCk.trim() &&
    !c.levelGk &&
    !c.commentGk.trim() &&
    !c.levelCk &&
    !c.ktdk.trim()
  );
}

function normalizeKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[\s.]+/g, "_");
}

/** Map cột theo tên header — hỗ trợ mẫu CSDL ngành (STT/Lớp/Mã định danh/ĐĐGtx1-5/ĐĐGgk/ĐĐGck/Nhận xét)
 *  lẫn template nội bộ cũ (Mã HS/Họ tên/ĐĐGtx/ĐĐGgk/ĐĐGck). */
function mapHeaderCells(header: string[]) {
  const cols: {
    key: number | null;
    name: number | null;
    dob: number | null;
    tx: number[];
    gk: number | null;
    ck: number | null;
    result: number | null;
    comment: number | null;
    ktdk: number | null;
    levelGk: number | null;
    levelCk: number | null;
  } = {
    key: null,
    name: null,
    dob: null,
    tx: [],
    gk: null,
    ck: null,
    result: null,
    comment: null,
    ktdk: null,
    levelGk: null,
    levelCk: null,
  };
  header.forEach((h, i) => {
    const k = normalizeKey(h);
    if (!k) return;
    if (
      cols.key === null &&
      (k.includes("ma_dinh_danh") ||
        k === "ma_hs" ||
        k === "mahs" ||
        k === "mssv" ||
        k === "ma_hoc_sinh" ||
        k === "ma_so" ||
        k === "code")
    ) {
      cols.key = i;
    } else if (
      cols.name === null &&
      (k.includes("ho_va_ten") || k === "ho_ten" || k === "hoten" || k === "name")
    ) {
      cols.name = i;
    } else if (cols.dob === null && (k.includes("ngay_sinh") || k === "dob")) {
      cols.dob = i;
    } else if (/^ddg_?tx/.test(k) || k.startsWith("ddg_thuong_xuyen") || /^tx\d?$/.test(k)) {
      cols.tx.push(i);
    } else if (cols.gk === null && (k.startsWith("ddg_?gk") || k === "ddggk" || k.includes("giua_ky"))) {
      cols.gk = i;
    } else if (cols.ck === null && (k.startsWith("ddg_?ck") || k === "ddgck" || k === "ddg_cuoi_ky")) {
      cols.ck = i;
    } else if (cols.ktdk === null && k.includes("ktdk")) {
      cols.ktdk = i;
    } else if (
      cols.levelGk === null &&
      (k.includes("muc_dat_duoc_gk") || k === "muc_gk" || k.includes("giua_ki"))
    ) {
      cols.levelGk = i;
    } else if (
      cols.levelCk === null &&
      (k.includes("muc_dat_duoc_ck") || k === "muc_ck" || k.includes("cuoi_ki"))
    ) {
      cols.levelCk = i;
    } else if (
      cols.comment === null &&
      (k === "nhan_xet" || k === "noi_dung_nhan_xet" || k === "comment" || k === "nhan_xet_ck")
    ) {
      cols.comment = i;
    } else if (
      cols.comment === null &&
      k === "ma_nhan_xet"
    ) {
      // mã nhận xét - ưu tiên cột nội dung, dùng mã làm fallback
      cols.comment = i;
    } else if (
      cols.result === null &&
      (k === "danh_gia" || k === "ket_qua" || k === "xep_loai" ||
        k === "muc_dat_duoc" || k === "muc_danh_gia" || k === "ket_qua_ren_luyen")
    ) {
      cols.result = i;
    }
  });
  return cols;
}

function parseLevel(raw: string): Level | "invalid" {
  const t = normalizeKey(raw).replace(/_/g, "");
  if (!t) return "";
  if (t === "t" || t === "tot" || t === "hoanthanhtot" || t === "htt") return "T";
  if (t === "h" || t === "dat" || t === "hoanthanh" || t === "ht") return "H";
  if (t === "c" || t === "chuadat" || t === "chuahoanthanh" || t === "cht") return "C";
  return "invalid";
}

/** Sổ điểm - THCS/THPT theo TT22 (ĐĐGtx/gk/ck + ĐTBm), Tiểu học theo mức T/H/C + Điểm KTĐK.
 *  Template & import theo mẫu biểu CSDL ngành: Mã định danh Bộ GD&ĐT, ngày sinh, ĐĐGtx1-5, nhận xét. */
export function GradesEditor({
  students,
  grades,
  subjectId,
  term,
  method,
  meId,
  className,
  schoolLevel,
}: {
  students: GradeStudent[];
  grades: ExistingGrade[];
  subjectId: string;
  term: string;
  method: "score" | "comment";
  meId: string;
  className: string;
  schoolLevel: "th" | "thcs" | "thpt" | "lien_cap";
}) {
  const router = useRouter();
  const isTh = schoolLevel === "th";
  const [cells, setCells] = useState<Record<string, CellState>>(() => {
    const init: Record<string, CellState> = {};
    for (const s of students) {
      const rows = grades.filter((g) => g.student_id === s.id);
      const gkRow = rows.find((g) => g.assessment_type === "ddg_gk");
      const ckRow = rows.find((g) => g.assessment_type === "ddg_ck");
      init[s.id] = {
        ...EMPTY_CELL,
        tx: rows
          .filter((g) => g.assessment_type === "ddg_tx")
          .map((g) => g.score)
          .join(" "),
        gk: gkRow?.score?.toString() ?? "",
        ck: ckRow?.score?.toString() ?? "",
        ktdk: ckRow?.score?.toString() ?? "",
        result: (rows.find((g) => g.result)?.result as CellState["result"]) ?? "",
        commentCk: ckRow?.comment ?? "",
        levelGk: gkRow?.level ?? "",
        commentGk: gkRow?.comment ?? "",
        levelCk: ckRow?.level ?? "",
      };
    }
    return init;
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const byCode = new Map(students.map((s) => [s.code.toLowerCase(), s.id]));
  const byNationalId = new Map(
    students.filter((s) => s.national_id).map((s) => [s.national_id!.trim().toLowerCase(), s.id]),
  );
  const byNameDob = new Map(
    students.map((s) => [
      `${normalizeKey(s.full_name)}|${s.dob ?? ""}`,
      s.id,
    ]),
  );

  function matchStudent(r: string[], keyCol: number, nameCol: number | null, dobCol: number | null) {
    const key = (r[keyCol] ?? "").trim().toLowerCase();
    if (key) {
      const byNid = byNationalId.get(key);
      if (byNid) return byNid;
      const byC = byCode.get(key);
      if (byC) return byC;
    }
    if (nameCol !== null) {
      const nk = `${normalizeKey(r[nameCol] ?? "")}|${(dobCol !== null ? r[dobCol] : "") ?? ""}`;
      const byNd = byNameDob.get(nk);
      if (byNd) return byNd;
    }
    return null;
  }

  function downloadTemplate() {
    if (isTh) {
      // Mẫu TH: STT | Lớp | Mã định danh | Họ tên | Ngày sinh | Mức GK | NX GK | Mức CK | Điểm KTĐK | NX CK
      void downloadXlsxTemplate(
        `mau-danh-gia-th-${className}.xlsx`,
        [
          "STT",
          "Lớp",
          "Mã định danh Bộ GD&ĐT",
          "Họ và tên",
          "Ngày sinh",
          "Mức đạt được GK",
          "Nhận xét GK",
          "Mức đạt được CK",
          "Điểm KTĐK",
          "Nhận xét CK",
        ],
        students.map((s, i) => [
          String(i + 1),
          className,
          s.national_id ?? s.code,
          s.full_name,
          s.dob ?? "",
          cells[s.id]?.levelGk ?? "",
          cells[s.id]?.commentGk ?? "",
          cells[s.id]?.levelCk ?? "",
          cells[s.id]?.ktdk ?? "",
          cells[s.id]?.commentCk ?? "",
        ]),
      );
      return;
    }
    if (method === "comment") {
      // Mẫu nhận xét môn học (môn đánh giá bằng nhận xét)
      void downloadXlsxTemplate(
        `mau-nhan-xet-mon-${className}.xlsx`,
        [
          "STT",
          "Mã định danh Bộ GD&ĐT",
          "Họ và tên",
          "Ngày sinh",
          "Đánh giá",
          "Nội dung nhận xét",
        ],
        students.map((s, i) => [
          String(i + 1),
          s.national_id ?? s.code,
          s.full_name,
          s.dob ?? "",
          cells[s.id]?.result === "chua_dat" ? "Chưa đạt" : cells[s.id]?.result ? "Đạt" : "",
          cells[s.id]?.commentCk ?? "",
        ]),
      );
      return;
    }
    // Mẫu 1 bảng điểm CSDL ngành: STT | Lớp | Mã định danh | Họ tên | Ngày sinh | ĐĐGtx1-5 | ĐĐGgk | ĐĐGck | Nhận xét
    void downloadXlsxTemplate(
      `mau-1-bang-diem-${className}.xlsx`,
      [
        "STT",
        "Lớp",
        "Mã định danh Bộ GD&ĐT",
        "Họ và tên",
        "Ngày sinh",
        "ĐĐGtx1",
        "ĐĐGtx2",
        "ĐĐGtx3",
        "ĐĐGtx4",
        "ĐĐGtx5",
        "ĐĐGgk",
        "ĐĐGck",
        "Nhận xét",
      ],
      students.map((s, i) => {
        const tx = (cells[s.id]?.tx ?? "").split(/[\s,;]+/).filter(Boolean);
        return [
          String(i + 1),
          className,
          s.national_id ?? s.code,
          s.full_name,
          s.dob ?? "",
          tx[0] ?? "",
          tx[1] ?? "",
          tx[2] ?? "",
          tx[3] ?? "",
          tx[4] ?? "",
          cells[s.id]?.gk ?? "",
          cells[s.id]?.ck ?? "",
          cells[s.id]?.commentCk ?? "",
        ];
      }),
    );
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    setImportMsg(null);
    setError(null);
    let table: string[][];
    try {
      table = await parseSpreadsheet(file);
    } catch {
      setImportMsg("Không đọc được file. Dùng file .xlsx hoặc .csv.");
      return;
    }
    // Tìm dòng header: dòng có chứa cột "mã"/"họ tên"/"đđg"
    const headerIdx = table.findIndex((r) =>
      r.some((c) => {
        const k = normalizeKey(c);
        return (
          k.includes("ma_dinh_danh") ||
          k === "ma_hs" ||
          k === "mahs" ||
          k.includes("ho_va_ten") ||
          k.startsWith("ddg")
        );
      }),
    );
    const header = headerIdx >= 0 ? table[headerIdx] : null;
    const cols = header
      ? mapHeaderCells(header)
      : { ...mapHeaderCells([]), key: 0, name: 1, tx: [2], gk: 3, ck: 4, comment: null, result: 2, dob: null, ktdk: null, levelGk: null, levelCk: null };
    const dataRows = table.slice(headerIdx >= 0 ? headerIdx + 1 : 0);
    let matched = 0;
    const missed: string[] = [];
    setCells((prev) => {
      const next = { ...prev };
      for (const r of dataRows) {
        if (r.every((c) => !c.trim())) continue;
        const id = matchStudent(r, cols.key ?? 0, cols.name, cols.dob);
        if (!id) {
          missed.push(r[cols.key ?? 0] ?? r[cols.name ?? 0] ?? "");
          continue;
        }
        matched += 1;
        const cur = next[id] ?? { ...EMPTY_CELL };
        if (isTh) {
          const lg = cols.levelGk !== null ? parseLevel(r[cols.levelGk] ?? "") : "";
          const lc = cols.levelCk !== null ? parseLevel(r[cols.levelCk] ?? "") : "";
          next[id] = {
            ...cur,
            levelGk: lg === "invalid" ? cur.levelGk : lg || cur.levelGk,
            levelCk: lc === "invalid" ? cur.levelCk : lc || cur.levelCk,
            ktdk: cols.ktdk !== null ? (r[cols.ktdk] ?? "").trim() : cur.ktdk,
            commentCk: cols.comment !== null ? (r[cols.comment] ?? "").trim() : cur.commentCk,
          };
        } else if (method === "comment") {
          const v = (cols.result !== null ? (r[cols.result] ?? "") : "").trim().toLowerCase();
          const result = v
            ? v.includes("chưa") || v === "chua_dat"
              ? "chua_dat"
              : "dat"
            : cur.result;
          next[id] = {
            ...cur,
            result: result as CellState["result"],
            commentCk: cols.comment !== null ? (r[cols.comment] ?? "").trim() : cur.commentCk,
          };
        } else {
          // gộp các cột ĐĐGtx1..n thành chuỗi; nếu 1 cột đơn thì giữ nguyên nội dung
          const txVal =
            cols.tx.length > 0
              ? cols.tx.map((i) => (r[i] ?? "").trim()).filter(Boolean).join(" ")
              : cur.tx;
          next[id] = {
            ...cur,
            tx: txVal,
            gk: cols.gk !== null ? (r[cols.gk] ?? "").trim() : cur.gk,
            ck: cols.ck !== null ? (r[cols.ck] ?? "").trim() : cur.ck,
            commentCk: cols.comment !== null ? (r[cols.comment] ?? "").trim() : cur.commentCk,
          };
        }
      }
      return next;
    });
    setSaved(false);
    setImportMsg(
      `Đã điền ${matched} học sinh từ file${missed.length ? ` - không khớp: ${missed.slice(0, 5).join(", ")}${missed.length > 5 ? "…" : ""}` : ""}. Kiểm tra rồi bấm Lưu điểm.`,
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  function setCell(id: string, patch: Partial<CellState>) {
    setSaved(false);
    setCells((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function save() {
    setSaved(false);
    setError(null);
    for (const s of students) {
      const c = cells[s.id];
      if (c && cellInvalid(c, isTh)) {
        setError(
          isTh
            ? `Điểm KTĐK không hợp lệ cho học sinh ${s.full_name} (0-10).`
            : `Điểm không hợp lệ cho học sinh ${s.full_name} (0-10).`,
        );
        return;
      }
    }

    startTransition(async () => {
      const supabase = createClient();
      const studentIds = students.map((s) => s.id);
      const { error: delErr } = await supabase
        .from("grades")
        .delete()
        .in("student_id", studentIds)
        .eq("subject_id", subjectId)
        .eq("term", term);
      if (delErr) {
        setError(delErr.message);
        return;
      }

      const rows: Record<string, unknown>[] = [];
      for (const s of students) {
        const c = cells[s.id];
        if (!c || isEmpty(c)) continue;
        const base = {
          student_id: s.id,
          subject_id: subjectId,
          term,
          entered_by: meId,
        };
        if (isTh) {
          // Tiểu học: đợt GK lưu mức + nhận xét; đợt CK lưu mức + điểm KTĐK + nhận xét
          if (c.levelGk || c.commentGk.trim()) {
            rows.push({
              ...base,
              assessment_type: "ddg_gk",
              seq: 1,
              level: c.levelGk || null,
              comment: c.commentGk.trim() || null,
            });
          }
          const ktdk = parseScore(c.ktdk);
          if (c.levelCk || ktdk != null || c.commentCk.trim()) {
            rows.push({
              ...base,
              assessment_type: "ddg_ck",
              seq: 1,
              level: c.levelCk || null,
              score: ktdk ?? null,
              comment: c.commentCk.trim() || null,
            });
          }
          continue;
        }
        if (method === "comment") {
          if (c.result || c.commentCk.trim()) {
            rows.push({
              ...base,
              assessment_type: "ddg_ck",
              result: c.result || null,
              comment: c.commentCk.trim() || null,
            });
          }
          continue;
        }
        const tx = parseScores(c.tx) ?? [];
        const gk = parseScore(c.gk);
        const ck = parseScore(c.ck);
        tx.forEach((score, i) => {
          rows.push({ ...base, assessment_type: "ddg_tx", score, seq: i + 1 });
        });
        if (gk != null) {
          rows.push({ ...base, assessment_type: "ddg_gk", score: gk, seq: 1 });
        }
        if (ck != null || c.commentCk.trim()) {
          rows.push({
            ...base,
            assessment_type: "ddg_ck",
            score: ck ?? null,
            comment: c.commentCk.trim() || null,
            seq: 1,
          });
        }
      }

      if (rows.length) {
        const { error: insErr } = await supabase.from("grades").insert(rows);
        if (insErr) {
          setError(insErr.message);
          return;
        }
      }
      setSaved(true);
      router.refresh();
    });
  }

  const inputCls = (bad: boolean) =>
    cn(
      "h-8 w-full min-w-16 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring",
      bad && "border-destructive",
    );
  const levelSelect = (value: Level, onChange: (v: Level) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Level)}
      className="h-8 rounded-lg border border-border bg-background px-1.5 text-sm outline-none focus:border-ring"
    >
      {(["", "T", "H", "C"] as Level[]).map((l) => (
        <option key={l} value={l}>
          {LEVEL_LABEL[l]}
        </option>
      ))}
    </select>
  );

  const columns = isTh
    ? [
        "STT",
        "Mã định danh",
        "Họ và tên",
        "Mức GK",
        "Nhận xét GK",
        "Mức CK",
        "Điểm KTĐK",
        "Nhận xét CK",
      ]
    : method === "score"
      ? [
          "STT",
          "Mã định danh",
          "Họ và tên",
          "ĐĐGtx",
          "ĐĐGgk",
          "ĐĐGck",
          "ĐTBm",
          "Nhận xét",
        ]
      : ["STT", "Mã định danh", "Họ và tên", "Đánh giá", "Nhận xét"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {students.length} học sinh
        </span>
        <span className="flex flex-wrap items-center gap-3">
          {saved && <span className="text-sm text-success">Đã lưu điểm.</span>}
          {error && <span className="text-sm text-error">{error}</span>}
          {importMsg && (
            <span className="text-sm text-primary">{importMsg}</span>
          )}
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            Tải template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            Import Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => void onImport(e.target.files?.[0])}
          />
          <Button onClick={save} disabled={pending} size="sm">
            {pending ? "Đang lưu…" : "Lưu điểm"}
          </Button>
        </span>
      </div>
      <DataTable
        columns={columns}
        footer={<span>{students.length} học sinh</span>}
      >
        {students.map((s, idx) => {
          const c = cells[s.id] ?? EMPTY_CELL;
          const invalid = cellInvalid(c, isTh);
          const avg = !isTh && method === "score" ? cellAvg(c) : null;
          return (
            <tr key={s.id}>
              <td className="text-muted-foreground">{idx + 1}</td>
              <td className="font-mono text-xs text-muted-foreground">
                {s.national_id ?? s.code}
              </td>
              <td className="font-medium">
                {s.full_name}
                {s.dob && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {new Date(`${s.dob}T00:00:00`).toLocaleDateString("vi-VN")}
                  </span>
                )}
              </td>
              {isTh ? (
                <>
                  <td>
                    {levelSelect(c.levelGk, (v) => setCell(s.id, { levelGk: v }))}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={c.commentGk}
                      onChange={(e) => setCell(s.id, { commentGk: e.target.value })}
                      className={cn(inputCls(false), "w-44")}
                    />
                  </td>
                  <td>
                    {levelSelect(c.levelCk, (v) => setCell(s.id, { levelCk: v }))}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={c.ktdk}
                      onChange={(e) => setCell(s.id, { ktdk: e.target.value })}
                      className={cn(inputCls(invalid), "w-20")}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={c.commentCk}
                      onChange={(e) => setCell(s.id, { commentCk: e.target.value })}
                      className={cn(inputCls(false), "w-44")}
                    />
                  </td>
                </>
              ) : method === "score" ? (
                <>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="8 9 7.5"
                      value={c.tx}
                      onChange={(e) => setCell(s.id, { tx: e.target.value })}
                      className={cn(inputCls(invalid && parseScores(c.tx) === null), "w-28")}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={c.gk}
                      onChange={(e) => setCell(s.id, { gk: e.target.value })}
                      className={cn(inputCls(false), "w-20")}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={c.ck}
                      onChange={(e) => setCell(s.id, { ck: e.target.value })}
                      className={cn(inputCls(false), "w-20")}
                    />
                  </td>
                  <td className="font-semibold">
                    {avg != null ? avg.toFixed(1) : "-"}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={c.commentCk}
                      onChange={(e) => setCell(s.id, { commentCk: e.target.value })}
                      className={cn(inputCls(false), "w-44")}
                    />
                  </td>
                </>
              ) : (
                <>
                  <td>
                    <select
                      value={c.result}
                      onChange={(e) =>
                        setCell(s.id, {
                          result: e.target.value as CellState["result"],
                        })
                      }
                      className="h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring"
                    >
                      <option value="">-</option>
                      <option value="dat">Đạt</option>
                      <option value="chua_dat">Chưa đạt</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={c.commentCk}
                      onChange={(e) => setCell(s.id, { commentCk: e.target.value })}
                      className={cn(inputCls(false), "w-52")}
                    />
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}

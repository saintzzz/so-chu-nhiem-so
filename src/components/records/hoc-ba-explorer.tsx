"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { sortByVietnameseName, fmtDateVN, formatDateTime } from "@/lib/utils";
import type { YearEndBundle, YearEndDecision } from "@/lib/hocba";
import type { YearRating, Promotion } from "@/lib/tt22";
import {
  saveYearEndDecision,
  approveYearEnd,
  rejectYearEnd,
  createNextStage,
  type DecisionInput,
} from "@/app/(app)/records/hoc-ba/actions";

const RATING_LABEL: Record<YearRating, string> = {
  tot: "Tốt",
  kha: "Khá",
  dat: "Đạt",
  chua_dat: "Chưa đạt",
};
const RATING_TONE: Record<YearRating, "success" | "primary" | "warning" | "error"> = {
  tot: "success",
  kha: "primary",
  dat: "warning",
  chua_dat: "error",
};
const STATUS_META: Record<YearEndDecision["status"], { label: string; tone: "muted" | "warning" | "success" | "error" | "primary" }> = {
  draft: { label: "Nháp", tone: "muted" },
  submitted: { label: "Chờ duyệt", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "success" },
  rejected: { label: "Bị trả lại", tone: "error" },
  locked: { label: "Đã khóa", tone: "primary" },
};
const PROMO_LABEL: Record<Promotion, string> = {
  len_lop: "Lên lớp",
  kiem_tra_danh_gia_lai: "Kiểm tra / đánh giá lại",
  ren_luyen_he: "Rèn luyện hè",
  o_lai: "Ở lại lớp",
};
const STAGE_LABEL: Record<string, string> = {
  after_retest: "Sau đánh giá lại",
  after_summer: "Sau rèn luyện hè",
};
const GROUND_LABEL: Record<string, string> = {
  tt22_9_3: "Điều chỉnh theo Thông tư 22 Điều 9.3",
  danh_gia_lai: "Sau đánh giá lại",
  hs_khuyet_tat: "Học sinh khuyết tật",
  mien_mon: "Miễn môn",
};
const MISSING_LABEL: Record<string, string> = {
  thieu_mon: "Chưa đủ môn theo Thông tư 22",
  thieu_diem: "Chưa đủ dữ liệu",
  thieu_hanh_kiem: "Chưa đủ dữ liệu hạnh kiểm",
};

function RatingBadge({ v, missing }: { v: YearRating | null; missing: string | null }) {
  if (missing) return <StatusBadge label={MISSING_LABEL[missing] ?? "Chưa đủ dữ liệu"} tone="muted" />;
  if (!v) return <StatusBadge label="Chưa đủ dữ liệu" tone="muted" />;
  return <StatusBadge label={RATING_LABEL[v]} tone={RATING_TONE[v]} />;
}

function PromoLabel({ v }: { v: Promotion | null }) {
  if (!v) return <StatusBadge label="Chưa đủ dữ liệu" tone="muted" />;
  return <StatusBadge label={PROMO_LABEL[v]} tone={v === "len_lop" ? "success" : v === "o_lai" ? "error" : "warning"} />;
}

// ---------- List ----------

export function HocBaClassList({
  schools,
  selectedSchoolId,
  classes,
  selectedClassId,
  bundles,
  canWrite,
  isBgh,
  yearId,
}: {
  schools: { id: string; name: string }[];
  selectedSchoolId: string | null;
  classes: { id: string; name: string }[];
  selectedClassId: string | null;
  bundles: YearEndBundle[];
  canWrite: boolean;
  isBgh: boolean;
  yearId: string | null;
}) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const rows = useMemo(
    () => sortByVietnameseName(bundles, (b) => b.student.full_name),
    [bundles],
  );
  const staleCount = bundles.filter((b) => {
    const latest = b.decisions[b.decisions.length - 1];
    if (!latest?.computed_snapshot) return false;
    const s = latest.computed_snapshot;
    return (
      s.kqht !== b.computed.kqht.value ||
      s.kqrl !== b.computed.kqrl.value ||
      s.danhHieu !== b.computed.danhHieu ||
      s.promotion !== b.computed.promotion.value ||
      s.absentTotal !== b.absentTotal
    );
  }).length;

  const pick = (key: string, val: string) => {
    const p = new URLSearchParams();
    if (key === "school") p.set("school", val);
    else {
      if (selectedSchoolId) p.set("school", selectedSchoolId);
      if (key === "class") p.set("class", val);
    }
    router.push(`/records/hoc-ba?${p.toString()}`);
  };

  async function exportClass(format: "docx" | "pdf") {
    if (!selectedClassId) return;
    setExporting(true);
    try {
      const res = await fetch(
        `/api/records/hoc-ba/export?format=${format}&class=${selectedClassId}`,
      );
      if (!res.ok) {
        alert(res.status === 403 ? "Bạn không có quyền xuất học bạ." : "Xuất file thất bại.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hoc-ba-lop.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {schools.length > 0 && (
          <select
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={selectedSchoolId ?? ""}
            onChange={(e) => pick("school", e.target.value)}
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        {classes.length <= 4 ? (
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <Link
                key={c.id}
                href={`/records/hoc-ba?${selectedSchoolId ? `school=${selectedSchoolId}&` : ""}class=${c.id}`}
                className={
                  c.id === selectedClassId
                    ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                    : "rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
                }
              >
                {c.name}
              </Link>
            ))}
          </div>
        ) : (
          <select
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={selectedClassId ?? ""}
            onChange={(e) => pick("class", e.target.value)}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>Lớp {c.name}</option>
            ))}
          </select>
        )}
        {isBgh && selectedClassId && (
          <button
            type="button"
            disabled={exporting}
            onClick={() => exportClass("docx")}
            className="ml-auto rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {exporting ? "Đang xuất..." : "Xuất học bạ cả lớp (DOCX)"}
          </button>
        )}
      </div>

      {staleCount > 0 && (
        <p className="rounded-xl border border-l-4 border-l-warning border-border bg-card p-3 text-sm text-warning">
          {staleCount} học sinh có dữ liệu nguồn thay đổi sau khi trình duyệt - cần rà soát lại.
        </p>
      )}

      {!selectedClassId ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {classes.length === 0
            ? "Chưa có trường/lớp nào trong phạm vi của bạn."
            : "Chọn một lớp để xem học bạ."}
        </p>
      ) : (
        <DataTable
          columns={[
            "Học sinh",
            "Kết quả học tập",
            "Kết quả rèn luyện",
            "Danh hiệu",
            "Lên lớp",
            "Trạng thái",
            "Thao tác",
          ]}
          footer={<span>{rows.length} học sinh{!yearId ? " - lớp chưa gắn năm học" : ""}</span>}
        >
          {rows.map((b) => {
            const dec = b.decisions[b.decisions.length - 1];
            return (
              <tr key={b.student.id}>
                <td className="font-medium">{b.student.full_name}</td>
                <td><RatingBadge v={dec?.kqht ?? b.computed.kqht.value} missing={dec ? null : b.computed.kqht.missing} /></td>
                <td><RatingBadge v={dec?.kqrl ?? b.computed.kqrl.value} missing={dec ? null : b.computed.kqrl.missing} /></td>
                <td className="text-sm">
                  {dec?.danh_hieu === "xuat_sac" ? "Học sinh Xuất sắc"
                    : dec?.danh_hieu === "gioi" ? "Học sinh Giỏi"
                    : b.computed.danhHieu === "xuat_sac" ? "Xuất sắc (gợi ý)"
                    : b.computed.danhHieu === "gioi" ? "Giỏi (gợi ý)"
                    : "-"}
                </td>
                <td><PromoLabel v={dec?.promotion ?? b.computed.promotion.value} /></td>
                <td>
                  <StatusBadge
                    label={dec ? STATUS_META[dec.status].label : "Chưa có"}
                    tone={dec ? STATUS_META[dec.status].tone : "muted"}
                  />
                  {dec && dec.revision > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">lần {dec.revision}</span>
                  )}
                </td>
                <td>
                  <Link
                    href={`/records/hoc-ba?${selectedSchoolId ? `school=${selectedSchoolId}&` : ""}class=${selectedClassId}&student=${b.student.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Xem
                  </Link>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-muted-foreground">
                {selectedClassId ? "Lớp chưa có học sinh." : ""}
              </td>
            </tr>
          )}
        </DataTable>
      )}
      {!canWrite && !isBgh && (
        <p className="text-xs text-muted-foreground">Bạn đang xem ở chế độ chỉ đọc.</p>
      )}
    </div>
  );
}

// ---------- Detail ----------

export function HocBaDetail({
  bundle,
  className,
  yearId,
  canWrite,
  canApprove,
  exportable,
  baseQuery,
}: {
  bundle: YearEndBundle | null;
  className: string;
  yearId: string | null;
  canWrite: boolean;
  canApprove: boolean;
  exportable: boolean;
  baseQuery: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [giayKhen, setGiayKhen] = useState("");

  const [form, setForm] = useState({
    kqht: null as YearRating | null,
    kqrl: null as YearRating | null,
    danhHieu: null as "xuat_sac" | "gioi" | null,
    promotion: null as Promotion | null,
    ground: null as string | null,
    note: "",
    touched: false,
  });

  if (!bundle) {
    return (
      <div className="space-y-4">
        <Link href={`/records/hoc-ba${baseQuery}`} className="text-sm text-primary hover:underline">
          Về danh sách lớp
        </Link>
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải được học bạ học sinh này.
        </p>
      </div>
    );
  }

  const dec = bundle.decisions[bundle.decisions.length - 1] ?? null;
  const locked = dec?.status === "locked";
  const editable = canWrite && (!dec || ["draft", "rejected"].includes(dec.status));
  const approvable = canApprove && dec?.status === "submitted";

  // r33: first touch must seed EVERY field from the current effective
  // values - initializing one chip while the rest start null would
  // silently clear the other ratings and submit nulls.
  const pickField = (patch: Partial<typeof form>) =>
    setForm(
      form.touched
        ? { ...form, ...patch }
        : {
            kqht: dec?.kqht ?? bundle.computed.kqht.value,
            kqrl: dec?.kqrl ?? bundle.computed.kqrl.value,
            danhHieu: dec?.danh_hieu ?? bundle.computed.danhHieu,
            promotion: dec?.promotion ?? bundle.computed.promotion.value,
            ground: dec?.override_legal_ground ?? null,
            note: dec?.override_note ?? "",
            touched: true,
            ...patch,
          },
    );

  const effKqht = form.touched ? form.kqht : (dec?.kqht ?? bundle.computed.kqht.value);
  const effKqrl = form.touched ? form.kqrl : (dec?.kqrl ?? bundle.computed.kqrl.value);
  const effPromo = form.touched ? form.promotion : (dec?.promotion ?? bundle.computed.promotion.value);
  const effDanhHieu = form.touched ? form.danhHieu : (dec?.danh_hieu ?? bundle.computed.danhHieu);

  const overridden =
    effKqht !== bundle.computed.kqht.value ||
    effKqrl !== bundle.computed.kqrl.value ||
    effPromo !== bundle.computed.promotion.value ||
    effDanhHieu !== bundle.computed.danhHieu;
  const needsGround = overridden;
  const formValid = !needsGround || (form.ground && form.note.trim().length > 0);
  // r33: a year-end decision needs all three core fields - a partial
  // submit would store a meaningless classification.
  const submitReady =
    !!formValid && !!effKqht && !!effKqrl && !!effPromo;

  const snapshotMismatch =
    dec?.computed_snapshot &&
    (dec.computed_snapshot.kqht !== bundle.computed.kqht.value ||
      dec.computed_snapshot.kqrl !== bundle.computed.kqrl.value ||
      dec.computed_snapshot.danhHieu !== bundle.computed.danhHieu ||
      dec.computed_snapshot.promotion !== bundle.computed.promotion.value ||
      dec.computed_snapshot.absentTotal !== bundle.absentTotal);

  const payload = (submit: boolean): DecisionInput => ({
    studentId: bundle.student.id,
    academicYearId: dec?.academic_year_id ?? yearId ?? "",
    stage: dec?.stage ?? "initial",
    kqht: effKqht,
    kqrl: effKqrl,
    danhHieu: effDanhHieu,
    promotion: effPromo,
    overrideLegalGround: needsGround ? form.ground : (dec?.override_legal_ground ?? null),
    overrideNote: needsGround ? form.note : (dec?.override_note ?? null),
    exemptSubjectIds: dec?.exempt_subject_ids ?? [],
    giayKhenNote: dec?.giay_khen_note ?? null,
    computedSnapshot: submit
      ? {
          kqht: bundle.computed.kqht.value,
          kqrl: bundle.computed.kqrl.value,
          danhHieu: bundle.computed.danhHieu,
          promotion: bundle.computed.promotion.value,
          absentTotal: bundle.absentTotal,
        }
      : null,
  });

  async function run(key: string, fn: () => Promise<{ error?: string }>) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: "Đã lưu." });
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const canCreateRetest =
    dec?.status === "approved" && dec.promotion === "kiem_tra_danh_gia_lai" &&
    !bundle.decisions.some((d) => d.stage === "after_retest");
  const canCreateSummer =
    dec?.status === "approved" && dec.promotion === "ren_luyen_he" &&
    !bundle.decisions.some((d) => d.stage === "after_summer");

  const chip = (
    value: string | null,
    current: string | null,
    label: string,
    onPick: (v: string | null) => void,
  ) => (
    <button
      key={value ?? "none"}
      type="button"
      disabled={!editable}
      onClick={() => onPick(value)}
      className={
        current === value
          ? "rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
          : "rounded-full border border-border bg-card px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
      }
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/records/hoc-ba${baseQuery}`} className="text-sm text-primary hover:underline">
          Về danh sách lớp
        </Link>
        {exportable && (
          <div className="flex gap-2">
            {(["docx", "pdf"] as const).map((f) => (
              <button
                key={f}
                type="button"
                disabled={busy === `export-${f}`}
                onClick={() =>
                  run(`export-${f}`, async () => {
                    const res = await fetch(
                      `/api/records/hoc-ba/export?format=${f}&student=${bundle.student.id}`,
                    );
                    if (!res.ok)
                      return { error: res.status === 403 ? "Bạn không có quyền xuất." : "Xuất file thất bại." };
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `hoc-ba-${bundle.student.code ?? bundle.student.id}.${f}`;
                    a.click();
                    URL.revokeObjectURL(url);
                    return {};
                  })
                }
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {busy === `export-${f}` ? "Đang xuất..." : `Xuất ${f.toUpperCase()}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 1. Định danh */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="text-lg font-semibold">{bundle.student.full_name}</h2>
        <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <p>Mã học sinh: {bundle.student.code ?? "-"}</p>
          <p>Mã định danh: {bundle.student.national_id ?? "-"}</p>
          <p>Ngày sinh: {bundle.student.dob ? fmtDateVN(bundle.student.dob) : "-"}</p>
          <p>Giới tính: {bundle.student.gender === "nam" ? "Nam" : bundle.student.gender === "nu" ? "Nữ" : "-"}</p>
          <p>Lớp: {className}</p>
        </div>
      </section>

      {/* 2. Bảng điểm */}
      <section>
        <h2 className="mb-2 text-base font-semibold">Bảng điểm theo Thông tư 22</h2>
        <DataTable columns={["Môn học", "Học kỳ 1", "Học kỳ 2", "Cả năm"]}>
          {bundle.subjectRows.map((s) => (
            <tr key={s.subjectId}>
              <td className="font-medium">
                {s.name}
                {s.isExempt && <span className="ml-1 text-xs text-muted-foreground">(miễn)</span>}
              </td>
              {s.isComment ? (
                <>
                  <td>{s.resultHk1 === "dat" ? "Đạt" : s.resultHk1 === "chua_dat" ? "Chưa đạt" : "-"}</td>
                  <td>{s.resultHk2 === "dat" ? "Đạt" : s.resultHk2 === "chua_dat" ? "Chưa đạt" : "-"}</td>
                  <td className="font-semibold">{s.resultYear === "dat" ? "Đạt" : s.resultYear === "chua_dat" ? "Chưa đạt" : "-"}</td>
                </>
              ) : (
                <>
                  <td>{s.hk1 != null ? s.hk1.toFixed(1) : "-"}{s.hk1 != null && !s.hk1Final && " *"}</td>
                  <td>{s.hk2 != null ? s.hk2.toFixed(1) : "-"}{s.hk2 != null && !s.hk2Final && " *"}</td>
                  <td className="font-semibold">{s.cn != null ? s.cn.toFixed(1) : "-"}{s.cn != null && !s.yearFinal && " *"}</td>
                </>
              )}
            </tr>
          ))}
          {bundle.subjectRows.length === 0 && (
            <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Chưa có điểm.</td></tr>
          )}
        </DataTable>
      </section>

      {/* 3. Hạnh kiểm */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="mb-2 text-base font-semibold">Kết quả rèn luyện</h2>
        {!bundle.conductHk1 && !bundle.conductHk2 ? (
          <p className="text-sm text-muted-foreground">Chưa đánh giá hạnh kiểm.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Học kỳ 1: {bundle.conductHk1 ? <StatusBadge label={RATING_LABEL[bundle.conductHk1]} tone={RATING_TONE[bundle.conductHk1]} /> : "-"}</span>
            <span>Học kỳ 2: {bundle.conductHk2 ? <StatusBadge label={RATING_LABEL[bundle.conductHk2]} tone={RATING_TONE[bundle.conductHk2]} /> : "-"}</span>
            <span>Cả năm: <RatingBadge v={bundle.computed.kqrl.value} missing={bundle.computed.kqrl.missing} /></span>
          </div>
        )}
        {bundle.conductComment && (
          <p className="mt-2 text-sm text-muted-foreground">Nhận xét giáo viên chủ nhiệm: {bundle.conductComment}</p>
        )}
      </section>

      {/* 4. Năng lực phẩm chất */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="mb-2 text-base font-semibold">Năng lực phẩm chất</h2>
        {bundle.nlpcEvals.length === 0 && bundle.nlpcComments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa đánh giá năng lực phẩm chất.</p>
        ) : (
          <div className="space-y-1 text-sm">
            {bundle.nlpcEvals.map((e) => (
              <p key={e.attribute_code}><span className="text-muted-foreground">{e.attribute_code}:</span> {e.level}</p>
            ))}
            {bundle.nlpcComments.map((c) => (
              <p key={c.grp} className="text-muted-foreground">{c.grp}: {c.comment}</p>
            ))}
          </div>
        )}
      </section>

      {/* 5. Chuyên cần */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="mb-2 text-base font-semibold">Chuyên cần</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Buổi vắng có phép: <b>{bundle.absentExcused}</b></span>
          <span>Không phép: <b>{bundle.absentUnexcused}</b></span>
          <span>Tổng: <b>{bundle.absentTotal}</b></span>
          {bundle.absentTotal > 45 && (
            <StatusBadge label="> 45 buổi - không được xét lên lớp" tone="error" />
          )}
        </div>
      </section>

      {/* 6. Kết quả năm + quyết định */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Kết quả cả năm</h2>
          {dec && STAGE_LABEL[dec.stage] && (
            <StatusBadge label={STAGE_LABEL[dec.stage]} tone="primary" />
          )}
          {dec && <StatusBadge label={STATUS_META[dec.status].label} tone={STATUS_META[dec.status].tone} />}
          {snapshotMismatch && (
            <StatusBadge label="Dữ liệu nguồn đã thay đổi" tone="warning" />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Hệ thống tính</p>
            <div className="space-y-1.5 text-sm">
              <p>Kết quả học tập: <RatingBadge v={bundle.computed.kqht.value} missing={bundle.computed.kqht.missing} /></p>
              <p>Kết quả rèn luyện: <RatingBadge v={bundle.computed.kqrl.value} missing={bundle.computed.kqrl.missing} /></p>
              <p>Danh hiệu: {bundle.computed.danhHieu === "xuat_sac" ? "Học sinh Xuất sắc" : bundle.computed.danhHieu === "gioi" ? "Học sinh Giỏi" : "-"}</p>
              <p>Lên lớp: <PromoLabel v={bundle.computed.promotion.value} /></p>
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Quyết định{dec ? ` (lần trình ${dec.revision})` : ""}
            </p>
            {dec ? (
              <div className="space-y-1.5 text-sm">
                <p>Kết quả học tập: {dec.kqht ? <StatusBadge label={RATING_LABEL[dec.kqht]} tone={RATING_TONE[dec.kqht]} /> : "-"}</p>
                <p>Kết quả rèn luyện: {dec.kqrl ? <StatusBadge label={RATING_LABEL[dec.kqrl]} tone={RATING_TONE[dec.kqrl]} /> : "-"}</p>
                <p>Danh hiệu: {dec.danh_hieu ? (dec.danh_hieu === "xuat_sac" ? "Học sinh Xuất sắc" : "Học sinh Giỏi") : "-"}</p>
                <p>Lên lớp: {dec.promotion ? PROMO_LABEL[dec.promotion] : "-"}</p>
                {dec.override_legal_ground && (
                  <p className="text-muted-foreground">
                    Ghi đè: {GROUND_LABEL[dec.override_legal_ground] ?? dec.override_legal_ground}
                    {dec.override_note ? ` - ${dec.override_note}` : ""}
                  </p>
                )}
                {dec.giay_khen_note && <p>Giấy khen: {dec.giay_khen_note}</p>}
                {dec.decided_at && <p className="text-xs text-muted-foreground">Trình: {formatDateTime(dec.decided_at)}</p>}
                {dec.approved_at && <p className="text-xs text-muted-foreground">Duyệt: {formatDateTime(dec.approved_at)}</p>}
                {dec.status === "rejected" && dec.reject_reason && (
                  <p className="rounded-lg border border-l-4 border-l-error border-border bg-error-bg p-2 text-error">
                    Lý do trả lại: {dec.reject_reason}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có quyết định.</p>
            )}
          </div>
        </div>

        {msg && (
          <p className={`mt-3 rounded-lg border border-l-4 p-2 text-sm ${msg.ok ? "border-l-success text-success" : "border-l-error text-error"}`}>
            {msg.text}
          </p>
        )}

        {/* Form GVCN */}
        {canWrite && !locked && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            {dec?.status === "submitted" ? (
              <p className="rounded-lg bg-warning-bg p-2 text-sm text-warning">
                Đang chờ Ban Giám Hiệu duyệt.
              </p>
            ) : editable ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Kết quả học tập</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kết quả học tập">
                    {(["tot", "kha", "dat", "chua_dat"] as const).map((r) =>
                      chip(r, effKqht, RATING_LABEL[r], (v) =>
                        pickField({ kqht: v as YearRating }),
                      ),
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Kết quả rèn luyện</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kết quả rèn luyện">
                    {(["tot", "kha", "dat", "chua_dat"] as const).map((r) =>
                      chip(r, effKqrl, RATING_LABEL[r], (v) =>
                        pickField({ kqrl: v as YearRating }),
                      ),
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Danh hiệu</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Danh hiệu">
                    {chip(null, effDanhHieu, "Không", (v) => pickField({ danhHieu: v as null }))}
                    {chip("xuat_sac", effDanhHieu, "Học sinh Xuất sắc", (v) => pickField({ danhHieu: v as "xuat_sac" }))}
                    {chip("gioi", effDanhHieu, "Học sinh Giỏi", (v) => pickField({ danhHieu: v as "gioi" }))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Quyết định lên lớp</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quyết định lên lớp">
                    {(["len_lop", "kiem_tra_danh_gia_lai", "ren_luyen_he", "o_lai"] as const).map((p) =>
                      chip(p, effPromo, PROMO_LABEL[p], (v) =>
                        pickField({ promotion: v as Promotion }),
                      ),
                    )}
                  </div>
                </div>

                {needsGround && (
                  <div className="space-y-2 rounded-lg border border-warning-border bg-warning-bg p-3">
                    <p className="text-sm font-medium">
                      Ghi đè gợi ý - bắt buộc căn cứ pháp lý
                    </p>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Căn cứ pháp lý">
                      {Object.entries(GROUND_LABEL).map(([k, l]) =>
                        chip(k, form.ground, l, (v) => pickField({ ground: v })),
                      )}
                    </div>
                    <AutoGrowTextarea
                      value={form.note}
                      onChange={(e) => pickField({ note: e.target.value })}
                      placeholder="Ghi chú căn cứ (bắt buộc)"
                      className="w-full"
                    />
                    {needsGround && !form.ground && (
                      <p className="text-xs text-error">Cần chọn căn cứ pháp lý.</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busy || !formValid}
                    onClick={() => run("save", () => saveYearEndDecision(payload(false), false))}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {busy === "save" ? "Đang lưu..." : "Lưu nháp"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busy || !submitReady}
                    onClick={() => run("submit", () => saveYearEndDecision(payload(true), true))}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === "submit" ? "Đang trình..." : "Trình Ban Giám Hiệu duyệt"}
                  </button>
                </div>
              </>
            ) : null}

            {/* Stage sau */}
            {dec?.status === "approved" && (canCreateRetest || canCreateSummer) && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {canCreateRetest && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => run("stage", () => createNextStage({ studentId: bundle.student.id, academicYearId: dec.academic_year_id, stage: "after_retest" }))}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Tạo quyết định sau đánh giá lại
                  </button>
                )}
                {canCreateSummer && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => run("stage", () => createNextStage({ studentId: bundle.student.id, academicYearId: dec.academic_year_id, stage: "after_summer" }))}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Tạo quyết định sau rèn luyện hè
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form BGH */}
        {approvable && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Giấy khen (tùy chọn - chỉ Ban Giám Hiệu)</p>
              <AutoGrowTextarea
                value={giayKhen}
                onChange={(e) => setGiayKhen(e.target.value)}
                placeholder="Nội dung giấy khen (thành tích đột xuất / tiến bộ vượt bậc)"
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => run("approve", () => approveYearEnd({ decisionId: dec!.id, giayKhenNote: giayKhen || null }))}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy === "approve" ? "Đang duyệt..." : "Duyệt"}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setRejectOpen(true)}
                className="rounded-lg border border-error bg-card px-4 py-2 text-sm font-medium text-error hover:bg-error-bg disabled:opacity-50"
              >
                Trả lại
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Reject dialog */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-5 shadow-lg">
            <h3 className="text-base font-semibold">Trả lại học bạ</h3>
            <AutoGrowTextarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Lý do trả lại (bắt buộc, tối thiểu 10 ký tự)"
              className="w-full"
              autoFocus
            />
            {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
              <p className="text-xs text-error">Lý do bắt buộc ≥ 10 ký tự.</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">
                Hủy
              </button>
              <button
                type="button"
                disabled={rejectReason.trim().length < 10 || !!busy}
                onClick={() =>
                  run("reject", async () => {
                    const r = await rejectYearEnd({ decisionId: dec!.id, rejectReason });
                    if (!r.error) setRejectOpen(false);
                    return r;
                  })
                }
                className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-error-foreground disabled:opacity-50"
              >
                {busy === "reject" ? "Đang gửi..." : "Xác nhận trả lại"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

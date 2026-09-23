"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatDateOnly, sortByVietnameseName } from "@/lib/utils";
import { StudentRecordEditor } from "@/components/records/student-record-editor";

export interface StudentSummaryRow {
  id: string;
  code: string;
  nationalId: string | null;
  fullName: string;
  gender: string | null;
  dob: string | null;
  address: string | null;
  status: string;
  groupName: string | null;
  roleLabel: string | null;
  positivePoints: number;
  avgScore: number | null;
  attendancePct: number | null;
  conductLabel: string | null;
  conductTone: "success" | "warning" | "error" | "muted" | "primary";
}

/** Ô nhập Mã định danh Bộ GD&ĐT (10 số) trong panel chi tiết hồ sơ. */
function NationalIdField({
  studentId,
  initial,
}: {
  studentId: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    const v = value.trim();
    if (v && !/^\d{10}$/.test(v)) {
      setMsg("Mã phải gồm đúng 10 chữ số.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("students")
      .update({ national_id: v || null })
      .eq("id", studentId);
    setBusy(false);
    setMsg(error ? `Lỗi: ${error.message}` : "Đã lưu.");
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="10 chữ số"
        inputMode="numeric"
        className="h-7 w-28 rounded-md border border-border bg-background px-2 font-mono text-xs outline-none focus:border-ring"
        aria-label="Mã định danh Bộ GD&ĐT"
      />
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "…" : "Lưu"}
      </button>
      {msg && (
        <span className="text-xs text-muted-foreground">{msg}</span>
      )}
    </div>
  );
}

const GENDER_LABEL: Record<string, string> = {
  nam: "Nam",
  nu: "Nữ",
  khac: "Khác",
};

const STUDENT_STATUS: Record<
  string,
  { label: string; tone: "success" | "warning" | "error" | "muted" | "primary" }
> = {
  active: { label: "Đang học", tone: "success" },
  transferred: { label: "Đã chuyển", tone: "muted" },
  graduated: { label: "Đã tốt nghiệp", tone: "muted" },
  suspended: { label: "Đình chỉ", tone: "error" },
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

export function StudentsExplorer({
  students: rawStudents,
  classes,
  selectedClassId,
  className,
}: {
  students: StudentSummaryRow[];
  classes: { id: string; name: string }[];
  selectedClassId: string;
  className: string;
}) {
  const students = sortByVietnameseName(rawStudents, (s) => s.fullName);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return students;
    return students.filter(
      (s) => normalize(s.fullName).includes(q) || normalize(s.code).includes(q),
    );
  }, [students, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc mã học sinh..."
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            aria-label="Tìm kiếm học sinh"
          />
        </div>
        {classes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {classes.map((c) => (
              <Link prefetch={false}
                key={c.id}
                href={`/records/students?class=${c.id}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  c.id === selectedClassId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
        <span className="text-sm text-muted-foreground">
          {filtered.length}/{students.length} học sinh · Lớp {className}
        </span>
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {[
                "Mã HS",
                "Họ tên",
                "Tổ",
                "Điểm TB",
                "Chuyên cần",
                "Hạnh kiểm",
                "Trạng thái",
                "",
              ].map((c) => (
                <th
                  key={c}
                  className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr]:border-b [&_tr]:border-border [&_td]:px-4 [&_td]:py-2.5">
            {filtered.map((s) => {
              const open = expandedId === s.id;
              const st = STUDENT_STATUS[s.status] ?? {
                label: s.status,
                tone: "muted" as const,
              };
              return (
                <Fragment key={s.id}>
                  <tr
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setExpandedId(open ? null : s.id)}
                  >
                    <td className="font-mono text-xs">{s.code}</td>
                    <td className="font-medium">{s.fullName}</td>
                    <td>{s.groupName ?? "-"}</td>
                    <td>
                      {s.avgScore !== null ? (
                        <span
                          className={cn(
                            "font-medium",
                            s.avgScore >= 8
                              ? "text-success"
                              : s.avgScore >= 6.5
                                ? "text-foreground"
                                : s.avgScore >= 5
                                  ? "text-warning"
                                  : "text-error",
                          )}
                        >
                          {s.avgScore.toFixed(1)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {s.attendancePct !== null ? `${s.attendancePct}%` : "-"}
                    </td>
                    <td>
                      {s.conductLabel ? (
                        <StatusBadge
                          label={s.conductLabel}
                          tone={s.conductTone}
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <StatusBadge label={st.label} tone={st.tone} />
                    </td>
                    <td className="text-muted-foreground">
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-muted/30">
                      <td colSpan={8} className="!py-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                              Thông tin
                            </p>
                            <ul className="mt-1.5 space-y-1 text-sm">
                              <li>
                                Giới tính:{" "}
                                {s.gender ? (GENDER_LABEL[s.gender] ?? s.gender) : "-"}
                              </li>
                              <li>
                                Ngày sinh:{" "}
                                {s.dob ? formatDateOnly(s.dob) : "-"}
                              </li>
                              <li>Tổ: {s.groupName ?? "Chưa xếp tổ"}</li>
                              <li>
                                Ban cán sự: {s.roleLabel ?? "Không giữ chức vụ"}
                              </li>
                              <li>
                                Mã định danh Bộ GD&ĐT:
                              </li>
                              <li>
                                <NationalIdField
                                  studentId={s.id}
                                  initial={s.nationalId}
                                />
                              </li>
                              <li>Địa chỉ: {s.address ?? "-"}</li>
                            </ul>
                            <div className="mt-3">
                              <StudentRecordEditor
                                student={{
                                  id: s.id,
                                  full_name: s.fullName,
                                  code: s.code,
                                  dob: s.dob,
                                  gender: s.gender,
                                  address: s.address,
                                  national_id: s.nationalId,
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                              Học tập
                            </p>
                            <p className="mt-1.5 text-2xl font-semibold">
                              {s.avgScore !== null ? s.avgScore.toFixed(1) : "-"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Điểm trung bình các môn
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                              Chuyên cần
                            </p>
                            <p className="mt-1.5 text-2xl font-semibold">
                              {s.attendancePct !== null
                                ? `${s.attendancePct}%`
                                : "-"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Tỷ lệ đi học (có mặt + đi muộn)
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                              Rèn luyện
                            </p>
                            <div className="mt-1.5">
                              {s.conductLabel ? (
                                <StatusBadge
                                  label={`Hạnh kiểm: ${s.conductLabel}`}
                                  tone={s.conductTone}
                                />
                              ) : (
                                <span className="text-sm">Chưa đánh giá</span>
                              )}
                            </div>
                            <p className="mt-2 text-sm">
                              Điểm tích cực:{" "}
                              <span className="font-medium text-success">
                                +{s.positivePoints}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  Không tìm thấy học sinh phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

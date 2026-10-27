"use client";

import { useState, useTransition } from "react";
import { parseSpreadsheet } from "@/lib/excel";
import { sortByVietnameseName } from "@/lib/utils";
import {
  addApplications,
  assignExamNumbers,
  createCampaign,
  enrollApplications,
  finalizeResults,
  reviewApplication,
  saveScores,
  updateCampaign,
  type ApplicationRow,
} from "@/app/(app)/school/admissions/actions";

interface YearOpt {
  id: string;
  name: string;
  is_current: boolean;
}

export function NewCampaignForm({ years }: { years: YearOpt[] }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<"khoi_6" | "khoi_10">("khoi_6");
  const [name, setName] = useState("");
  const [quota, setQuota] = useState("");
  const [yearId, setYearId] = useState(
    years.find((y) => y.is_current)?.id ?? "",
  );
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Tạo đợt tuyển mới
        </button>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="khoi_6">Vào lớp 6 - xét tuyển</option>
              <option value="khoi_10">Vào lớp 10 - thi tuyển</option>
            </select>
            <select
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">- Chọn năm học -</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                  {y.is_current ? " (hiện tại)" : ""}
                </option>
              ))}
            </select>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên đợt tuyển (vd: TS lớp 6 năm 2027)"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              placeholder="Chỉ tiêu (tùy chọn)"
              type="number"
              min={0}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              disabled={pending || !name.trim()}
              onClick={() =>
                start(async () => {
                  const r = await createCampaign({
                    level,
                    name,
                    quota: quota ? Number(quota) : null,
                    academicYearId: yearId || null,
                  });
                  setMsg(
                    r.error ? `Lỗi: ${r.error}` : "Đã tạo đợt tuyển.",
                  );
                  if (!r.error) {
                    setOpen(false);
                    setName("");
                    setQuota("");
                  }
                })
              }
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {pending ? "Đang tạo..." : "Tạo đợt tuyển"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm"
            >
              Hủy
            </button>
            {msg && <p className="self-center text-sm text-zinc-600">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export interface AppRow {
  id: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  id_number: string | null;
  address: string | null;
  source_school: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  exam_number: string | null;
  exam_scores: Record<string, number> | null;
  total_score: number | null;
  status: string;
  student_id: string | null;
}

const ST: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Đã nộp", cls: "bg-zinc-100 text-zinc-700" },
  approved: { label: "Trúng tuyển", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Không đạt", cls: "bg-red-100 text-red-700" },
  exam_registered: { label: "Có SBD", cls: "bg-sky-100 text-sky-800" },
  passed: { label: "Đỗ", cls: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Trượt", cls: "bg-red-100 text-red-700" },
  enrolled: { label: "Đã nhập học", cls: "bg-violet-100 text-violet-800" },
};

const SUBJECT_LABEL: Record<string, string> = {
  toan: "Toán",
  van: "Văn",
  ngoai_ngu: "Ngoại ngữ",
  chuyen: "Chuyên",
};

const HEADER_MAP: Record<string, keyof ApplicationRow> = {
  "họ tên": "full_name",
  "ho ten": "full_name",
  "ngày sinh": "dob",
  "ngay sinh": "dob",
  "giới tính": "gender",
  "gioi tinh": "gender",
  "số định danh": "id_number",
  "so dinh danh": "id_number",
  "địa chỉ": "address",
  "dia chi": "address",
  "trường cũ": "source_school",
  "truong cu": "source_school",
  "phụ huynh": "parent_name",
  "phu huynh": "parent_name",
  "sđt": "parent_phone",
  "sdt": "parent_phone",
  "điện thoại": "parent_phone",
  "dien thoai": "parent_phone",
  "nguyện vọng": "priority_order",
  "nguyen vong": "priority_order",
};

export function AdmissionBoard({
  campaign,
  applications,
  classes,
}: {
  campaign: {
    id: string;
    level: string;
    name: string;
    status: string;
    quota: number | null;
    benchmark: number | null;
    exam_subjects: string[];
  };
  applications: AppRow[];
  classes: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState("all");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [bench, setBench] = useState(String(campaign.benchmark ?? ""));
  const [targetClass, setTargetClass] = useState(classes[0]?.id ?? "");
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});

  const isExam = campaign.level === "khoi_10";
  const counts: Record<string, number> = {};
  for (const a of applications) counts[a.status] = (counts[a.status] ?? 0) + 1;
  const filtered = tab === "all" ? applications : applications.filter((a) => a.status === tab);
  const rows = sortByVietnameseName(filtered, (a) => a.full_name);
  const tabs = isExam
    ? ["all", "submitted", "exam_registered", "passed", "failed", "enrolled"]
    : ["all", "submitted", "approved", "rejected", "enrolled"];

  async function onFile(f: File) {
    setMsg("Đang đọc file...");
    try {
      const table = await parseSpreadsheet(f);
      const [head, ...body] = table;
      if (!head || !body.length) {
        setMsg("File rỗng.");
        return;
      }
      const cols = head.map((h) => HEADER_MAP[String(h).trim().toLowerCase()]);
      const rows: ApplicationRow[] = body.map((r) => {
        const o: Record<string, unknown> = {};
        cols.forEach((k, i) => {
          if (!k) return;
          const v = String(r[i] ?? "").trim();
          if (k === "priority_order") o[k] = Number(v) || 1;
          else o[k] = v || null;
        });
        return o as unknown as ApplicationRow;
      });
      const r = await addApplications(campaign.id, rows);
      setMsg(r.error ? `Lỗi: ${r.error}` : `Đã nhập ${r.added} hồ sơ.`);
    } catch {
      setMsg("Không đọc được file. Dùng .xlsx hoặc .csv.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar theo stage */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">
          Nhập Excel/CSV
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) start(() => onFile(f));
              e.target.value = "";
            }}
          />
        </label>
        {isExam && (
          <button
            disabled={pending || !counts.submitted}
            onClick={() =>
              start(async () => {
                const r = await assignExamNumbers(campaign.id);
                setMsg(r.error ? `Lỗi: ${r.error}` : `Đã cấp ${r.assigned} SBD.`);
              })
            }
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-40"
          >
            Cấp SBD cho {counts.submitted ?? 0} hồ sơ
          </button>
        )}
        {isExam && (
          <span className="flex items-center gap-1 text-sm">
            Điểm chuẩn
            <input
              value={bench}
              onChange={(e) => setBench(e.target.value)}
              type="number"
              step="0.25"
              className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5"
            />
            <button
              disabled={pending || !bench}
              onClick={() =>
                start(async () => {
                  const u = await updateCampaign(campaign.id, {
                    benchmark: Number(bench),
                  });
                  if (u.error) {
                    setMsg(`Lỗi: ${u.error}`);
                    return;
                  }
                  const r = await finalizeResults(campaign.id);
                  setMsg(
                    r.error
                      ? `Lỗi: ${r.error}`
                      : `Chốt: ${r.passed} đỗ, ${r.failed} trượt.`,
                  );
                })
              }
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              Chốt kết quả
            </button>
          </span>
        )}
        <select
          value={targetClass}
          onChange={(e) => setTargetClass(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              Xếp lớp {c.name}
            </option>
          ))}
        </select>
        <button
          disabled={pending || !targetClass}
          onClick={() =>
            start(async () => {
              const r = await enrollApplications(campaign.id, targetClass);
              setMsg(
                r.error
                  ? `Lỗi: ${r.error}`
                  : `Đã nhập học ${r.enrolled} học sinh.`,
              );
            })
          }
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          Nhập học {(counts.approved ?? 0) + (counts.passed ?? 0)} HS
        </button>
        {campaign.status !== "open" && (
          <button
            disabled={pending}
            onClick={() =>
            start(async () => {
              const r = await updateCampaign(campaign.id, { status: "open" });
              setMsg(r.error ? `Lỗi: ${r.error}` : "Đã mở nhận hồ sơ.");
            })
          }
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            Mở nhận hồ sơ
          </button>
        )}
        {msg && <p className="w-full text-sm text-zinc-600">{msg}</p>}
      </div>

      {/* Tabs trạng thái */}
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === t
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {t === "all" ? "Tất cả" : (ST[t]?.label ?? t)} (
            {t === "all" ? applications.length : (counts[t] ?? 0)})
          </button>
        ))}
      </div>

      {/* Bảng hồ sơ */}
      <div className="relative overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Họ tên</th>
              <th className="px-3 py-2">Ngày sinh</th>
              {isExam && <th className="px-3 py-2">SBD</th>}
              <th className="px-3 py-2">Trường cũ</th>
              <th className="px-3 py-2">Phụ huynh</th>
              {isExam && campaign.exam_subjects.map((s) => (
                <th key={s} className="px-2 py-2 text-center">
                  {SUBJECT_LABEL[s] ?? s}
                </th>
              ))}
              {isExam && <th className="px-2 py-2 text-center">Tổng</th>}
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-3 py-2 font-medium">{a.full_name}</td>
                <td className="px-3 py-2">{a.dob ?? "-"}</td>
                {isExam && <td className="px-3 py-2">{a.exam_number ?? "-"}</td>}
                <td className="px-3 py-2">{a.source_school ?? "-"}</td>
                <td className="px-3 py-2">
                  {a.parent_name ?? "-"}
                  {a.parent_phone ? ` · ${a.parent_phone}` : ""}
                </td>
                {isExam &&
                  campaign.exam_subjects.map((s) => (
                    <td key={s} className="px-1 py-1 text-center">
                      {a.status === "exam_registered" ? (
                        <input
                          type="number"
                          step="0.25"
                          min={0}
                          max={10}
                          defaultValue={a.exam_scores?.[s] ?? ""}
                          onChange={(e) =>
                            setScoreDraft((d) => ({
                              ...d,
                              [`${a.id}:${s}`]: e.target.value,
                            }))
                          }
                          className="w-14 rounded border border-zinc-200 px-1 py-0.5 text-center"
                        />
                      ) : (
                        (a.exam_scores?.[s] ?? "-")
                      )}
                    </td>
                  ))}
                {isExam && (
                  <td className="px-2 py-2 text-center font-medium">
                    {a.total_score ?? "-"}
                  </td>
                )}
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${ST[a.status]?.cls ?? "bg-zinc-100"}`}
                  >
                    {ST[a.status]?.label ?? a.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {!isExam && a.status === "submitted" && (
                    <span className="flex gap-1">
                      <button
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await reviewApplication(a.id, "approved");
                            setMsg(r.error ? `Lỗi: ${r.error}` : `Đã duyệt ${a.full_name}.`);
                          })
                        }
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                      >
                        Duyệt
                      </button>
                      <button
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await reviewApplication(a.id, "rejected");
                            setMsg(r.error ? `Lỗi: ${r.error}` : `Đã từ chối ${a.full_name}.`);
                          })
                        }
                        className="rounded bg-red-100 px-2 py-1 text-xs text-red-700"
                      >
                        Từ chối
                      </button>
                    </span>
                  )}
                  {isExam && a.status === "exam_registered" && (
                    <button
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const scores: Record<string, number> = {};
                          for (const s of campaign.exam_subjects) {
                            const v =
                              scoreDraft[`${a.id}:${s}`] ??
                              String(a.exam_scores?.[s] ?? "");
                            if (v !== "") scores[s] = Number(v);
                          }
                          const r = await saveScores(a.id, scores);
                          setMsg(r.error ? `Lỗi: ${r.error}` : `Đã lưu điểm ${a.full_name}.`);
                        })
                      }
                      className="rounded bg-zinc-900 px-2 py-1 text-xs text-white"
                    >
                      Lưu điểm
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={isExam ? 8 + campaign.exam_subjects.length : 6}
                  className="px-3 py-8 text-center text-zinc-400"
                >
                  Không có hồ sơ nào ở trạng thái này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

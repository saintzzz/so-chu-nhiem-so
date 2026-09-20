"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import {
  addSupportStaff,
  toggleStaffStandardized,
} from "@/app/(app)/school/actions";
import { compareVietnameseName } from "@/lib/utils";

export const POSITION_LABEL: Record<string, string> = {
  y_te: "Nhân viên y tế",
  thu_vien: "Thủ thư / thư viện",
  giao_vu: "Giáo vụ / văn thư",
  tam_ly: "Tư vấn tâm lý",
  cntt: "Công nghệ thông tin",
  thiet_bi: "Thiết bị dạy học",
  tai_chinh: "Kế toán / tài chính",
};

interface StaffRow {
  id: string;
  full_name: string;
  position: string;
  campus_id: string | null;
  qualification: string | null;
  standardized: boolean;
}

export function StaffBoard({
  staff,
  campuses,
}: {
  staff: StaffRow[];
  campuses: { id: string; name: string }[];
}) {
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("y_te");
  const [campusId, setCampusId] = useState("");
  const [qualification, setQualification] = useState("");
  const [standardized, setStandardized] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const campusName = new Map(campuses.map((c) => [c.id, c.name]));
  const sortedStaff = [...staff].sort((a, b) =>
    compareVietnameseName(a.full_name, b.full_name),
  );

  function add() {
    start(async () => {
      setErr(null);
      setMsg(null);
      const r = await addSupportStaff({
        fullName,
        position,
        campusId: campusId || null,
        qualification,
        standardized,
      });
      if (r.error) setErr(r.error);
      else {
        setMsg("Đã thêm nhân sự hỗ trợ.");
        setFullName("");
        setQualification("");
        setStandardized(false);
      }
    });
  }

  function toggle(id: string, val: boolean) {
    start(async () => {
      setErr(null);
      const r = await toggleStaffStandardized(id, val);
      if (r.error) setErr(r.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="mb-3 text-sm font-semibold">Thêm nhân sự</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Họ tên</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Vị trí</span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            >
              {Object.entries(POSITION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Cơ sở</span>
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            >
              <option value="">- Toàn trường -</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Trình độ</span>
            <input
              type="text"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              placeholder="VD: Cử nhân Y học dự phòng"
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            />
          </label>
          <label className="flex items-end gap-2 pb-1.5 text-sm">
            <input
              type="checkbox"
              checked={standardized}
              onChange={(e) => setStandardized(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Đạt chuẩn trình độ
          </label>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={pending || !fullName.trim()}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Thêm nhân sự
        </button>
      </div>

      {err && (
        <p className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-success/30 bg-success-bg px-3 py-2 text-sm text-success">
          {msg}
        </p>
      )}

      <DataTable
        columns={["Họ tên", "Vị trí", "Cơ sở", "Trình độ", "Đạt chuẩn", "Thao tác"]}
      >
        {sortedStaff.map((s) => (
          <tr key={s.id}>
            <td className="font-medium">{s.full_name}</td>
            <td>{POSITION_LABEL[s.position] ?? s.position}</td>
            <td className="text-muted-foreground">
              {s.campus_id ? (campusName.get(s.campus_id) ?? "-") : "Toàn trường"}
            </td>
            <td className="text-muted-foreground">{s.qualification ?? "-"}</td>
            <td>
              {s.standardized ? (
                <StatusBadge label="Đạt chuẩn" tone="success" />
              ) : (
                <StatusBadge label="Chưa đạt" tone="warning" />
              )}
            </td>
            <td>
              <button
                type="button"
                onClick={() => toggle(s.id, !s.standardized)}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
              >
                <Check className="size-3" />
                {s.standardized ? "Bỏ đạt chuẩn" : "Đánh dấu đạt chuẩn"}
              </button>
            </td>
          </tr>
        ))}
        {staff.length === 0 && (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              Chưa có nhân sự hỗ trợ nào.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}

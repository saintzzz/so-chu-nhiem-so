"use client";

import { useState, useTransition } from "react";
import { DataTable } from "@/components/data-table";
import {
  assignClassCampus,
  createCampus,
} from "@/app/(app)/school/actions";

const KIND_OPTIONS = [
  { value: "main", label: "Cơ sở chính" },
  { value: "phan_hieu", label: "Phân hiệu" },
  { value: "diem_truong", label: "Điểm trường" },
] as const;

export function CampusManager({
  campuses,
  classes,
}: {
  campuses: { id: string; name: string }[];
  classes: { id: string; name: string; campus_id: string | null }[];
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"main" | "phan_hieu" | "diem_truong">(
    "phan_hieu",
  );
  const [distance, setDistance] = useState("");
  const [address, setAddress] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const campusName = new Map(campuses.map((c) => [c.id, c.name]));

  function create() {
    start(async () => {
      setErr(null);
      setMsg(null);
      const r = await createCampus({
        name,
        kind,
        distanceKm: distance ? Number(distance) : null,
        address,
      });
      if (r.error) setErr(r.error);
      else {
        setMsg("Đã thêm cơ sở.");
        setName("");
        setDistance("");
        setAddress("");
      }
    });
  }

  function assign(classId: string, campusId: string) {
    start(async () => {
      setErr(null);
      const r = await assignClassCampus(classId, campusId || null);
      if (r.error) setErr(r.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="mb-3 text-sm font-semibold">Thêm cơ sở / phân hiệu</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Tên</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Phân hiệu Bản Mới"
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Loại</span>
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as typeof kind)
              }
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">
              Khoảng cách (km)
            </span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              disabled={kind === "main"}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring disabled:opacity-50"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Địa chỉ</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={pending || !name.trim()}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Thêm cơ sở
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

      <div>
        <h2 className="mb-2 text-sm font-semibold">Gán lớp vào cơ sở</h2>
        <DataTable columns={["Lớp", "Cơ sở hiện tại", "Chuyển sang"]}>
          {classes.map((c) => (
            <tr key={c.id}>
              <td className="font-medium">{c.name}</td>
              <td>
                {c.campus_id ? (
                  campusName.get(c.campus_id) ?? "-"
                ) : (
                  <span className="text-warning">Chưa gán</span>
                )}
              </td>
              <td>
                <select
                  value={c.campus_id ?? ""}
                  onChange={(e) => assign(c.id, e.target.value)}
                  disabled={pending}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
                >
                  <option value="">- Chưa gán -</option>
                  {campuses.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}

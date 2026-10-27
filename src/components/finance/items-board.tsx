"use client";

import { useState } from "react";
import { saveFeeItem } from "@/app/(app)/finance/actions";
import { formatMoney } from "@/lib/utils";

export type FeeItem = {
  id: string;
  name: string;
  kind: "mandatory" | "voluntary";
  unit_price: number;
  unit: string;
  applies_to: "all" | "grade" | "class";
  grade: number | null;
  class_id: string | null;
  active: boolean;
};

const fmtMoney = formatMoney;

const APPLY_LABEL: Record<string, string> = {
  all: "Toàn trường",
  grade: "Theo khối",
  class: "Theo lớp",
};

export function ItemsBoard({
  items,
  canWrite,
  classes,
}: {
  items: FeeItem[];
  canWrite: boolean;
  classes: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<FeeItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    kind: "mandatory" as "mandatory" | "voluntary",
    unit_price: "",
    unit: "thang",
    applies_to: "all" as "all" | "grade" | "class",
    grade: 6,
    class_id: "",
  });

  function openNew() {
    setEditing(null);
    setForm({ name: "", kind: "mandatory", unit_price: "", unit: "thang", applies_to: "all", grade: 6, class_id: "" });
    setErr(null);
    setShowForm(true);
  }
  function openEdit(it: FeeItem) {
    setEditing(it);
    setForm({
      name: it.name,
      kind: it.kind,
      unit_price: String(it.unit_price),
      unit: it.unit,
      applies_to: it.applies_to,
      grade: it.grade ?? 6,
      class_id: it.class_id ?? "",
    });
    setErr(null);
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(form.unit_price);
    if (!form.name.trim() || isNaN(price) || price < 0) {
      setErr("Nhập tên khoản thu và đơn giá hợp lệ (>= 0).");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await saveFeeItem({
      id: editing?.id,
      name: form.name,
      kind: form.kind,
      unit_price: price,
      unit: form.unit,
      applies_to: form.applies_to,
      grade: form.applies_to === "grade" ? form.grade : null,
      class_id: form.applies_to === "class" ? form.class_id || null : null,
    });
    setBusy(false);
    if (res?.error) return setErr(res.error);
    setShowForm(false);
  }

  async function toggleActive(it: FeeItem) {
    setBusy(true);
    setErr(null);
    const res = await saveFeeItem({
      id: it.id,
      name: it.name,
      kind: it.kind,
      unit_price: it.unit_price,
      unit: it.unit,
      applies_to: it.applies_to,
      grade: it.grade,
      class_id: it.class_id,
      active: !it.active,
    });
    setBusy(false);
    if (res?.error) setErr(res.error);
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <button onClick={openNew} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          + Thêm khoản thu
        </button>
      )}

      {showForm && (
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)] space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Tên khoản thu *</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Học phí tháng 9" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Đơn giá (đ) *</span>
              <input required inputMode="numeric" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="120000" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Đơn vị</span>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="thang" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Loại</span>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "mandatory" | "voluntary" })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="mandatory">Bắt buộc</option>
                <option value="voluntary">Tự nguyện (đăng ký)</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Áp dụng</span>
              <select value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value as "all" | "grade" | "class" })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="all">Toàn trường</option>
                <option value="grade">Theo khối</option>
                <option value="class">Theo lớp</option>
              </select>
            </label>
            {form.applies_to === "grade" && (
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Khối</span>
                <select value={form.grade} onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                    <option key={g} value={g}>Khối {g}</option>
                  ))}
                </select>
              </label>
            )}
            {form.applies_to === "class" && (
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Lớp</span>
                <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">- Chọn lớp -</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !form.name.trim() || !form.unit_price}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy ? "Đang lưu..." : editing ? "Cập nhật" : "Tạo khoản thu"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm">
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto relative rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Khoản thu</th>
              <th className="px-4 py-3 font-medium">Đơn giá</th>
              <th className="px-4 py-3 font-medium">Loại</th>
              <th className="px-4 py-3 font-medium">Áp dụng</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              {canWrite && <th className="px-4 py-3 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Chưa có khoản thu nào.</td></tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 font-medium">{it.name}<span className="ml-2 text-xs text-muted-foreground">/{it.unit}</span></td>
                <td className="px-4 py-3 tabular-nums">{fmtMoney(it.unit_price)}</td>
                <td className="px-4 py-3">{it.kind === "mandatory" ? "Bắt buộc" : "Tự nguyện"}</td>
                <td className="px-4 py-3">
                  {APPLY_LABEL[it.applies_to]}
                  {it.applies_to === "grade" && it.grade ? ` ${it.grade}` : ""}
                  {it.applies_to === "class" && ` - ${classes.find((c) => c.id === it.class_id)?.name ?? "?"}`}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${it.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    {it.active ? "Đang dùng" : "Ngừng"}
                  </span>
                </td>
                {canWrite && (
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => openEdit(it)} disabled={busy} className="text-sm text-primary hover:underline">Sửa</button>
                    <button onClick={() => toggleActive(it)} disabled={busy} className="text-sm text-muted-foreground hover:underline">
                      {it.active ? "Ngừng" : "Mở lại"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

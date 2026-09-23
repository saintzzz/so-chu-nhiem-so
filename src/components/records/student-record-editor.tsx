"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateStudentRecord } from "@/app/(app)/records/students/actions";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

export interface EditableStudent {
  id: string;
  full_name: string;
  code: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
  national_id: string | null;
}

/** Modal sua ho so hoc sinh - GVCN lop minh, BGH toan truong. */
export function StudentRecordEditor({
  student,
  trigger,
}: {
  student: EditableStudent;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: student.full_name,
    code: student.code ?? "",
    dob: student.dob ?? "",
    gender: student.gender ?? "",
    address: student.address ?? "",
    national_id: student.national_id ?? "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.full_name.trim() || !form.code.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await updateStudentRecord(student.id, {
      full_name: form.full_name.trim(),
      code: form.code.trim(),
      dob: form.dob || null,
      gender: form.gender || null,
      address: form.address.trim() || null,
      national_id: form.national_id.trim() || null,
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> Sửa hồ sơ
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Sửa hồ sơ - {student.full_name}</h3>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">
                  Họ tên *
                </span>
                <input
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Mã học sinh *
                </span>
                <input
                  value={form.code}
                  onChange={(e) => set("code", e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Mã định danh Bộ GD&ĐT
                </span>
                <input
                  value={form.national_id}
                  onChange={(e) =>
                    set(
                      "national_id",
                      e.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  placeholder="10 chữ số"
                  inputMode="numeric"
                  className={inputCls}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Ngày sinh
                </span>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => set("dob", e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Giới tính
                </span>
                <select
                  value={form.gender}
                  onChange={(e) => set("gender", e.target.value)}
                  className={inputCls}
                >
                  <option value="">-</option>
                  <option value="nam">Nam</option>
                  <option value="nu">Nữ</option>
                  <option value="khac">Khác</option>
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">
                  Địa chỉ
                </span>
                <input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>

            {err && <p className="mt-3 text-sm text-error">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={save}
                disabled={busy || !form.full_name.trim() || !form.code.trim()}
              >
                {busy ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

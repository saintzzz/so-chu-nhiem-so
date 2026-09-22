"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  addEquipment,
  updateEquipmentCondition,
  deleteEquipment,
} from "@/app/(app)/school/actions";

interface Item {
  id: string;
  name: string;
  category: string;
  quantity: number;
  condition: string;
  campus_id: string | null;
  note: string | null;
}

const CATEGORIES: Record<string, string> = {
  thiet_bi: "Thiết bị dạy học",
  cntt: "Máy tính / CNTT",
  am_thanh: "Âm thanh",
  the_thao: "Thể thao",
  thu_vien: "Thư viện",
  khac: "Khác",
};
const CONDITIONS: Record<string, { label: string; tone: "success" | "warning" | "error" | "muted" }> = {
  tot: { label: "Tốt", tone: "success" },
  hong_nhe: { label: "Hỏng nhẹ", tone: "warning" },
  hong_nang: { label: "Hỏng nặng", tone: "error" },
  thanh_ly: { label: "Thanh lý", tone: "muted" },
};

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring";

export function EquipmentBoard({
  items,
  campuses,
  canDelete,
}: {
  items: Item[];
  campuses: { id: string; name: string }[];
  canDelete: boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("thiet_bi");
  const [quantity, setQuantity] = useState("1");
  const [campusId, setCampusId] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const campusName = new Map(campuses.map((c) => [c.id, c.name]));

  function add() {
    start(async () => {
      setErr(null);
      setMsg(null);
      const r = await addEquipment({
        name,
        category,
        quantity: Number(quantity) || 1,
        condition: "tot",
        campusId: campusId || null,
        note,
      });
      if (r.error) setErr(r.error);
      else {
        setMsg("Đã thêm thiết bị.");
        setName("");
        setQuantity("1");
        setNote("");
      }
    });
  }

  return (
    <>
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="mb-3 text-sm font-semibold">Thêm thiết bị</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên thiết bị" className={inputCls} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {Object.entries(CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min={1} placeholder="SL" className={inputCls} />
          <select value={campusId} onChange={(e) => setCampusId(e.target.value)} className={inputCls}>
            <option value="">Toàn trường</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú" className={inputCls} />
        </div>
        <Button onClick={add} disabled={pending || !name.trim()} size="sm" className="mt-3">
          Thêm
        </Button>
        {err && <p className="mt-2 text-sm text-error">{err}</p>}
        {msg && <p className="mt-2 text-sm text-success">{msg}</p>}
      </div>

      <DataTable
        columns={["Thiết bị", "Loại", "SL", "Cơ sở", "Tình trạng", "Ghi chú", ""]}
        footer={<span>{items.length} danh mục</span>}
      >
        {items.map((i) => (
          <tr key={i.id}>
            <td className="font-medium">{i.name}</td>
            <td className="text-muted-foreground">{CATEGORIES[i.category] ?? i.category}</td>
            <td>{i.quantity}</td>
            <td className="text-muted-foreground">
              {i.campus_id ? (campusName.get(i.campus_id) ?? "-") : "Toàn trường"}
            </td>
            <td>
              <select
                value={i.condition}
                disabled={pending}
                onChange={(e) =>
                  start(async () => {
                    await updateEquipmentCondition(i.id, e.target.value);
                  })
                }
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none"
              >
                {Object.entries(CONDITIONS).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
            </td>
            <td className="max-w-40 text-xs text-muted-foreground">{i.note ?? "-"}</td>
            <td>
              {canDelete && (
                <button
                  type="button"
                  aria-label="Xoá"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await deleteEquipment(i.id);
                    })
                  }
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-error-bg hover:text-error"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={7} className="py-8 text-center text-muted-foreground">
              Chưa có thiết bị nào.
            </td>
          </tr>
        )}
      </DataTable>
    </>
  );
}

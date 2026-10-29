"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  addEquipment,
  addEquipmentIssue,
  updateEquipmentCondition,
  deleteEquipment,
  updateEquipmentIssue,
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

interface Issue {
  id: string;
  equipment_id: string;
  reported_date: string;
  kind: string;
  description: string;
  status: string;
  resolution_note: string | null;
}

const ISSUE_KIND: Record<string, string> = {
  hong: "Hỏng",
  sua_chua: "Sửa chữa",
  bao_tri: "Bảo trì",
  thay_the: "Thay thế",
  khac: "Khác",
};
const ISSUE_STATUS: Record<string, string> = {
  open: "Mở",
  in_progress: "Đang xử lý",
  resolved: "Đã xong",
  cancelled: "Hủy",
};

export function EquipmentBoard({
  items,
  campuses,
  canDelete,
  issues = [],
  canIssues = false,
}: {
  items: Item[];
  campuses: { id: string; name: string }[];
  canDelete: boolean;
  issues?: Issue[];
  canIssues?: boolean;
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
                    const r = await updateEquipmentCondition(
                      i.id,
                      e.target.value,
                    );
                    // r23 L: hien loi thay vi nuot - select gia gia tri moi
                    // du UPDATE that bai (refresh se tu dong lai).
                    if (r?.error) setErr(r.error);
                    else setErr(null);
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
                      const r = await deleteEquipment(i.id);
                      if (r?.error) setErr(r.error);
                      else setErr(null);
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

      {canIssues && (
        <EquipmentIssuesSection issues={issues} items={items} pending={pending} setErr={setErr} />
      )}
    </>
  );
}

function EquipmentIssuesSection({
  issues,
  items,
  pending,
  setErr,
}: {
  issues: Issue[];
  items: Item[];
  pending: boolean;
  setErr: (e: string | null) => void;
}) {
  const [, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [eqId, setEqId] = useState("");
  const [kind, setKind] = useState("hong");
  const [desc, setDesc] = useState("");
  const eqName = new Map(items.map((i) => [i.id, i.name]));

  function add() {
    if (!eqId || !desc.trim()) return;
    start(async () => {
      const r = await addEquipmentIssue({ equipmentId: eqId, kind, description: desc });
      if (r?.error) setErr(r.error);
      else { setShowAdd(false); setDesc(""); setEqId(""); }
    });
  }
  function setStatus(id: string, status: string) {
    start(async () => {
      const r = await updateEquipmentIssue(id, { status });
      if (r?.error) setErr(r.error);
    });
  }

  const open = issues.filter((i) => i.status !== "resolved" && i.status !== "cancelled");
  const closed = issues.filter((i) => i.status === "resolved" || i.status === "cancelled");

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Sự cố & bảo trì ({open.length} mở)</h2>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Đóng" : "+ Báo sự cố"}
        </Button>
      </div>
      {showAdd && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex flex-wrap gap-3">
            <select value={eqId} onChange={(e) => setEqId(e.target.value)} className={inputCls + " w-56"}>
              <option value="">- Chọn thiết bị -</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls + " w-40"}>
              {Object.entries(ISSUE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <input value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Mô tả sự cố *" className={inputCls} />
          <Button size="sm" onClick={add} disabled={pending || !eqId || !desc.trim()}>Ghi nhận</Button>
        </div>
      )}
      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có sự cố / bảo trì nào.</p>
      ) : (
        <div className="space-y-2">
          {[...open, ...closed].map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
              <span className="text-muted-foreground whitespace-nowrap">{i.reported_date}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{ISSUE_KIND[i.kind] ?? i.kind}</span>
              <span className="font-medium">{eqName.get(i.equipment_id) ?? "?"}</span>
              <span className="flex-1 min-w-40">{i.description}</span>
              <select value={i.status} onChange={(e) => setStatus(i.id, e.target.value)}
                disabled={pending}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs">
                {Object.entries(ISSUE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

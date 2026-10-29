"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { saveMealCount, saveMenu } from "@/app/(app)/meals/actions";
import { formatMoney } from "@/lib/utils";

interface Menu {
  id: string; menu_date: string; meal_type: string; description: string;
  allergen_notes: string | null; supplier: string | null; cost_per_portion: number | null;
}
interface Cls { id: string; name: string; gvcn_id: string | null }
interface Count {
  id: string; class_id: string; menu_date: string; meal_type: string;
  planned_count: number; actual_count: number | null; note: string | null;
}
interface Reg { student_id: string; meal_type: string; students: { class_id: string } | { class_id: string }[] | null }

const MEAL_LABEL: Record<string, string> = { sang: "Sáng", trua: "Trưa", xe: "Xế" };
const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function MealsBoard({
  date, menus, classes, counts, registrations,
  canWrite, canMenu, myClassId,
}: {
  date: string;
  menus: Menu[];
  classes: Cls[];
  counts: Count[];
  registrations: Reg[];
  canWrite: boolean;
  canMenu: boolean;
  myClassId: string | null;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showMenu, setShowMenu] = useState(false);
  const [menuDate, setMenuDate] = useState(date);
  const [mealType, setMealType] = useState("trua");
  const [desc, setDesc] = useState("");
  const [allergens, setAllergens] = useState("");
  const [countsDraft, setCountsDraft] = useState<Record<string, string>>({});

  const menusByDate = menus.reduce<Record<string, Menu[]>>((acc, m) => {
    (acc[m.menu_date] ??= []).push(m);
    return acc;
  }, {});
  const dates = [...new Set(menus.map((m) => m.menu_date))].sort();
  const weekday = (d: string) => WD[new Date(d + "T00:00:00Z").getUTCDay()];
  const countFor = (cid: string, mt: string) =>
    counts.find((c) => c.class_id === cid && c.meal_type === mt);
  // planned basis: dang ky ban tru thang nay theo lop.
  const regCount = (cid: string, mt: string) =>
    registrations.filter((r) => {
      const st = Array.isArray(r.students) ? r.students[0] : r.students;
      return r.meal_type === mt && st?.class_id === cid;
    }).length;

  function addMenu(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await saveMenu({
        menuDate, mealType, description: desc, allergenNotes: allergens,
      });
      if (r?.error) setErr(r.error);
      else { setShowMenu(false); setDesc(""); setAllergens(""); }
    });
  }
  function saveCount(cid: string, mt: string) {
    const k = `${cid}:${mt}`;
    const v = countsDraft[k];
    if (v == null) return;
    const existing = countFor(cid, mt);
    setErr(null);
    start(async () => {
      const r = await saveMealCount({
        classId: cid, menuDate: date, mealType: mt,
        plannedCount: existing?.planned_count ?? regCount(cid, mt),
        actualCount: v === "" ? undefined : Number(v),
      });
      if (r?.error) setErr(r.error);
      else setCountsDraft((d) => { const n = { ...d }; delete n[k]; return n; });
    });
  }

  const editableClasses = myClassId ? classes.filter((c) => c.id === myClassId) : classes;

  return (
    <div className="space-y-6">
      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium">Thực đơn tuần từ {date}</p>
          {canMenu && (
            <Button size="sm" variant="outline" onClick={() => setShowMenu(!showMenu)}>
              {showMenu ? "Đóng" : "+ Thực đơn"}
            </Button>
          )}
        </div>
        {showMenu && (
          <form onSubmit={addMenu} className="mb-4 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex flex-wrap gap-3">
              <input type="date" value={menuDate} onChange={(e) => setMenuDate(e.target.value)} required
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <select value={mealType} onChange={(e) => setMealType(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {Object.entries(MEAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <AutoGrowTextarea value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Mô tả thực đơn *" rows={1} required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <AutoGrowTextarea value={allergens} onChange={(e) => setAllergens(e.target.value)}
              placeholder="Lưu ý dị ứng (đậu phộng, gluten, sữa...)" rows={1}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <Button type="submit" size="sm" disabled={pending || !desc.trim()}>Lưu</Button>
          </form>
        )}
        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có thực đơn nào cho tuần này.</p>
        ) : (
          <div className="space-y-3">
            {dates.map((d) => (
              <div key={d}>
                <p className="text-sm font-medium text-muted-foreground">{weekday(d)} - {d}</p>
                <div className="mt-1 space-y-1">
                  {menusByDate[d].map((m) => (
                    <div key={m.id} className="flex flex-wrap items-baseline gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{MEAL_LABEL[m.meal_type]}</span>
                      <span className="flex-1 min-w-40">{m.description}</span>
                      {m.allergen_notes && (
                        <span className="text-xs text-amber-700 dark:text-amber-400">⚠ {m.allergen_notes}</span>
                      )}
                      {m.cost_per_portion != null && (
                        <span className="text-xs text-muted-foreground tabular-nums">{formatMoney(m.cost_per_portion)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-medium mb-3">Số suất ăn {date} (bữa trưa)</p>
        <div className="overflow-x-auto relative">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Lớp</th>
                <th className="py-2 pr-3 font-medium">Đăng ký</th>
                <th className="py-2 pr-3 font-medium">Dự kiến</th>
                <th className="py-2 pr-3 font-medium">Thực tế</th>
                {canWrite && <th className="py-2 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {editableClasses.map((c) => {
                const cnt = countFor(c.id, "trua");
                const k = `${c.id}:trua`;
                const draft = countsDraft[k];
                return (
                  <tr key={c.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3 font-medium">{c.name}</td>
                    <td className="py-2 pr-3 tabular-nums">{regCount(c.id, "trua")}</td>
                    <td className="py-2 pr-3 tabular-nums">{cnt?.planned_count ?? "-"}</td>
                    <td className="py-2 pr-3">
                      {canWrite ? (
                        <input
                          inputMode="numeric"
                          value={draft ?? (cnt?.actual_count != null ? String(cnt.actual_count) : "")}
                          onChange={(e) => setCountsDraft((d) => ({ ...d, [k]: e.target.value }))}
                          className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums"
                          placeholder="-"
                        />
                      ) : (
                        <span className="tabular-nums">{cnt?.actual_count ?? "-"}</span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="py-2 text-right">
                        {draft != null && (
                          <Button size="sm" variant="outline" onClick={() => saveCount(c.id, "trua")} disabled={pending}>
                            Lưu
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Đăng ký = số HS đăng ký bán trú tháng này; Dự kiến = suất báo bếp;
          Thực tế = HS có mặt ăn thực tế.
        </p>
      </div>
    </div>
  );
}

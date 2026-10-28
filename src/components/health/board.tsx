"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClassChips } from "@/components/class-chips";
import { StatusBadge } from "@/components/status-badge";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { sortByVietnameseName } from "@/lib/utils";
import { recordHealth, upsertBhyt } from "@/app/(app)/school/health/actions";

type Cls = { id: string; name: string; grade: number };
type Student = { id: string; full_name: string; code: string | null; dob: string | null; gender: string | null };
type Health = {
  id: string; student_id: string; checked_at: string;
  height_cm: number | null; weight_kg: number | null;
  vision_left: string | null; vision_right: string | null;
  dental: string | null; conclusion: string | null;
};
type Bhyt = {
  student_id: string; card_no: string | null; kcbb_code: string | null;
  valid_from: string | null; valid_to: string | null; status: string;
};

const BHYT_STATUS = {
  active: { label: "Còn hạn", tone: "success" as const },
  expired: { label: "Hết hạn", tone: "warning" as const },
  missing: { label: "Chưa có thẻ", tone: "muted" as const },
};

const input = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm w-full";

export default function HealthBoard({
  classes,
  currentClassId,
  students,
  health,
  bhyt,
  canWrite,
}: {
  classes: Cls[];
  currentClassId: string | null;
  students: Student[];
  health: Health[];
  bhyt: Bhyt[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [healthForm, setHealthForm] = useState<Record<string, string> | null>(null);
  const [bhytForm, setBhytForm] = useState<Record<string, string> | null>(null);

  const sorted = sortByVietnameseName(students, (s) => s.full_name);
  const latestOf = (sid: string) => health.find((h) => h.student_id === sid);
  const bhytOf = (sid: string) => bhyt.find((b) => b.student_id === sid);

  const act = (fn: () => Promise<string | null>, msg: string) => {
    setErr(null); setOkMsg(null);
    start(async () => {
      const res = await fn();
      if (res) setErr(res);
      else { setOkMsg(msg); setHealthForm(null); setBhytForm(null); router.refresh(); }
    });
  };

  const setH = (k: string, v: string) => setHealthForm((f) => f && { ...f, [k]: v });
  const setB = (k: string, v: string) => setBhytForm((f) => f && { ...f, [k]: v });

  // Inline validation (constraint DB: height 30-250, weight 2-300, from<=to).
  const numErr = (v: string, min: number, max: number) =>
    v.trim() === "" ? null : (!Number.isFinite(Number(v)) || Number(v) < min || Number(v) > max
      ? `không hợp lệ (${min}-${max})` : null);
  const hHeightErr = healthForm ? numErr(healthForm.height, 30, 250) : null;
  const hWeightErr = healthForm ? numErr(healthForm.weight, 2, 300) : null;
  const bhytDateErr = bhytForm && bhytForm.from && bhytForm.to && bhytForm.to < bhytForm.from
    ? "Hạn đến phải sau hạn từ." : null;

  return (
    <div className="space-y-4">
      <ClassChips
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        selectedId={currentClassId ?? ""}
        href="/school/health"
      />
      {err && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{err}</p>
      )}
      {okMsg && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">{okMsg}</p>
      )}

      <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Học sinh</th>
              <th className="px-3 py-3 font-medium">Khám gần nhất</th>
              <th className="px-3 py-3 font-medium">Thể chất</th>
              <th className="px-3 py-3 font-medium">Kết luận</th>
              <th className="px-3 py-3 font-medium">Thẻ BHYT</th>
              <th className="px-3 py-3 font-medium">Hạn thẻ</th>
              {canWrite && <th className="px-3 py-3 font-medium">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={canWrite ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">Chưa có học sinh nào trong lớp.</td></tr>
            )}
            {sorted.map((s) => {
              const h = latestOf(s.id);
              const b = bhytOf(s.id);
              const expired = b?.valid_to && b.valid_to < new Date().toISOString().slice(0, 10);
              const tone = b ? (expired || b.status === "expired" ? "expired" : b.status === "missing" ? "missing" : "active") : "missing";
              return (
                <tr key={s.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground">{s.code ?? ""}</div>
                  </td>
                  <td className="px-3 py-3 text-xs">{h?.checked_at ?? "-"}</td>
                  <td className="px-3 py-3 text-xs">
                    {h ? `${h.height_cm ?? "-"}cm / ${h.weight_kg ?? "-"}kg` : "-"}
                    {h && (h.vision_left || h.vision_right) && (
                      <div className="text-muted-foreground">MT: {h.vision_left ?? "-"} / MP: {h.vision_right ?? "-"}</div>
                    )}
                  </td>
                  <td className="max-w-40 truncate px-3 py-3 text-xs" title={h?.conclusion ?? ""}>
                    {h?.conclusion ?? "-"}
                  </td>
                  <td className="px-3 py-3">
                    {b?.card_no ? (
                      <div className="text-xs font-medium">{b.card_no}</div>
                    ) : "-"}
                    <StatusBadge label={BHYT_STATUS[tone].label} tone={BHYT_STATUS[tone].tone} />
                  </td>
                  <td className="px-3 py-3 text-xs">{b?.valid_to ?? "-"}</td>
                  {canWrite && (
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button type="button" disabled={pending}
                          onClick={() => { setErr(null); setHealthForm({ studentId: s.id, checkedAt: "", height: "", weight: "", vleft: "", vright: "", dental: "", conclusion: "", note: "" }); }}
                          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">Ghi khám</button>
                        <button type="button" disabled={pending}
                          onClick={() => { setErr(null); setBhytForm({ studentId: s.id, cardNo: b?.card_no ?? "", kcbb: b?.kcbb_code ?? "", from: b?.valid_from ?? "", to: b?.valid_to ?? "", status: b?.status ?? "active", note: "" }); }}
                          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">BHYT</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {healthForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Ghi khám sức khỏe - {sorted.find((s) => s.id === healthForm.studentId)?.full_name}</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs text-muted-foreground">Ngày khám
              <input type="date" value={healthForm.checkedAt} onChange={(e) => setH("checkedAt", e.target.value)} className={input} /></label>
            <label className="text-xs text-muted-foreground">Chiều cao (cm)
              <input inputMode="decimal" value={healthForm.height} onChange={(e) => setH("height", e.target.value)} className={input} placeholder="145" />
              {hHeightErr && <span className="text-xs text-destructive">Chiều cao {hHeightErr}</span>}</label>
            <label className="text-xs text-muted-foreground">Cân nặng (kg)
              <input inputMode="decimal" value={healthForm.weight} onChange={(e) => setH("weight", e.target.value)} className={input} placeholder="40" />
              {hWeightErr && <span className="text-xs text-destructive">Cân nặng {hWeightErr}</span>}</label>
            <label className="text-xs text-muted-foreground">Răng
              <input value={healthForm.dental} onChange={(e) => setH("dental", e.target.value)} className={input} placeholder="Tốt / Sâu 2 răng" /></label>
            <label className="text-xs text-muted-foreground">Thị lực trái
              <input value={healthForm.vleft} onChange={(e) => setH("vleft", e.target.value)} className={input} placeholder="10/10" /></label>
            <label className="text-xs text-muted-foreground">Thị lực phải
              <input value={healthForm.vright} onChange={(e) => setH("vright", e.target.value)} className={input} placeholder="10/10" /></label>
          </div>
          <label className="block text-xs text-muted-foreground">Kết luận
            <AutoGrowTextarea value={healthForm.conclusion} onChange={(e) => setH("conclusion", e.target.value)} placeholder="Khỏe / Theo dõi / Cần khám chuyên khoa" /></label>
          <label className="block text-xs text-muted-foreground">Ghi chú
            <AutoGrowTextarea value={healthForm.note} onChange={(e) => setH("note", e.target.value)} /></label>
          <div className="flex gap-2">
            <button type="button" disabled={pending || !!hHeightErr || !!hWeightErr}
              onClick={() => act(() => recordHealth({
                studentId: healthForm.studentId, checkedAt: healthForm.checkedAt,
                height: healthForm.height, weight: healthForm.weight,
                vleft: healthForm.vleft, vright: healthForm.vright,
                dental: healthForm.dental, conclusion: healthForm.conclusion, note: healthForm.note,
              }), "Đã ghi kết quả khám.")}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40">Lưu khám</button>
            <button type="button" disabled={pending} onClick={() => setHealthForm(null)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm">Đóng</button>
          </div>
        </div>
      )}

      {bhytForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Thẻ BHYT - {sorted.find((s) => s.id === bhytForm.studentId)?.full_name}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">Mã thẻ BHYT
              <input value={bhytForm.cardNo} onChange={(e) => setB("cardNo", e.target.value)} className={input} placeholder="XX-1-XX-XXXXXXX" /></label>
            <label className="text-xs text-muted-foreground">Nơi ĐK KCB ban đầu
              <input value={bhytForm.kcbb} onChange={(e) => setB("kcbb", e.target.value)} className={input} placeholder="BVĐK huyện..." /></label>
            <label className="text-xs text-muted-foreground">Trạng thái
              <select value={bhytForm.status} onChange={(e) => setB("status", e.target.value)} className={input}>
                <option value="active">Còn hạn</option>
                <option value="expired">Hết hạn</option>
                <option value="missing">Chưa có thẻ</option>
              </select></label>
            <label className="text-xs text-muted-foreground">Hiệu lực từ
              <input type="date" value={bhytForm.from} onChange={(e) => setB("from", e.target.value)} className={input} /></label>
            <label className="text-xs text-muted-foreground">Hiệu lực đến
              <input type="date" value={bhytForm.to} onChange={(e) => setB("to", e.target.value)} className={input} />
              {bhytDateErr && <span className="text-xs text-destructive">{bhytDateErr}</span>}</label>
          </div>
          <label className="block text-xs text-muted-foreground">Ghi chú
            <AutoGrowTextarea value={bhytForm.note} onChange={(e) => setB("note", e.target.value)} /></label>
          <div className="flex gap-2">
            <button type="button" disabled={pending || !bhytForm.status || !!bhytDateErr}
              onClick={() => act(() => upsertBhyt({
                studentId: bhytForm.studentId, cardNo: bhytForm.cardNo, kcbb: bhytForm.kcbb,
                from: bhytForm.from, to: bhytForm.to, status: bhytForm.status, note: bhytForm.note,
              }), "Đã lưu thẻ BHYT.")}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40">Lưu thẻ</button>
            <button type="button" disabled={pending} onClick={() => setBhytForm(null)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm">Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}

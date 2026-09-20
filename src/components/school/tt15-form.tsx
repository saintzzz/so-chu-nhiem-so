"use client";

import { useState, useTransition } from "react";
import { saveTt15Evaluation } from "@/app/(app)/school/actions";

/** 5 nhóm tiêu chuẩn kiểm định chất lượng (rút gọn từ TT15) */
const CRITERIA: { key: string; label: string; max: number }[] = [
  { key: "to_chuc", label: "Tổ chức và quản lý nhà trường", max: 25 },
  { key: "doi_ngu", label: "Đội ngũ nhà giáo, giáo viên, nhân viên", max: 20 },
  { key: "csvc", label: "Cơ sở vật chất, tài chính", max: 15 },
  { key: "hoat_dong", label: "Hoạt động giáo dục và quản lý giáo dục", max: 25 },
  { key: "quan_he", label: "Quan hệ nhà trường - gia đình - xã hội", max: 15 },
];

export function Tt15Form({
  campuses,
}: {
  campuses: { id: string; name: string }[];
}) {
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [term, setTerm] = useState("HK1-2026");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const total = CRITERIA.reduce(
    (s, c) => s + (Number(scores[c.key]) || 0),
    0,
  );
  const rating =
    total >= 80
      ? "Mức 1"
      : total >= 65
        ? "Mức 2"
        : total >= 50
          ? "Mức 3"
          : "Chưa đạt";

  function save(submit: boolean) {
    start(async () => {
      setErr(null);
      setMsg(null);
      const bad = CRITERIA.find(
        (c) => (Number(scores[c.key]) || 0) > c.max,
      );
      if (bad) {
        setErr(`"${bad.label}" vượt mức tối đa ${bad.max} điểm.`);
        return;
      }
      const r = await saveTt15Evaluation({
        campusId,
        term,
        scores: Object.fromEntries(
          Object.entries(scores).map(([k, v]) => [k, Number(v) || 0]),
        ),
        submit,
      });
      if (r.error) setErr(r.error);
      else setMsg(submit ? "Đã nộp đánh giá." : "Đã lưu nháp.");
    });
  }

  return (
    <div className="max-w-2xl rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Cơ sở</span>
          <select
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Kỳ đánh giá</span>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
          />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {CRITERIA.map((c) => (
          <label key={c.key} className="flex items-center gap-3 text-sm">
            <span className="flex-1">
              {c.label}{" "}
              <span className="text-xs text-muted-foreground">
                (tối đa {c.max})
              </span>
            </span>
            <input
              type="number"
              min={0}
              max={c.max}
              value={scores[c.key] ?? ""}
              onChange={(e) =>
                setScores((s) => ({ ...s, [c.key]: e.target.value }))
              }
              className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            />
          </label>
        ))}
      </div>

      <p className="mt-3 border-t border-border pt-3 text-sm">
        Tổng: <span className="font-semibold">{total}/100</span> -{" "}
        <span className="font-semibold">{rating}</span>
      </p>

      {err && (
        <p className="mt-2 rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}
      {msg && (
        <p className="mt-2 rounded-lg border border-success/30 bg-success-bg px-3 py-2 text-sm text-success">
          {msg}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Lưu nháp
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={pending || !campusId}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Nộp đánh giá
        </button>
      </div>
    </div>
  );
}

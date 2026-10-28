"use client";

import { useState, useTransition } from "react";
import {
  openCampaign,
  setExamScore,
  setDecision,
  finalizeCampaign,
} from "@/app/(app)/school/graduation/actions";
import { fmtDateTimeVN, compareVietnameseName } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

export type CampaignRow = {
  id: string;
  level: string;
  name: string;
  pass_score: number;
  require_exam: boolean;
  status: string;
  created_at: string;
  finalized_at: string | null;
};
export type DecisionRow = {
  id: string;
  campaign_id: string;
  student_id: string;
  kqht: string | null;
  kqrl: string | null;
  exam_score: number | null;
  eligible: boolean;
  decision: string;
  note: string | null;
  students: { full_name: string; student_code: string; classes: { name: string } | null } | null;
};

const inputCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

const KQ_LABEL: Record<string, string> = {
  tot: "Tốt",
  kha: "Khá",
  dat: "Đạt",
  chua_dat: "Chưa đạt",
};
const DEC_TONE = {
  pending: { label: "Chờ xét", tone: "warning" as const },
  approved: { label: "Đạt TN", tone: "success" as const },
  rejected: { label: "Chưa đạt", tone: "error" as const },
};

export default function GraduationBoard({
  campaigns,
  decisions,
  canManage,
  loadError,
}: {
  campaigns: CampaignRow[];
  decisions: DecisionRow[];
  canManage: boolean;
  loadError: string | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(loadError);
  const [ok, setOk] = useState<string | null>(null);
  const [level, setLevel] = useState("thcs");
  const [name, setName] = useState("");
  const [passScore, setPassScore] = useState("5");
  const [requireExam, setRequireExam] = useState(true);
  const [campId, setCampId] = useState<string | null>(campaigns[0]?.id ?? null);

  const camp = campaigns.find((c) => c.id === campId) ?? campaigns[0] ?? null;
  const rows = decisions
    .filter((d) => d.campaign_id === camp?.id)
    .slice()
    .sort((a, b) =>
      compareVietnameseName(
        a.students?.full_name ?? "",
        b.students?.full_name ?? "",
      ),
    );
  const open = camp?.status === "open";

  function act(fn: () => Promise<string | null>, okMsg: string) {
    setErr(null);
    setOk(null);
    start(async () => {
      const res = await fn();
      if (res && !res.startsWith("Đã")) setErr(res);
      else setOk(res ?? okMsg);
    });
  }

  const stats = {
    total: rows.length,
    eligible: rows.filter((r) => r.eligible).length,
    approved: rows.filter((r) => r.decision === "approved").length,
    rejected: rows.filter((r) => r.decision === "rejected").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Xét tốt nghiệp</h1>
        <p className="text-sm text-muted-foreground">
          Đợt xét công nhận tốt nghiệp cuối cấp (khối 9 / khối 12) - đối chiếu
          KQHT + KQRL cả năm và điểm xét tốt nghiệp.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Học sinh trong đợt", stats.total],
          ["Đủ điều kiện", stats.eligible],
          ["Đạt tốt nghiệp", stats.approved],
          ["Chưa đạt", stats.rejected],
        ].map(([l, n]) => (
          <div key={l} className="rounded-xl border border-border bg-card p-3">
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-medium">Mở đợt xét mới</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-2">
              {[
                ["thcs", "THCS - khối 9"],
                ["thpt", "THPT - khối 12"],
              ].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setLevel(v)}
                  className={`rounded-lg border px-3 py-2 text-sm ${level === v ? "border-primary bg-primary/10 font-medium" : "border-border"}`}>
                  {l}
                </button>
              ))}
            </div>
            <input className={inputCls} placeholder="Tên đợt xét * (vd Xét TN THCS 2026-2027)"
              value={name} onChange={(e) => setName(e.target.value)} />
            <input className={inputCls} placeholder="Điểm xét TN tối thiểu (0-10)"
              value={passScore} onChange={(e) => setPassScore(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requireExam}
                onChange={(e) => setRequireExam(e.target.checked)} />
              Bắt buộc điểm xét tốt nghiệp
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" disabled={pending || name.trim() === ""}
              onClick={() =>
                act(() => openCampaign({
                  level, name,
                  passScore: passScore.trim() === "" ? undefined : Number(passScore),
                  requireExam,
                }), "Đã mở đợt xét.")
              }
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {pending ? "Đang xử lý..." : "Mở đợt xét"}
            </button>
            {err && <span className="text-sm text-destructive">{err}</span>}
            {ok && <span className="text-sm text-green-600">{ok}</span>}
          </div>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {campaigns.map((c) => (
            <button key={c.id} type="button" onClick={() => setCampId(c.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${camp?.id === c.id ? "border-primary bg-primary/10 font-medium" : "border-border"}`}>
              {c.name} {c.status === "finalized" ? "(đã chốt)" : ""}
            </button>
          ))}
        </div>
      )}

      {camp && (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">Học sinh</th>
                <th className="p-3">Lớp</th>
                <th className="p-3">KQHT cả năm</th>
                <th className="p-3">KQRL cả năm</th>
                <th className="p-3">Điểm xét TN</th>
                <th className="p-3">Điều kiện</th>
                <th className="p-3">Quyết định</th>
                {open && canManage && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Đợt xét chưa có học sinh.
                </td></tr>
              )}
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{d.students?.full_name ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">{d.students?.student_code}</div>
                  </td>
                  <td className="p-3">{d.students?.classes?.name ?? "-"}</td>
                  <td className="p-3">{d.kqht ? KQ_LABEL[d.kqht] : "-"}</td>
                  <td className="p-3">{d.kqrl ? KQ_LABEL[d.kqrl] : "-"}</td>
                  <td className="p-3">
                    {open ? (
                      <input
                        className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                        defaultValue={d.exam_score ?? ""}
                        placeholder="-"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const score = v === "" ? null : Number(v);
                          if (score !== d.exam_score) {
                            act(() => setExamScore(d.id, score), "Đã lưu điểm.");
                          }
                        }}
                      />
                    ) : (
                      d.exam_score ?? "-"
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge label={d.eligible ? "Đủ ĐK" : "Thiếu ĐK"} tone={d.eligible ? "success" : "muted"} />
                  </td>
                  <td className="p-3">
                    <StatusBadge
                      label={(DEC_TONE[d.decision as keyof typeof DEC_TONE] ?? DEC_TONE.pending).label}
                      tone={(DEC_TONE[d.decision as keyof typeof DEC_TONE] ?? DEC_TONE.pending).tone}
                    />
                    {d.note && <div className="text-xs text-muted-foreground">{d.note}</div>}
                  </td>
                  {open && canManage && (
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button type="button" disabled={pending}
                          onClick={() => act(() => setDecision(d.id, "approved"), "Đã duyệt.")}
                          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">
                          Đạt
                        </button>
                        <button type="button" disabled={pending}
                          onClick={() => act(() => setDecision(d.id, "rejected"), "Đã ghi chưa đạt.")}
                          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">
                          Chưa đạt
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {camp && open && canManage && (
        <button type="button" disabled={pending}
          onClick={() => {
            if (window.confirm(`Chốt đợt "${camp.name}"? Học sinh đủ điều kiện sẽ được công nhận tốt nghiệp và chuyển trạng thái graduated.`)) {
              act(() => finalizeCampaign(camp.id), "Đã chốt đợt xét.");
            }
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Chốt đợt xét và công nhận tốt nghiệp
        </button>
      )}

      {camp && (
        <p className="text-xs text-muted-foreground">
          Đợt: {camp.name} - cấp {camp.level === "thcs" ? "THCS (khối 9)" : "THPT (khối 12)"},
          điểm xét tối thiểu {camp.pass_score}
          {camp.require_exam ? ", bắt buộc điểm xét TN" : ", không bắt buộc điểm"}.
          {camp.finalized_at ? ` Đã chốt lúc ${fmtDateTimeVN(camp.finalized_at)}.` : ""}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateExport,
  signExport,
  downloadExport,
} from "@/app/(app)/records/exports/actions";
import { compareVietnameseName } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

type Cls = { id: string; name: string; grade: number };
type Stu = { id: string; full_name: string; code: string | null };
type Exp = { id: string; student_id: string; status: string; gvcn_at: string | null; bgh_at: string | null };

const STATUS = {
  none: { label: "Chưa tạo", tone: "muted" as const },
  generated: { label: "Đã tạo XML", tone: "info" as const },
  gvcn_signed: { label: "GVCN đã ký", tone: "warning" as const },
  bgh_signed: { label: "Đã ký đủ 2 cấp", tone: "success" as const },
};

export default function ExportsBoard({
  classes,
  currentClassId,
  students,
  exports,
  yearId,
  isAdmin,
}: {
  classes: Cls[];
  currentClassId: string | null;
  students: Stu[];
  exports: Exp[];
  yearId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const expMap = new Map(exports.map((e) => [e.student_id, e]));
  const rows = students.slice().sort((a, b) => compareVietnameseName(a.full_name, b.full_name));

  function act(fn: () => Promise<string | null>, okMsg: string) {
    setErr(null);
    setOk(null);
    start(async () => {
      const res = await fn();
      if (res) setErr(res);
      else setOk(okMsg);
    });
  }

  async function download(exportId: string) {
    setErr(null);
    start(async () => {
      const res = await downloadExport(exportId);
      if ("error" in res) { setErr(res.error); return; }
      const blob = new Blob([res.xml], { type: "application/xml" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(a.href);
      const v = res.verify;
      setOk(v.shaOk && v.gvcnOk && v.bghOk
        ? "Đã tải - chữ ký hợp lệ."
        : "Đã tải - CẢNH BÁO: chữ ký/checksum không khớp.");
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Học bạ XML &amp; ký số</h1>
        <p className="text-sm text-muted-foreground">
          Xuất học bạ ra XML (SCN-QD3016-v1) và ký số 2 cấp: GVCN ký trước,
          BGH ký sau. Chữ ký chống giả mạo bằng checksum + HMAC hệ thống.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <button key={c.id} type="button"
            onClick={() => router.push(`/records/exports?class=${c.id}`)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${c.id === currentClassId ? "border-primary bg-primary/10 font-medium" : "border-border"}`}>
            {c.name}
          </button>
        ))}
        {classes.length === 0 && (
          <p className="text-sm text-muted-foreground">Không có lớp chủ nhiệm nào.</p>
        )}
      </div>

      {(err || ok) && (
        <p className={`text-sm ${err ? "text-destructive" : "text-green-600"}`}>{err ?? ok}</p>
      )}

      {currentClassId && (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">Học sinh</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Ký GVCN</th>
                <th className="p-3">Ký BGH</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Lớp chưa có học sinh.
                </td></tr>
              )}
              {rows.map((s) => {
                const e = expMap.get(s.id);
                const st = (e?.status ?? "none") as keyof typeof STATUS;
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{s.full_name}</div>
                      <div className="text-xs text-muted-foreground">{s.code}</div>
                    </td>
                    <td className="p-3">
                      <StatusBadge label={STATUS[st].label} tone={STATUS[st].tone} />
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {e?.gvcn_at ? "Đã ký" : "-"}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {e?.bgh_at ? "Đã ký" : "-"}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {(!e || e.status !== "bgh_signed") && yearId && (
                          <button type="button" disabled={pending}
                            onClick={() => act(() => generateExport(s.id, yearId), "Đã tạo XML.")}
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">
                            {e ? "Tạo lại" : "Tạo XML"}
                          </button>
                        )}
                        {e && e.status !== "bgh_signed" && (
                          <button type="button" disabled={pending}
                            onClick={() => act(() => signExport(e.id), "Đã ký.")}
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">
                            {e.status === "generated" ? "Ký GVCN" : "Ký BGH"}
                          </button>
                        )}
                        {e && (
                          <button type="button" disabled={pending}
                            onClick={() => download(e.id)}
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">
                            Tải XML
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && (
        <p className="text-xs text-muted-foreground">
          BGH chỉ ký được sau khi GVCN đã ký. Bản đã ký đủ 2 cấp không thể tạo lại.
        </p>
      )}
    </div>
  );
}

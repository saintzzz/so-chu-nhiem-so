"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { sortByVietnameseName, formatDateOnly } from "@/lib/utils";
import { createDocument, updateDocument } from "@/app/(app)/school/documents/actions";

type Doc = {
  id: string; direction: string; doc_no: string; doc_type: string;
  issued_date: string; from_org: string; to_org: string | null;
  subject: string; note: string | null; status: string;
  deadline: string | null; handler_id: string | null;
};
type Staff = { id: string; full_name: string | null };

const TYPES: Record<string, string> = {
  cong_van: "Công văn", quyet_dinh: "Quyết định",
  bao_cao: "Báo cáo", to_trinh: "Tờ trình", khac: "Khác",
};
const STATUS: Record<string, { label: string; tone: "muted" | "warning" | "success" | "info" }> = {
  registered: { label: "Đã đăng ký", tone: "info" },
  processing: { label: "Đang xử lý", tone: "warning" },
  done: { label: "Đã xong", tone: "success" },
  archived: { label: "Lưu trữ", tone: "muted" },
};

const input = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm w-full";

export default function DocumentsBoard({
  direction,
  docs,
  staff,
  canWrite,
}: {
  direction: string;
  docs: Doc[];
  staff: Staff[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<Record<string, string> | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string> | null>(null);

  const staffSorted = sortByVietnameseName(staff, (s) => s.full_name ?? "");
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? "-";
  const today = new Date().toISOString().slice(0, 10);

  const act = (fn: () => Promise<string | null>, msg: string) => {
    setErr(null); setOkMsg(null);
    start(async () => {
      const res = await fn();
      if (res) setErr(res);
      else { setOkMsg(msg); setCreateForm(null); setEditForm(null); router.refresh(); }
    });
  };

  const setC = (k: string, v: string) => setCreateForm((f) => f && { ...f, [k]: v });
  const setE = (k: string, v: string) => setEditForm((f) => f && { ...f, [k]: v });

  const createOk = createForm && createForm.docNo.trim() && createForm.issued &&
    createForm.from.trim() && createForm.subject.trim() &&
    !(createForm.deadline && createForm.deadline < createForm.issued);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/school/documents?dir=den"
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${direction === "den" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"}`}>
          Công văn đến
        </Link>
        <Link href="/school/documents?dir=di"
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${direction === "di" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"}`}>
          Công văn đi
        </Link>
        {canWrite && (
          <button type="button" disabled={pending}
            onClick={() => { setErr(null); setCreateForm({ docNo: "", docType: "cong_van", issued: "", from: "", to: "", subject: "", note: "", handlerId: "", deadline: "" }); }}
            className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40">
            + Đăng ký {direction === "den" ? "đến" : "đi"}
          </button>
        )}
      </div>

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
              <th className="px-4 py-3 font-medium">Số hiệu</th>
              <th className="px-3 py-3 font-medium">Loại</th>
              <th className="px-3 py-3 font-medium">Ngày</th>
              <th className="px-3 py-3 font-medium">{direction === "den" ? "Nơi gửi" : "Nơi nhận"}</th>
              <th className="px-3 py-3 font-medium">Trích yếu</th>
              <th className="px-3 py-3 font-medium">Xử lý</th>
              <th className="px-3 py-3 font-medium">Hạn</th>
              <th className="px-3 py-3 font-medium">Trạng thái</th>
              {canWrite && <th className="px-3 py-3 font-medium">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr><td colSpan={canWrite ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground">
                Chưa có công văn {direction === "den" ? "đến" : "đi"} nào.
              </td></tr>
            )}
            {docs.map((d) => {
              const overdue = d.deadline && d.deadline < today && d.status !== "done" && d.status !== "archived";
              return (
                <tr key={d.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3 font-medium">{d.doc_no}</td>
                  <td className="px-3 py-3 text-xs">{TYPES[d.doc_type] ?? d.doc_type}</td>
                  <td className="px-3 py-3 text-xs">{formatDateOnly(d.issued_date)}</td>
                  <td className="max-w-44 truncate px-3 py-3 text-xs" title={direction === "den" ? d.from_org : (d.to_org ?? "")}>
                    {direction === "den" ? d.from_org : d.to_org}
                  </td>
                  <td className="max-w-52 truncate px-3 py-3 text-xs" title={d.subject}>{d.subject}</td>
                  <td className="px-3 py-3 text-xs">{staffName(d.handler_id)}</td>
                  <td className={`px-3 py-3 text-xs ${overdue ? "font-medium text-destructive" : ""}`}>
                    {d.deadline ? formatDateOnly(d.deadline) : "-"}
                  </td>
                  <td className="px-3 py-3"><StatusBadge label={STATUS[d.status]?.label ?? d.status} tone={STATUS[d.status]?.tone ?? "muted"} /></td>
                  {canWrite && (
                    <td className="px-3 py-3">
                      <button type="button" disabled={pending}
                        onClick={() => { setErr(null); setEditForm({ id: d.id, status: d.status, handlerId: d.handler_id ?? "", note: "" }); }}
                        className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">Cập nhật</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {createForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">
            Đăng ký công văn {direction === "den" ? "đến" : "đi"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs text-muted-foreground">Số hiệu *
              <input value={createForm.docNo} onChange={(e) => setC("docNo", e.target.value)} className={input} placeholder="123/CV-..." /></label>
            <label className="text-xs text-muted-foreground">Loại
              <select value={createForm.docType} onChange={(e) => setC("docType", e.target.value)} className={input}>
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="text-xs text-muted-foreground">Ngày ban hành *
              <input type="date" value={createForm.issued} onChange={(e) => setC("issued", e.target.value)} className={input} /></label>
            <label className="text-xs text-muted-foreground">{direction === "den" ? "Nơi gửi *" : "Nơi nhận *"}
              <input value={createForm.from} onChange={(e) => setC("from", e.target.value)} className={input}
                placeholder={direction === "den" ? "Sở GD&ĐT..." : "Phòng GD&ĐT..."} /></label>
            <label className="text-xs text-muted-foreground">Người xử lý
              <select value={createForm.handlerId} onChange={(e) => setC("handlerId", e.target.value)} className={input}>
                <option value="">-</option>
                {staffSorted.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select></label>
            <label className="text-xs text-muted-foreground">Hạn xử lý
              <input type="date" value={createForm.deadline} onChange={(e) => setC("deadline", e.target.value)} className={input} />
              {createForm.deadline && createForm.deadline < createForm.issued && (
                <span className="text-xs text-destructive">Hạn phải sau ngày ban hành.</span>
              )}</label>
          </div>
          <label className="block text-xs text-muted-foreground">Trích yếu *
            <AutoGrowTextarea value={createForm.subject} onChange={(e) => setC("subject", e.target.value)} placeholder="V/v ..." /></label>
          <label className="block text-xs text-muted-foreground">Ghi chú
            <AutoGrowTextarea value={createForm.note} onChange={(e) => setC("note", e.target.value)} /></label>
          <div className="flex gap-2">
            <button type="button" disabled={pending || !createOk}
              onClick={() => act(() => createDocument({
                direction, docNo: createForm.docNo, docType: createForm.docType,
                issued: createForm.issued, from: createForm.from, to: createForm.to,
                subject: createForm.subject, note: createForm.note,
                handlerId: createForm.handlerId, deadline: createForm.deadline,
              }), "Đã đăng ký công văn.")}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40">Đăng ký</button>
            <button type="button" disabled={pending} onClick={() => setCreateForm(null)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm">Đóng</button>
          </div>
        </div>
      )}

      {editForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">
            Cập nhật - {docs.find((d) => d.id === editForm.id)?.doc_no}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">Trạng thái
              <select value={editForm.status} onChange={(e) => setE("status", e.target.value)} className={input}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></label>
            <label className="text-xs text-muted-foreground">Người xử lý
              <select value={editForm.handlerId} onChange={(e) => setE("handlerId", e.target.value)} className={input}>
                <option value="">Giữ nguyên</option>
                {staffSorted.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select></label>
          </div>
          <label className="block text-xs text-muted-foreground">Ghi chú xử lý
            <AutoGrowTextarea value={editForm.note} onChange={(e) => setE("note", e.target.value)} /></label>
          <div className="flex gap-2">
            <button type="button" disabled={pending}
              onClick={() => act(() => updateDocument({
                id: editForm.id, status: editForm.status,
                handlerId: editForm.handlerId, note: editForm.note,
              }), "Đã cập nhật công văn.")}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40">Lưu</button>
            <button type="button" disabled={pending} onClick={() => setEditForm(null)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm">Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}

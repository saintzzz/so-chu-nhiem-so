"use client";

import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/status-badge";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { sortByVietnameseName, formatDateOnly } from "@/lib/utils";
import {
  addConsent, revokeConsent, createRequest, updateRequest,
} from "@/app/(app)/school/privacy/actions";

type Consent = {
  id: string; student_id: string | null; subject_label: string; purpose: string;
  channel: string; granted: boolean; granted_by_name: string; note: string | null;
  created_at: string; revoked_at: string | null;
};
type Req = {
  id: string; req_type: string; subject_label: string; requester_name: string;
  requester_contact: string | null; detail: string | null;
  received_at: string; due_at: string; status: string; resolution_note: string | null;
};
type Student = { id: string; full_name: string | null };

const PURPOSES: Record<string, string> = {
  hoc_tap: "Hồ sơ học tập", suc_khoe: "Sức khỏe - BHYT",
  sinh_trac: "Sinh trắc (điểm danh)", ai: "Tính năng AI", hinh_anh: "Hình ảnh - truyền thông",
};
const CHANNELS: Record<string, string> = {
  giay: "Giấy", import: "Import danh sách", cong: "Cổng thông tin", khac: "Khác",
};
const REQ_TYPES: Record<string, string> = {
  access: "Truy cập", rectify: "Chỉnh sửa", erase: "Xóa",
  restrict: "Hạn chế xử lý", object: "Phản đối", complain: "Khiếu nại",
};
const STATUS: Record<string, { label: string; tone: "muted" | "warning" | "success" | "info" | "error" }> = {
  received: { label: "Đã tiếp nhận", tone: "info" },
  processing: { label: "Đang xử lý", tone: "warning" },
  done: { label: "Đã xong", tone: "success" },
  rejected: { label: "Từ chối", tone: "error" },
};

const input = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm w-full";

export default function PrivacyBoard({
  consents, requests, students,
}: {
  consents: Consent[]; requests: Req[]; students: Student[];
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [showReq, setShowReq] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [cf, setCf] = useState({
    studentId: "", subjectLabel: "", purpose: "hoc_tap",
    channel: "giay", grantedByName: "", note: "",
  });
  const [rf, setRf] = useState({
    reqType: "access", subjectLabel: "", requesterName: "",
    requesterContact: "", detail: "", received: "", due: "",
  });
  const [ef, setEf] = useState({ status: "processing", resolutionNote: "" });

  const sortedStudents = sortByVietnameseName(students, (s) => s.full_name ?? "");
  const studentName = (id: string | null) =>
    id ? (students.find((s) => s.id === id)?.full_name ?? id) : "";
  const today = new Date().toISOString().slice(0, 10);
  const overdue = (r: Req) => r.due_at < today && !["done", "rejected"].includes(r.status);

  const act = (fn: () => Promise<string | null>, done: () => void) => {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (res) setErr(res);
      else done();
    });
  };

  const consentValid = cf.subjectLabel.trim() && cf.grantedByName.trim();
  const reqValid = rf.subjectLabel.trim() && rf.requesterName.trim() &&
    rf.received && rf.due > rf.received;

  return (
    <div className="space-y-8">
      {err ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p> : null}

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Đồng thuận phụ huynh</h2>
            <p className="text-sm text-muted-foreground">
              Ghi nhận đồng thuận cho từng mục đích xử lý dữ liệu học sinh - {consents.filter((c) => !c.revoked_at).length} đang hiệu lực
            </p>
          </div>
          <button type="button" onClick={() => setShowConsent((v) => !v)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            {showConsent ? "Đóng" : "Ghi đồng thuận"}
          </button>
        </div>

        {showConsent ? (
          <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={(e) => {
            e.preventDefault();
            act(() => addConsent(cf), () => {
              setShowConsent(false);
              setCf({ ...cf, subjectLabel: "", grantedByName: "", note: "" });
            });
          }}>
            <label className="text-sm">Học sinh liên quan (tuỳ chọn)
              <select className={input} value={cf.studentId} onChange={(e) => setCf({ ...cf, studentId: e.target.value })}>
                <option value="">- Chung cho trường/lớp -</option>
                {sortedStudents.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select></label>
            <label className="text-sm">Chủ thể / phạm vi *
              <input className={input} value={cf.subjectLabel} onChange={(e) => setCf({ ...cf, subjectLabel: e.target.value })} placeholder="VD: PHHS lớp 6A1" /></label>
            <label className="text-sm">Mục đích *
              <select className={input} value={cf.purpose} onChange={(e) => setCf({ ...cf, purpose: e.target.value })}>
                {Object.entries(PURPOSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="text-sm">Kênh
              <select className={input} value={cf.channel} onChange={(e) => setCf({ ...cf, channel: e.target.value })}>
                {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="text-sm">Người cho đồng thuận *
              <input className={input} value={cf.grantedByName} onChange={(e) => setCf({ ...cf, grantedByName: e.target.value })} placeholder="Họ tên cha/mẹ/người giám hộ" /></label>
            <label className="text-sm md:col-span-3">Ghi chú
              <AutoGrowTextarea value={cf.note} onChange={(e) => setCf({ ...cf, note: e.target.value })} /></label>
            <div className="md:col-span-3">
              <button type="submit" disabled={!consentValid || pending}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {pending ? "Đang lưu..." : "Lưu đồng thuận"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 overflow-x-auto relative">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-3 py-2">Chủ thể</th><th className="px-3 py-2">Học sinh</th>
              <th className="px-3 py-2">Mục đích</th><th className="px-3 py-2">Kênh</th>
              <th className="px-3 py-2">Người cho</th><th className="px-3 py-2">Ngày ghi</th>
              <th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2"></th>
            </tr></thead>
            <tbody>
              {consents.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Chưa ghi đồng thuận nào - bắt đầu bằng nút Ghi đồng thuận phía trên.</td></tr>
              ) : consents.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="px-3 py-2.5">{c.subject_label}</td>
                  <td className="px-3 py-2.5">{studentName(c.student_id) || "-"}</td>
                  <td className="px-3 py-2.5">{PURPOSES[c.purpose] ?? c.purpose}</td>
                  <td className="px-3 py-2.5">{CHANNELS[c.channel] ?? c.channel}</td>
                  <td className="px-3 py-2.5">{c.granted_by_name}</td>
                  <td className="px-3 py-2.5 text-xs">{formatDateOnly(c.created_at)}</td>
                  <td className="px-3 py-2.5">
                    {c.revoked_at
                      ? <StatusBadge label="Đã thu hồi" tone="muted" />
                      : <StatusBadge label="Hiệu lực" tone="success" />}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!c.revoked_at ? (
                      <button type="button" disabled={pending}
                        onClick={() => act(() => revokeConsent(c.id), () => {})}
                        className="text-xs text-red-600 hover:underline">Thu hồi</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Yêu cầu quyền chủ thể</h2>
            <p className="text-sm text-muted-foreground">
              Truy cập, chỉnh sửa, xóa, hạn chế, phản đối, khiếu nại - {requests.filter((r) => !["done", "rejected"].includes(r.status)).length} đang mở
            </p>
          </div>
          <button type="button" onClick={() => setShowReq((v) => !v)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            {showReq ? "Đóng" : "Tiếp nhận yêu cầu"}
          </button>
        </div>

        {showReq ? (
          <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={(e) => {
            e.preventDefault();
            act(() => createRequest(rf), () => {
              setShowReq(false);
              setRf({ ...rf, subjectLabel: "", requesterName: "", requesterContact: "", detail: "" });
            });
          }}>
            <label className="text-sm">Loại yêu cầu *
              <select className={input} value={rf.reqType} onChange={(e) => setRf({ ...rf, reqType: e.target.value })}>
                {Object.entries(REQ_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="text-sm">Chủ thể dữ liệu *
              <input className={input} value={rf.subjectLabel} onChange={(e) => setRf({ ...rf, subjectLabel: e.target.value })} placeholder="VD: HS Nguyễn Văn A - 6A1" /></label>
            <label className="text-sm">Người gửi yêu cầu *
              <input className={input} value={rf.requesterName} onChange={(e) => setRf({ ...rf, requesterName: e.target.value })} placeholder="Họ tên PHHS/chủ thể" /></label>
            <label className="text-sm">Liên hệ người gửi
              <input className={input} value={rf.requesterContact} onChange={(e) => setRf({ ...rf, requesterContact: e.target.value })} placeholder="Email hoặc SĐT" /></label>
            <label className="text-sm">Ngày tiếp nhận *
              <input type="date" className={input} value={rf.received} onChange={(e) => {
                const received = e.target.value;
                const due = received ? new Date(new Date(received).getTime() + 30 * 86400000).toISOString().slice(0, 10) : "";
                setRf({ ...rf, received, due });
              }} /></label>
            <label className="text-sm">Hạn xử lý * <span className="text-muted-foreground">(mặc định +30 ngày)</span>
              <input type="date" className={input} value={rf.due} onChange={(e) => setRf({ ...rf, due: e.target.value })} /></label>
            <label className="text-sm md:col-span-3">Nội dung yêu cầu
              <AutoGrowTextarea value={rf.detail} onChange={(e) => setRf({ ...rf, detail: e.target.value })} /></label>
            <div className="md:col-span-3">
              <button type="submit" disabled={!reqValid || pending}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {pending ? "Đang lưu..." : "Tiếp nhận"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 overflow-x-auto relative">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-3 py-2">Loại</th><th className="px-3 py-2">Chủ thể</th>
              <th className="px-3 py-2">Người gửi</th><th className="px-3 py-2">Tiếp nhận</th>
              <th className="px-3 py-2">Hạn</th><th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr></thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Chưa có yêu cầu nào - tiếp nhận đầu tiên bằng nút phía trên.</td></tr>
              ) : requests.map((r) => (
                <tr key={r.id} className="border-b border-border/60 align-top">
                  <td className="px-3 py-2.5">{REQ_TYPES[r.req_type] ?? r.req_type}</td>
                  <td className="px-3 py-2.5">{r.subject_label}
                    {r.detail ? <p className="text-xs text-muted-foreground line-clamp-2">{r.detail}</p> : null}</td>
                  <td className="px-3 py-2.5">{r.requester_name}
                    {r.requester_contact ? <p className="text-xs text-muted-foreground">{r.requester_contact}</p> : null}</td>
                  <td className="px-3 py-2.5 text-xs">{formatDateOnly(r.received_at)}</td>
                  <td className={`px-3 py-2.5 text-xs ${overdue(r) ? "font-semibold text-red-600" : ""}`}>
                    {formatDateOnly(r.due_at)}{overdue(r) ? " (quá hạn)" : ""}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge label={STATUS[r.status]?.label ?? r.status} tone={STATUS[r.status]?.tone ?? "muted"} />
                    {r.resolution_note ? <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.resolution_note}</p> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!["done", "rejected"].includes(r.status) ? (
                      editId === r.id ? (
                        <form className="flex flex-col gap-2" onSubmit={(e) => {
                          e.preventDefault();
                          act(() => updateRequest({ id: r.id, ...ef }), () => setEditId(null));
                        }}>
                          <select className={input} value={ef.status} onChange={(e) => setEf({ ...ef, status: e.target.value })}>
                            <option value="processing">Đang xử lý</option>
                            <option value="done">Đã xong</option>
                            <option value="rejected">Từ chối</option>
                          </select>
                          <AutoGrowTextarea bare value={ef.resolutionNote}
                            onChange={(e) => setEf({ ...ef, resolutionNote: e.target.value })}
                            placeholder="Kết quả xử lý (bắt buộc khi đóng)" />
                          <div className="flex gap-2">
                            <button type="submit" disabled={pending} className="text-xs font-medium text-primary hover:underline">Lưu</button>
                            <button type="button" onClick={() => setEditId(null)} className="text-xs text-muted-foreground hover:underline">Hủy</button>
                          </div>
                        </form>
                      ) : (
                        <button type="button" onClick={() => { setEditId(r.id); setEf({ status: "processing", resolutionNote: "" }); }}
                          className="text-xs text-primary hover:underline">Cập nhật</button>
                      )
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

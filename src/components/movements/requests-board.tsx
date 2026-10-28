"use client";

import { useMemo, useState, useTransition } from "react";
import { createRequest, decideRequest, cancelRequest } from "@/app/(app)/movements/actions";
import { fmtDateVN, sortByVietnameseName } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

type ReqType = "transfer_out" | "transfer_in" | "reserve" | "return";

export type RequestRow = {
  id: string;
  type: ReqType;
  status: "pending" | "approved" | "rejected" | "cancelled";
  student_id: string | null;
  student_name: string;
  class_label: string | null;
  effective_date: string;
  counterpart_school: string | null;
  to_class_id: string | null;
  reason: string | null;
  decision_note: string | null;
  requested_by: string | null;
  requester_name: string;
  created_at: string;
};
export type StudentOpt = {
  id: string;
  full_name: string;
  code: string;
  status: string;
  class_label: string;
};
export type ClassOpt = { id: string; name: string };

const inputCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

const TYPE_LABEL: Record<ReqType, string> = {
  transfer_out: "Chuyển đi",
  transfer_in: "Chuyển đến",
  reserve: "Bảo lưu",
  return: "Nhập học lại",
};
const TYPE_STUDENT_STATUS: Record<ReqType, string | null> = {
  transfer_out: "active",
  transfer_in: null,
  reserve: "active",
  return: "reserved",
};
const STATUS_META = {
  pending: { label: "Chờ duyệt", tone: "warning" as const },
  approved: { label: "Đã duyệt", tone: "success" as const },
  rejected: { label: "Từ chối", tone: "error" as const },
  cancelled: { label: "Đã hủy", tone: "muted" as const },
};

export default function RequestsBoard({
  requests,
  students,
  classes,
  canDecide,
  myId,
  loadError,
}: {
  requests: RequestRow[];
  students: StudentOpt[];
  classes: ClassOpt[];
  canDecide: boolean;
  myId: string;
  loadError: string | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(loadError);
  const [ok, setOk] = useState<string | null>(null);
  const [type, setType] = useState<ReqType>("transfer_out");
  const [studentId, setStudentId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [effective, setEffective] = useState("");
  const [counterpart, setCounterpart] = useState("");
  const [reason, setReason] = useState("");
  const [newName, setNewName] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newGender, setNewGender] = useState("nam");
  const [newNid, setNewNid] = useState("");
  const [newAddr, setNewAddr] = useState("");

  const wantedStatus = TYPE_STUDENT_STATUS[type];
  const studentOpts = useMemo(
    () =>
      sortByVietnameseName(
        students.filter((s) => (wantedStatus ? s.status === wantedStatus : true)),
        (s) => s.full_name,
      ),
    [students, wantedStatus],
  );

  const valid =
    !!effective &&
    (type === "transfer_in"
      ? newName.trim() !== "" && newDob !== "" && toClassId !== "" && counterpart.trim() !== ""
      : studentId !== "" &&
        (type === "transfer_out" ? counterpart.trim() !== "" : true));

  function submit() {
    if (!valid) return;
    setErr(null);
    setOk(null);
    start(async () => {
      const res = await createRequest({
        type,
        studentId: type === "transfer_in" ? null : studentId || null,
        effectiveDate: effective,
        counterpart: counterpart || undefined,
        toClassId: toClassId || null,
        reason: reason || undefined,
        payload:
          type === "transfer_in"
            ? {
                full_name: newName,
                dob: newDob,
                gender: newGender,
                national_id: newNid,
                address: newAddr,
              }
            : undefined,
      });
      if (res) setErr(res);
      else {
        setOk("Đã tạo yêu cầu biến động - chờ Ban Giám Hiệu duyệt.");
        setStudentId("");
        setReason("");
        setCounterpart("");
      }
    });
  }

  function act(fn: () => Promise<string | null>) {
    setErr(null);
    setOk(null);
    start(async () => {
      const res = await fn();
      if (res) setErr(res);
      else setOk("Đã xử lý.");
    });
  }

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, other: 0 };
    for (const r of requests) {
      if (r.status === "pending") c.pending++;
      else if (r.status === "approved") c.approved++;
      else if (r.status === "rejected") c.rejected++;
      else c.other++;
    }
    return c;
  }, [requests]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Biến động học sinh</h1>
        <p className="text-sm text-muted-foreground">
          Chuyển trường, bảo lưu, nhập học lại - yêu cầu do GVCN/BGH tạo, Ban Giám Hiệu duyệt.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Chờ duyệt", counts.pending],
          ["Đã duyệt", counts.approved],
          ["Từ chối", counts.rejected],
          ["Đã hủy", counts.other],
        ].map(([l, n]) => (
          <div key={l} className="rounded-xl border border-border bg-card p-3">
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">Tạo yêu cầu biến động</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABEL) as ReqType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setStudentId("");
              }}
              className={`rounded-full border px-3 py-1 text-sm ${
                type === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background"
              }`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {type === "transfer_in" ? (
            <>
              <input
                className={inputCls}
                placeholder="Họ tên học sinh chuyển đến *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  type="date"
                  value={newDob}
                  onChange={(e) => setNewDob(e.target.value)}
                />
                <select
                  className={inputCls}
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value)}
                >
                  <option value="nam">Nam</option>
                  <option value="nu">Nữ</option>
                  <option value="khac">Khác</option>
                </select>
              </div>
              <input
                className={inputCls}
                placeholder="Mã định danh quốc gia (nếu có)"
                value={newNid}
                onChange={(e) => setNewNid(e.target.value)}
              />
              <input
                className={inputCls}
                placeholder="Địa chỉ"
                value={newAddr}
                onChange={(e) => setNewAddr(e.target.value)}
              />
              <select
                className={inputCls}
                value={toClassId}
                onChange={(e) => setToClassId(e.target.value)}
              >
                <option value="">Lớp nhận *</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <select
              className={inputCls}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">
                Chọn học sinh ({TYPE_LABEL[type]}) *
              </option>
              {studentOpts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} - {s.code} - {s.class_label}
                </option>
              ))}
            </select>
          )}
          {type === "return" && (
            <select
              className={inputCls}
              value={toClassId}
              onChange={(e) => setToClassId(e.target.value)}
            >
              <option value="">Chuyển lớp khi nhập lại (tùy chọn)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {(type === "transfer_out" || type === "transfer_in") && (
            <input
              className={inputCls}
              placeholder={
                type === "transfer_out" ? "Trường chuyển đến *" : "Trường chuyển từ *"
              }
              value={counterpart}
              onChange={(e) => setCounterpart(e.target.value)}
            />
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Ngày hiệu lực *</label>
            <input
              className={inputCls}
              type="date"
              value={effective}
              onChange={(e) => setEffective(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3">
          <AutoGrowTextarea
            className={inputCls + " w-full"}
            placeholder="Lý do / ghi chú giấy tờ"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            bare
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={pending || !valid}
            onClick={submit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Đang gửi..." : "Gửi yêu cầu"}
          </button>
          {err && <span className="text-sm text-destructive">{err}</span>}
          {ok && <span className="text-sm text-green-600">{ok}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3">Học sinh</th>
              <th className="p-3">Loại</th>
              <th className="p-3">Hiệu lực</th>
              <th className="p-3">Trường phát sinh</th>
              <th className="p-3">Người yêu cầu</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Chưa có yêu cầu biến động nào.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="p-3">
                  <div className="font-medium">{r.student_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.class_label ?? ""}
                    {r.reason ? ` - ${r.reason}` : ""}
                  </div>
                </td>
                <td className="p-3">{TYPE_LABEL[r.type]}</td>
                <td className="p-3">{fmtDateVN(r.effective_date)}</td>
                <td className="p-3">{r.counterpart_school ?? ""}</td>
                <td className="p-3">{r.requester_name}</td>
                <td className="p-3">
                  <StatusBadge
                    label={STATUS_META[r.status].label}
                    tone={STATUS_META[r.status].tone}
                  />
                  {r.decision_note && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.decision_note}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      {canDecide && (
                        <>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => act(() => decideRequest(r.id, "approved"))}
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent"
                          >
                            Duyệt
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              const note = window.prompt("Lý do từ chối (tùy chọn):") ?? undefined;
                              act(() => decideRequest(r.id, "rejected", note));
                            }}
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent"
                          >
                            Từ chối
                          </button>
                        </>
                      )}
                      {(canDecide || r.requested_by === myId) && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => act(() => cancelRequest(r.id))}
                          className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                        >
                          Hủy
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

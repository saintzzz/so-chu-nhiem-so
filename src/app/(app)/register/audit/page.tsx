import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { cn, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable, Pagination } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { AuditLog } from "@/components/register/types";
import type { ClassRoom, Profile, Student } from "@/types";

const PAGE_SIZE = 50;

interface RecordHistoryRow {
  id: string;
  student_id: string;
  changed_by: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

const FIELD_LABEL: Record<string, string> = {
  address: "Địa chỉ",
  full_name: "Họ tên",
  dob: "Ngày sinh",
  gender: "Giới tính",
  status: "Trạng thái",
  group_id: "Tổ",
  phone: "Số điện thoại",
  code: "Mã học sinh",
};

interface SP {
  type?: string;
  page?: string;
  from?: string;
  to?: string;
  actor?: string;
  q?: string;
  class?: string;
  student?: string;
}

function qs(sp: SP, override: Record<string, string | undefined>) {
  const merged: Record<string, string | undefined> = {
    type: sp.type,
    from: sp.from,
    to: sp.to,
    actor: sp.actor,
    q: sp.q,
    class: sp.class,
    student: sp.student,
    ...override,
  };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const str = params.toString();
  return `/register/audit${str ? `?${str}` : ""}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const sp = await searchParams;
  const type = sp.type === "records" ? "records" : "audit";
  const page = Math.max(1, Number(sp.page) || 1);
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : undefined;
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : undefined;
  const supabase = await createClient();

  // Classes the viewer is allowed to see - drives student/class filters.
  // Runs in parallel with the staff list - the two are independent.
  let classQuery = supabase.from("classes").select("*").order("name");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const staffQuery = profile.school_id
    ? supabase
        .from("profiles")
        .select("id,full_name")
        .eq("school_id", profile.school_id)
        .order("full_name")
    : null;
  const [{ data: classData }, { data: staffData }] = await Promise.all([
    classQuery,
    staffQuery ?? Promise.resolve({ data: [] }),
  ]);
  const classes = (classData ?? []) as ClassRoom[];
  const classIds = classes.map((c) => c.id);
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const selectedClassId =
    sp.class && classIds.includes(sp.class) ? sp.class : undefined;

  const { data: studentData } =
    type === "records" && classIds.length
      ? await supabase
          .from("students")
          .select("id,code,full_name,class_id")
          .in("class_id", classIds)
      : { data: [] };
  const students = ((studentData ?? []) as Pick<
    Student,
    "id" | "code" | "full_name" | "class_id"
  >[]).filter((s) => !selectedClassId || s.class_id === selectedClassId);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const selectedStudentId =
    sp.student && students.some((s) => s.id === sp.student)
      ? sp.student
      : undefined;

  const staff = (staffData ?? []) as Pick<Profile, "id" | "full_name">[];
  const staffById = new Map(staff.map((s) => [s.id, s.full_name]));
  const selectedActor =
    sp.actor && staffById.has(sp.actor) ? sp.actor : undefined;
  const q = sp.q?.trim() || undefined;

  // ----- audit tab -----
  let logs: AuditLog[] = [];
  let auditCount = 0;
  if (type === "audit") {
    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);
    if (selectedActor) query = query.eq("actor_id", selectedActor);
    if (q) query = query.or(`action.ilike.%${q}%,entity.ilike.%${q}%`);
    const { data, count } = await query.range(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE - 1,
    );
    logs = (data ?? []) as AuditLog[];
    auditCount = count ?? logs.length;
  }

  const logActorIds = [
    ...new Set(logs.map((l) => l.actor_id).filter(Boolean)),
  ] as string[];
  const { data: logActorData } =
    logActorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", logActorIds)
      : { data: [] };
  for (const p of (logActorData ?? []) as Pick<Profile, "id" | "full_name">[]) {
    if (!staffById.has(p.id)) staffById.set(p.id, p.full_name);
  }

  // ----- records tab -----
  let history: RecordHistoryRow[] = [];
  let recordCount = 0;
  if (type === "records") {
    const scopedStudentIds = students.map((s) => s.id);
    if (scopedStudentIds.length > 0) {
      let query = supabase
        .from("student_record_history")
        .select("*", { count: "exact" })
        .in("student_id", scopedStudentIds)
        .order("changed_at", { ascending: false });
      if (from) query = query.gte("changed_at", `${from}T00:00:00`);
      if (to) query = query.lte("changed_at", `${to}T23:59:59`);
      if (selectedActor) query = query.eq("changed_by", selectedActor);
      if (selectedStudentId)
        query = query.eq("student_id", selectedStudentId);
      if (q) query = query.eq("field", q);
      const { data, count } = await query.range(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE - 1,
      );
      history = (data ?? []) as RecordHistoryRow[];
      recordCount = count ?? history.length;
    }
  }

  const changerIds = [
    ...new Set(history.map((h) => h.changed_by).filter(Boolean)),
  ] as string[];
  const { data: changerData } =
    changerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", changerIds)
      : { data: [] };
  for (const p of (changerData ?? []) as Pick<Profile, "id" | "full_name">[]) {
    if (!staffById.has(p.id)) staffById.set(p.id, p.full_name);
  }

  const total = type === "audit" ? auditCount : recordCount;

  return (
    <>
      <PageHeader
        section="Sổ chủ nhiệm"
        title="Nhật ký & lịch sử"
        description="Nhật ký thao tác hệ thống và lịch sử cập nhật hồ sơ học sinh (chỉ xem)."
      />

      {/* Source tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["audit", "Nhật ký thao tác"],
            ["records", "Lịch sử cập nhật hồ sơ"],
          ] as const
        ).map(([t, label]) => (
          <Link prefetch={false}
            key={t}
            href={qs(sp, { type: t, page: undefined, student: undefined })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              type === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]"
      >
        <input type="hidden" name="type" value={type} />
        {type === "records" && classes.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Lớp</span>
            <select
              name="class"
              defaultValue={selectedClassId ?? ""}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Tất cả lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {type === "records" && students.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Học sinh</span>
            <select
              name="student"
              defaultValue={selectedStudentId ?? ""}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Tất cả học sinh</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.code})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Người thao tác</span>
          <select
            name="actor"
            defaultValue={selectedActor ?? ""}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Tất cả</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Từ ngày</span>
          <input
            key={`from-${from ?? ""}`}
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Đến ngày</span>
          <input
            key={`to-${to ?? ""}`}
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">
            {type === "audit" ? "Hành động / đối tượng" : "Trường dữ liệu"}
          </span>
          {type === "audit" ? (
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Ví dụ: seating, grades…"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          ) : (
            <select
              name="q"
              defaultValue={q ?? ""}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Tất cả</option>
              {Object.entries(FIELD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Lọc
        </button>
      </form>

      {type === "audit" ? (
        <DataTable
          columns={[
            "Thời điểm",
            "Người thao tác",
            "Hành động",
            "Đối tượng",
            "Chi tiết",
          ]}
          footer={
            <Pagination
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              href={(p) => qs(sp, { page: String(p) })}
            />
          }
        >
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(l.created_at)}
              </td>
              <td className="font-medium">
                {l.actor_id ? (staffById.get(l.actor_id) ?? "-") : "Hệ thống"}
              </td>
              <td>
                <StatusBadge label={l.action} tone="primary" />
              </td>
              <td className="text-muted-foreground">
                {l.entity}
                {l.entity_id ? ` · ${l.entity_id.slice(0, 8)}…` : ""}
              </td>
              <td className="max-w-xs truncate text-xs text-muted-foreground">
                {l.payload ? JSON.stringify(l.payload) : "-"}
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted-foreground">
                Không có nhật ký nào khớp bộ lọc.
              </td>
            </tr>
          )}
        </DataTable>
      ) : (
        <DataTable
          columns={[
            "Thời gian",
            "Học sinh",
            "Lớp",
            "Trường dữ liệu",
            "Giá trị cũ",
            "Giá trị mới",
            "Người cập nhật",
          ]}
          footer={
            <Pagination
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              href={(p) => qs(sp, { page: String(p) })}
            />
          }
        >
          {history.map((h) => {
            const st = studentById.get(h.student_id);
            return (
              <tr key={h.id}>
                <td className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(h.changed_at)}
                </td>
                <td className="font-medium">{st?.full_name ?? "-"}</td>
                <td className="text-muted-foreground">
                  {st ? (classNameById.get(st.class_id) ?? "-") : "-"}
                </td>
                <td>
                  <StatusBadge
                    label={FIELD_LABEL[h.field] ?? h.field}
                    tone="primary"
                  />
                </td>
                <td className="max-w-[10rem] truncate text-muted-foreground">
                  {h.old_value ?? "-"}
                </td>
                <td className="max-w-[10rem] truncate">
                  {h.new_value ?? "-"}
                </td>
                <td className="text-muted-foreground">
                  {h.changed_by ? (staffById.get(h.changed_by) ?? "-") : "-"}
                </td>
              </tr>
            );
          })}
          {history.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-muted-foreground">
                Không có thay đổi nào khớp bộ lọc.
              </td>
            </tr>
          )}
        </DataTable>
      )}
    </>
  );
}

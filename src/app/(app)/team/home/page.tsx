import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Users, CalendarDays, ClipboardCheck } from "lucide-react";
import type { Profile } from "@/types";

interface Department {
  id: string;
  name: string;
  school_id: string;
  head_id: string | null;
}

interface DeptMeeting {
  id: string;
  department_id: string;
  title: string;
  meeting_date: string;
  content: string | null;
}

function formatDate(isoDate: string): string {
  return isoDate.slice(0, 10).split("-").reverse().join("/");
}

export default async function TeamHomePage() {
  const profile = await requireRoles(["to_truong"]);
  const supabase = await createClient();

  const { data: deptRow } = await supabase
    .from("departments")
    .select("id,name,school_id,head_id")
    .eq("id", profile.department_id ?? "")
    .single();
  const dept = deptRow as Department | null;

  const { data: memberRows } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .eq("department_id", profile.department_id ?? "")
    .in("role", ["gvcn", "gvbm", "to_truong"]);
  const members = (memberRows ?? []) as Pick<
    Profile,
    "id" | "full_name" | "role"
  >[];
  const memberIds = members.map((m) => m.id);
  const headName = dept?.head_id
    ? (members.find((m) => m.id === dept.head_id)?.full_name ??
      (
        ((
          await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", dept.head_id)
            .single()
        ).data ?? null) as Pick<Profile, "full_name"> | null
      )?.full_name ??
      "-")
    : "-";

  const [meetingsRes, pendingRes] = await Promise.all([
    supabase
      .from("dept_meetings")
      .select("id,department_id,title,meeting_date,content")
      .eq("department_id", profile.department_id ?? "")
      .order("meeting_date", { ascending: false })
      .limit(5),
    memberIds.length
      ? supabase
          .from("teacher_assessments")
          .select("id", { count: "exact", head: true })
          .in("teacher_id", memberIds)
          .eq("status", "submitted")
      : Promise.resolve({ count: 0 }),
  ]);

  const meetings = (meetingsRes.data ?? []) as DeptMeeting[];

  return (
    <>
      <PageHeader
        section="Tổ chuyên môn"
        title="Trang chủ tổ chuyên môn"
        description="Thông tin tổ, sinh hoạt chuyên môn và đánh giá năng lực"
      />

      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {dept?.name ?? "Tổ chuyên môn"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tổ trưởng:{" "}
              <span className="font-medium text-foreground">{headName}</span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-bg px-3 py-1 text-sm font-medium text-primary">
            <Users className="size-4" />
            {members.length} thành viên
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Đánh giá năng lực chờ duyệt"
          value={pendingRes.count ?? 0}
          tone={(pendingRes.count ?? 0) > 0 ? "warning" : "success"}
          href="/team/review"
        />
        <StatCard
          label="Giáo viên trong tổ"
          value={members.filter((m) => m.role !== "to_truong").length}
          href="/team/teachers"
        />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <CalendarDays className="size-4 text-muted-foreground" />
            Sinh hoạt chuyên môn gần đây
          </h3>
          <Link
            href="/team/meetings"
            className="text-sm font-medium text-primary hover:underline"
          >
            Xem tất cả
          </Link>
        </div>
        {meetings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có buổi sinh hoạt nào.
          </p>
        ) : (
          <ul className="space-y-3">
            {meetings.map((m) => (
              <li key={m.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{m.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(m.meeting_date)}
                  </span>
                </div>
                {m.content && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {m.content}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(pendingRes.count ?? 0) > 0 && (
        <Link
          href="/team/review"
          className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-warning-bg p-4 text-sm font-medium text-warning"
        >
          <ClipboardCheck className="size-4" />
          Có {pendingRes.count} đánh giá năng lực đang chờ duyệt - bấm để xem
          xét.
        </Link>
      )}
    </>
  );
}

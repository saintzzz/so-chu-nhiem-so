import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StudentUploader } from "@/components/records/student-uploader";
import { VneduExport } from "@/components/records/vnedu-export";
import { AiExtract } from "@/components/records/ai-extract";
import { hasRole } from "@/lib/roles";
import { must } from "@/lib/supabase/must";
import type { VneduParent, VneduStudent } from "@/lib/vnedu";

export default async function RecordsUploadPage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("id,name")
    .eq("status", "active")
    .order("name");
  if (hasRole(profile, "gvcn")) {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await must(classQuery, "query");
  const classes = (classData ?? []) as { id: string; name: string }[];

  // CR-116-W3: du lieu cho export mau-1 vnEdu - hoc sinh kem phu huynh.
  const clsIds = classes.map((c) => c.id);
  const [{ data: stuData }, { data: schoolData }, { data: gvcnData }] =
    clsIds.length > 0
      ? await Promise.all([
          must(supabase
            .from("students")
            .select("id,class_id,code,national_id,full_name,dob,gender,address,status,parent_students(parents(id,full_name,phone,email,relationship))")
            .in("class_id", clsIds)
            .neq("status", "transferred")
            .order("full_name")
            .limit(3000), "students"),
          must(supabase
            .from("schools")
            .select("name")
            .eq("id", profile.school_id ?? "")
            .maybeSingle(), "schools"),
          must(supabase
            .from("classes")
            .select("id,gvcn_id")
            .in("id", clsIds), "classes"),
        ])
      : [{ data: [] }, { data: null }, { data: [] }];

  const gvcnIds = [...new Set((gvcnData ?? []).map((c) => c.gvcn_id).filter(Boolean))] as string[];
  const { data: gvcnProfiles } = gvcnIds.length
    ? await must(
        supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", gvcnIds)
          .limit(500),
        "profiles",
      )
    : { data: [] };
  const gvcnName = new Map((gvcnProfiles ?? []).map((p) => [p.id, p.full_name as string]));
  const clsGvcn = new Map((gvcnData ?? []).map((c) => [c.id, c.gvcn_id ? gvcnName.get(c.gvcn_id) ?? null : null]));

  type RawStudent = {
    class_id: string;
    code: string | null;
    national_id: string | null;
    full_name: string;
    dob: string | null;
    gender: string | null;
    address: string | null;
    status: string;
    parent_students: { parents: VneduParent | VneduParent[] | null }[];
  };
  const exportClasses = classes.map((c) => ({
    id: c.id,
    name: c.name,
    gvcnName: clsGvcn.get(c.id) ?? null,
    students: ((stuData ?? []) as RawStudent[])
      .filter((s) => s.class_id === c.id)
      .map(
        (s): VneduStudent => ({
          code: s.code,
          national_id: s.national_id,
          full_name: s.full_name,
          dob: s.dob,
          gender: s.gender,
          address: s.address,
          status: s.status,
          parents: (s.parent_students ?? [])
            .flatMap((ps) => {
              const p = ps.parents;
              return Array.isArray(p) ? p : p ? [p] : [];
            })
            .filter((p): p is VneduParent => p !== null),
        }),
      ),
  }));

  return (
    <div>
      <PageHeader
        section="Hồ sơ lớp học"
        title="Upload danh sách học sinh"
        description="Tải lên file Excel hoặc CSV để xem trước, kiểm tra và nhập học sinh vào lớp."
      />

      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="text-base font-semibold">Hướng dẫn định dạng file</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            File Excel (.xlsx) hoặc CSV (UTF-8), dòng đầu là dòng tiêu đề. Các
            cột nhận diện được:{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              code, full_name, dob, gender
            </code>{" "}
            (hoặc tiếng Việt:{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              ma_hs, ho_ten, ngay_sinh, gioi_tinh
            </code>
            ). Nên dùng nút &quot;Tải template&quot; để lấy file mẫu.
          </li>
          <li>
            Ngày sinh định dạng{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              YYYY-MM-DD
            </code>{" "}
            hoặc{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              DD/MM/YYYY
            </code>
            ; giới tính: nam / nu / khac. Mã HS để trống sẽ được hệ thống tự
            sinh.
          </li>
          <li>
            Hệ thống kiểm tra từng dòng và đánh dấu lỗi trước khi import - các
            dòng lỗi sẽ không được đưa vào.
          </li>
        </ul>
      </div>

      <AiExtract />
      <StudentUploader classes={classes} />
      <div className="mt-6">
        <VneduExport
          classes={exportClasses}
          schoolName={schoolData?.name ?? "TRƯỜNG"}
        />
      </div>
    </div>
  );
}

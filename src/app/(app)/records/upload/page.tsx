import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StudentUploader } from "@/components/records/student-uploader";

export default async function RecordsUploadPage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("id,name")
    .eq("status", "active")
    .order("name");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await classQuery;
  const classes = (classData ?? []) as { id: string; name: string }[];

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

      <StudentUploader classes={classes} />
    </div>
  );
}

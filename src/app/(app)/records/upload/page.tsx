import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { CsvUploader } from "@/components/records/csv-uploader";

export default async function RecordsUploadPage() {
  await requireRoles(["gvcn", "bgh"]);

  return (
    <div>
      <PageHeader
        section="Phân hệ I - Hồ sơ lớp học"
        title="Upload danh sách học sinh"
        description="Tải lên file CSV để xem trước và kiểm tra dữ liệu trước khi nhập vào hệ thống."
      />

      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="text-base font-semibold">Hướng dẫn định dạng file</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            File CSV (UTF-8), dòng đầu là dòng tiêu đề. Các cột nhận diện được:{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              code, full_name, dob, gender
            </code>{" "}
            (hoặc tiếng Việt:{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              ma_hs, ho_ten, ngay_sinh, gioi_tinh
            </code>
            ).
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
            ; giới tính: nam / nu / khac.
          </li>
          <li>
            Hệ thống kiểm tra từng dòng và đánh dấu lỗi trước khi import — các
            dòng lỗi sẽ không được đưa vào.
          </li>
        </ul>
      </div>

      <CsvUploader />
    </div>
  );
}

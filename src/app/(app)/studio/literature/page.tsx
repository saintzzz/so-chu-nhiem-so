import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LiteratureText } from "@/types/tvc";
import { Copy } from "lucide-react";
import { LiteratureImport, LiteratureExport } from "@/components/tvc/literature-import";

export const dynamic = "force-dynamic";

type LiteText = Omit<LiteratureText, "standard_ids" | "created_at">;

export default async function StudioLiteraturePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  await requireRoles(["gvcn", "gvbm", "to_truong", "bgh", "admin"]);
  const { type, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("tvc_literature_texts")
    .select("id, title, author, text_type, difficulty, topics, grade_min, grade_max, license_note, source, content")
    .order("title");
  if (type) query = query.eq("text_type", type);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data } = await query.limit(100);
  const texts = (data as LiteText[]) ?? [];
  const types = [...new Set(texts.map((t) => t.text_type))];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        section="Công cụ số giáo viên"
        title="Kho ngữ liệu ngoài SGK"
        description="Văn bản ghi rõ nguồn và quyền tác giả - dùng làm đầu vào cho công cụ sinh câu hỏi đọc hiểu (V-02)"
      />

      <form className="mt-4 flex flex-wrap gap-2" action="/studio/literature">
        <input
          name="q"
          defaultValue={q}
          placeholder="Tìm theo tên văn bản..."
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        />
        <select
          name="type"
          defaultValue={type ?? ""}
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        >
          <option value="">Mọi thể loại</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Lọc
        </button>
        <span className="ml-auto flex items-center gap-2">
          <LiteratureImport />
          <LiteratureExport rows={texts} />
        </span>
      </form>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {texts.map((t) => (
          <div key={t.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{t.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {t.author ?? "Khuyết danh"} - {t.text_type}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                Lớp {t.grade_min}-{t.grade_max}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.topics?.map((tp) => (
                <span
                  key={tp}
                  className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tp}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Nguồn: {t.license_note ?? t.source}
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/studio/literature/${t.id}`}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Đọc văn bản
              </Link>
              <Link
                href={`/studio/literature/${t.id}?use=1`}
                className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
              >
                <Copy className="h-3.5 w-3.5" /> Dùng cho V-02
              </Link>
            </div>
          </div>
        ))}
        {!texts.length && (
          <p className="col-span-2 rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            Chưa có ngữ liệu nào.
          </p>
        )}
      </div>
    </div>
  );
}

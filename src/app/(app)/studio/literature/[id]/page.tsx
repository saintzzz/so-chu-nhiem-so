import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LiteratureText } from "@/types/tvc";
import { ArrowLeft } from "lucide-react";
import { CopyTextButton } from "@/components/tvc/copy-text";

export default async function StudioLiteratureDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ use?: string }>;
}) {
  await requireRoles(["gvcn", "gvbm", "to_truong", "bgh", "admin"]);
  const { id } = await params;
  const { use } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tvc_literature_texts")
    .select("*")
    .eq("id", id)
    .single();
  const text = data as LiteratureText | null;
  if (!text) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/studio/literature"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kho ngữ liệu
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{text.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {text.author ?? "Khuyết danh"} - {text.text_type} - Lớp {text.grade_min}-{text.grade_max}
          </p>
        </div>
        <div className="flex gap-2">
          <CopyTextButton text={text.content} label="Sao chép văn bản" />
          <Link
            href="/studio/V-02"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            Mở V-02 để sinh câu hỏi
          </Link>
        </div>
      </div>
      {use && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-secondary px-4 py-3 text-sm">
          Bấm &quot;Sao chép văn bản&quot;, sau đó mở công cụ V-02 và dán vào ô &quot;Văn bản&quot;.
        </div>
      )}
      <article className="a4-sheet mt-4 text-[15px]">
        {text.content.split(/\n\n+/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
      <p className="mt-4 text-xs text-muted-foreground">
        Nguồn/quyền: {text.license_note ?? text.source} - Không sao chép nội dung
        sách giáo khoa đang còn bản quyền.
      </p>
    </div>
  );
}

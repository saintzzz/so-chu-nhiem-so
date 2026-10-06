import { notFound } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DocRender } from "@/components/tvc/doc-render";
import { PrintButton } from "@/components/tvc/print-button";
import type { Material } from "@/types/tvc";

export const dynamic = "force-dynamic";

/** Trang in - mở tab mới rồi Ctrl+P / Lưu PDF. */
export default async function StudioPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh", "admin"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tvc_materials")
    .select("*")
    .eq("id", id)
    .single();
  const material = data as Material | null;
  if (!material || material.author_id !== profile.id) notFound();

  return (
    <div className="py-8 print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[794px] items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
        <span className="text-muted-foreground">
          Nhấn Ctrl+P (hoặc Cmd+P) và chọn &quot;Lưu thành PDF&quot;
        </span>
        <PrintButton />
      </div>
      <DocRender doc={material.content} />
    </div>
  );
}

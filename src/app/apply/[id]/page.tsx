import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyForm } from "./apply-form";

// Cong tuyen sinh cong khai - khong can dang nhap.
// Du lieu qua RPC security definer, chi lo truong toi thieu.

type Info = {
  name?: string;
  level?: "khoi_6" | "khoi_10";
  school_name?: string;
  status: string;
  exam_subjects?: string[];
};

const LEVEL_LABEL: Record<string, string> = {
  khoi_6: "Vao lop 6 (xet tuyen)",
  khoi_10: "Vao lop 10 (thi tuyen)",
};

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.rpc("admission_campaign_info", {
    p_campaign: id,
  });
  if (error || !data) notFound();
  const info = data as Info;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium text-brand">{info.school_name}</p>
        <h1 className="mt-1 text-2xl font-bold">{info.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {info.level ? (LEVEL_LABEL[info.level] ?? info.level) : null}
        </p>
      </header>
      {info.status !== "open" ? (
        <div className="rounded-xl border border-border bg-muted/40 p-6 text-center">
          <p className="font-medium">Đợt tuyển sinh chưa mở hoặc đã đóng.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Vui lòng liên hệ nhà trường để biết thêm chi tiết.
          </p>
        </div>
      ) : (
        <ApplyForm campaignId={id} level={info.level ?? "khoi_6"} />
      )}
      <footer className="mt-10 text-center text-xs text-muted-foreground">
        <Link href="/apply/tra-cuu" className="underline">
          Tra cứu trạng thái hồ sơ đã nộp
        </Link>
      </footer>
    </main>
  );
}

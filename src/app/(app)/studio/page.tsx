import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { requireFeature } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { TOOLS } from "@/lib/tvc/registry";
import { GROUP_LABEL, GROUP_COLOR } from "@/lib/tvc/types";
import type { ToolGroup } from "@/lib/tvc/types";
import {
  FileText, Table2, ClipboardCheck, Database, PenLine,
  Sigma, SquareFunction, BookOpen, MessageCircleQuestion,
  BookMarked, ListChecks, MessagesSquare, ArrowRight,
  Library, BookA,
} from "lucide-react";

const ICONS: Record<string, typeof FileText> = {
  "DC-01": FileText,
  "DC-02": Table2,
  "DC-03": ClipboardCheck,
  "DC-04": Database,
  "DC-05": PenLine,
  "T-01": Sigma,
  "T-02": SquareFunction,
  "V-01": BookMarked,
  "V-02": MessageCircleQuestion,
  "A-01": BookOpen,
  "A-02": ListChecks,
  "A-03": MessagesSquare,
};

const GROUPS: ToolGroup[] = ["core", "toan", "van", "anh"];

export default async function StudioPage() {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh", "admin"]);
  await requireFeature("studio");
  const supabase = await createClient();
  const { count } = await supabase
    .from("tvc_materials")
    .select("id", { count: "exact", head: true })
    .eq("author_id", profile.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        section="Công cụ số giáo viên"
        title="Công cụ soạn học liệu"
        description={`${count ?? 0} học liệu trong thư viện - chọn công cụ để bắt đầu biên soạn theo CTGDPT 2018`}
        actions={
          <div className="flex gap-2">
            <Link
              href="/studio/library"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Library className="h-4 w-4" /> Thư viện của tôi
            </Link>
            <Link
              href="/studio/yccd"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <BookA className="h-4 w-4" /> YCCĐ trường
            </Link>
          </div>
        }
      />

      {GROUPS.map((g) => {
        const tools = TOOLS.filter((t) => t.group === g);
        if (!tools.length) return null;
        return (
          <section key={g} className="mt-8">
            <h2
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${GROUP_COLOR[g]}`}
            >
              {GROUP_LABEL[g]}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((t) => {
                const Icon = ICONS[t.code] ?? FileText;
                const href = t.href ?? `/studio/${t.code}`;
                return (
                  <Link
                    key={t.code}
                    href={href}
                    className="group rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-muted p-2 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="font-semibold">{t.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {t.code}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

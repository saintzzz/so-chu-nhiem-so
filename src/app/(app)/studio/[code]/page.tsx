import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { requireFeature } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { subjectNameToCode } from "@/lib/tvc/subject-code";
import { TOOL_MAP } from "@/lib/tvc/registry";
import { toClientTool } from "@/lib/tvc/types";
import { ToolRunner } from "@/components/tvc/tool-runner";
import { ArrowLeft } from "lucide-react";

export default async function ToolPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh", "admin"]);
  await requireFeature("studio");
  const { code } = await params;
  const tool = TOOL_MAP.get(code);
  if (!tool) notFound();
  if (tool.href) redirect(tool.href);

  // CR-032: mon phu trach cua GV -> preselect subject trong tool
  const supabase = await createClient();
  const { data: ts } = await supabase
    .from("teacher_subjects")
    .select("subject_id")
    .eq("teacher_id", profile.id);
  let defaultSubject: string | undefined;
  if (ts?.length) {
    const { data: subs } = await supabase
      .from("subjects")
      .select("name")
      .in("id", ts.map((t) => t.subject_id));
    for (const s of subs ?? []) {
      const c = subjectNameToCode(s.name);
      if (c) {
        defaultSubject = c;
        break;
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/studio"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Tất cả công cụ
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">
          <span className="mr-2 font-mono text-sm text-muted-foreground">
            {tool.code}
          </span>
          {tool.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
      </div>
      <ToolRunner tool={toClientTool(tool)} defaultSubject={defaultSubject} />
    </div>
  );
}

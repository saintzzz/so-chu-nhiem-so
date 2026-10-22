import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { requireFeature } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Material } from "@/types/tvc";
import { MaterialActions } from "@/components/tvc/material-actions";
import { MaterialStatusBadge } from "@/components/tvc/status-badge";
import { ArrowLeft } from "lucide-react";
import { effectiveRoles, hasAnyRole } from "@/lib/roles";
import { must, mustRows } from "@/lib/supabase/must";
import { fetchAllRowsIn } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

export default async function StudioMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh", "admin"]);
  await requireFeature("studio");
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await must(supabase
    .from("tvc_materials")
    .select("*")
    .eq("id", id)
    .maybeSingle(), "tvc_materials");
  const material = data as Material | null;
  if (!material) notFound();
  // RLS da loc: chi doc duoc cua minh / hoc lieu xuat ban / cung truong (staff)

  const isReviewer = hasAnyRole(profile, ["to_truong", "bgh", "admin"]);
  const { data: revs } =
    material.author_id === profile.id || isReviewer
      ? await must(supabase
          .from("tvc_reviews")
          .select("layer, status, notes, created_at")
          .eq("material_id", id)
          .order("created_at"), "tvc_reviews")
      : { data: [] };

  const { data: stds } = material.standard_ids?.length
    ? await fetchAllRowsIn((chunk, f, t) =>
          supabase
        .from("tvc_curriculum_standards")
        .select("id, code, description")
        .in("id", chunk).order("id")
          .range(f, t),
        material.standard_ids).then((r) => ({ data: mustRows(r).rows }))
    : { data: [] };

  // CR-051: bo ho so de thi - cac van ban cung pack:<id> trong origin_note.
  const packKey = material.origin_note?.startsWith("pack:")
    ? material.origin_note
    : null;
  const { data: packMates } = packKey
    ? await must(
        supabase
          .from("tvc_materials")
          .select("id, title, status")
          .eq("origin_note", packKey)
          .neq("id", material.id)
          .order("created_at")
          .limit(10),
        "tvc_materials pack",
      )
    : { data: [] as { id: string; title: string; status: string }[] };

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/studio/library"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Thư viện
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{material.title}</h1>
        <MaterialStatusBadge status={material.status} />
        {material.ai_usage === "none" && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Bản khung mẫu - chưa có nội dung AI
          </span>
        )}
        {material.ai_usage === "partial" && (
          <span className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            AI một phần
          </span>
        )}
      </div>
      {(stds ?? []).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {(stds ?? []).map((s) => (
            <span
              key={s.id}
              className="rounded-full border bg-card px-3 py-1 font-mono text-xs"
              title={s.description}
            >
              {s.code}
            </span>
          ))}
        </div>
      )}
      {packMates && packMates.length > 0 && (
        <div className="mb-4 rounded-lg border bg-card p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Cùng bộ hồ sơ đề thi ({packMates.length + 1} văn bản)
          </p>
          <ul className="flex flex-wrap gap-2">
            {packMates.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/studio/library/${p.id}`}
                  className="inline-block rounded-full border px-3 py-1 text-sm hover:bg-muted"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <MaterialActions
        material={material}
        meId={profile.id}
        myRoles={effectiveRoles(profile)}
        reviews={revs ?? []}
      />
    </div>
  );
}

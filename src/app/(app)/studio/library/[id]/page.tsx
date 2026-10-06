import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { requireFeature } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Material } from "@/types/tvc";
import { MaterialActions } from "@/components/tvc/material-actions";
import { MaterialStatusBadge } from "@/components/tvc/status-badge";
import { ArrowLeft } from "lucide-react";

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
  const { data } = await supabase
    .from("tvc_materials")
    .select("*")
    .eq("id", id)
    .single();
  const material = data as Material | null;
  if (!material) notFound();
  // RLS da loc: chi doc duoc cua minh / hoc lieu xuat ban / cung truong (staff)

  const isReviewer = ["to_truong", "bgh", "admin"].includes(profile.role);
  const { data: revs } =
    material.author_id === profile.id || isReviewer
      ? await supabase
          .from("tvc_reviews")
          .select("layer, status, notes, created_at")
          .eq("material_id", id)
          .order("created_at")
      : { data: [] };

  const { data: stds } = material.standard_ids?.length
    ? await supabase
        .from("tvc_curriculum_standards")
        .select("id, code, description")
        .in("id", material.standard_ids)
    : { data: [] };

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
      <MaterialActions
        material={material}
        meId={profile.id}
        myRole={profile.role}
        reviews={revs ?? []}
      />
    </div>
  );
}

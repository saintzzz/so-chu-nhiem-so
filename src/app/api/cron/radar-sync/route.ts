import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRadarData } from "@/lib/school/radar";
import type { Profile } from "@/types";

/**
 * GET/POST /api/cron/radar-sync - dong bo canh bao radar vao early_warnings
 * cho tat ca truong. Goi hang ngay boi pg_cron / Vercel Cron.
 * Auth: header "authorization: Bearer <CRON_SECRET>" - giong parent-digest.
 * Trang /school/radar chi doc; viec ghi canh bao tap trung ve day + nut
 * "Lam moi canh bao" (refreshRadarWarnings).
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron disabled" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const ok =
    presented.length === secret.length &&
    timingSafeEqual(Buffer.from(presented), Buffer.from(secret));
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: schools } = await supabase.from("schools").select("id");
  const schoolIds = ((schools ?? []) as { id: string }[]).map((s) => s.id);

  let inserted = 0;
  const errors: string[] = [];
  for (const schoolId of schoolIds) {
    try {
      const { candidates } = await buildRadarData(supabase, {
        role: "bgh",
        school_id: schoolId,
      } as Profile);
      if (!candidates.length) continue;

      const { data: existing } = await supabase
        .from("early_warnings")
        .select("dedupe_key")
        .eq("school_id", schoolId)
        .in(
          "dedupe_key",
          candidates.map((c) => c.dedupe_key),
        );
      const have = new Set(
        ((existing ?? []) as { dedupe_key: string }[]).map((e) => e.dedupe_key),
      );
      const fresh = candidates
        .filter((c) => !have.has(c.dedupe_key))
        .map((c) => ({ ...c, school_id: schoolId }));
      if (fresh.length) {
        const { error } = await supabase.from("early_warnings").insert(fresh);
        if (error) errors.push(`${schoolId}: ${error.message}`);
        else inserted += fresh.length;
      }
    } catch (e) {
      errors.push(`${schoolId}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    schools: schoolIds.length,
    inserted,
    errors: errors.slice(0, 10),
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}

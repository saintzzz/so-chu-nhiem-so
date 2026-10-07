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
  const { data: schools, error: schoolsErr } = await supabase
    .from("schools")
    .select("id");
  if (schoolsErr) {
    console.error("[radar-sync] schools query failed:", schoolsErr.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  const schoolIds = ((schools ?? []) as { id: string }[]).map((s) => s.id);

  let inserted = 0;
  const errors: string[] = [];
  for (const schoolId of schoolIds) {
    try {
      const data = await buildRadarData(supabase, {
        role: "bgh",
        school_id: schoolId,
      } as Profile);
      // Nguon du lieu loi/truncated -> khong ghi canh bao tu du lieu thieu.
      if (data.errors.length) {
        for (const e of data.errors) errors.push(`${schoolId}: ${e}`);
        continue;
      }
      const { candidates } = data;
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
        if (error) {
          // Chi label co dinh ra response - chi tiet DB log server-side.
          console.error(`[radar-sync] insert failed ${schoolId}:`, error.message);
          errors.push(`${schoolId}: early_warnings insert`);
        } else {
          inserted += fresh.length;
        }
      }
    } catch (e) {
      console.error(`[radar-sync] school ${schoolId} failed:`, e);
      errors.push(`${schoolId}: sync failed`);
    }
  }

  return NextResponse.json(
    {
      ok: errors.length === 0,
      schools: schoolIds.length,
      inserted,
      errors: errors.slice(0, 10),
    },
    // Partial/total failure van phai tra 5xx de scheduler khong ghi nhan success sai.
    { status: errors.length ? 500 : 200 },
  );
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}

"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { checkActionRole, getProfile } from "@/lib/auth";
import { hasAnyRole } from "@/lib/roles";
import type { Role } from "@/types";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { getStudentYearEndBundle } from "@/lib/hocba";
import { buildHocBaXml, withSignatures, signHash } from "@/lib/hbxml";

const ROLES: Role[] = ["bgh", "admin", "gvcn"];

async function guard() {
  const deny = await checkActionRole(ROLES);
  if (deny) return deny;
  return assertModule("hoc_ba");
}

function mapRpcError(message: string): string {
  if (message.includes("module_disabled")) return "Module học bạ đã tắt.";
  if (message.includes("already_signed")) return "Học bạ đã ký BGH - không thể tạo lại.";
  if (message.includes("invalid_xml")) return "XML không hợp lệ.";
  if (message.includes("invalid_sha")) return "Checksum không hợp lệ.";
  if (message.includes("invalid_sig")) return "Chữ ký không hợp lệ.";
  if (message.includes("invalid_state")) return "Sai trình tự ký (GVCN ký trước, BGH sau).";
  if (message.includes("export_not_found")) return "Không tìm thấy bản export.";
  if (message.includes("forbidden")) return "Bạn không có quyền thực hiện thao tác này.";
  return message;
}

export async function generateExport(studentId: string, yearId: string) {
  const deny = await guard();
  if (deny) return deny;
  const supabase = await createClient();
  const bundle = await getStudentYearEndBundle(studentId, yearId);
  if (!bundle) return "Không tải được dữ liệu học bạ của học sinh.";

  const { data: yr } = await must(supabase
    .from("academic_years").select("name,school_id").eq("id", yearId).single(), "academic_years");
  const { data: sch } = await must(supabase
    .from("schools").select("name").eq("id", yr?.school_id ?? "").single(), "schools");
  const xml = buildHocBaXml(bundle, sch?.name ?? "", yr?.name ?? "");
  const sha = createHash("sha256").update(xml, "utf8").digest("hex");

  const { error } = await supabase.rpc("hb_store", {
    p_student: studentId, p_year: yearId, p_xml: xml, p_sha: sha,
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/records/exports");
  return null;
}

export async function signExport(exportId: string) {
  const deny = await guard();
  if (deny) return deny;
  const profile = await getProfile();
  const supabase = await createClient();
  const role = hasAnyRole(profile!, ["bgh", "admin"]) ? "bgh" : "gvcn";

  const { data: exp } = await must(supabase
    .from("hb_exports").select("id,sha256").eq("id", exportId).maybeSingle(), "hb_exports");
  if (!exp) return "Không tìm thấy bản export.";
  const sig = signHash(exp.id, role, exp.sha256);

  const { error } = await supabase.rpc("hb_sign", {
    p_id: exportId, p_role: role, p_sig: sig,
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/records/exports");
  return null;
}

export async function downloadExport(exportId: string): Promise<
  { xml: string; filename: string; verify: { shaOk: boolean; gvcnOk: boolean; bghOk: boolean } } | { error: string }
> {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data: e } = await must(supabase
    .from("hb_exports")
    .select("id,xml,sha256,gvcn_sig,gvcn_at,bgh_sig,bgh_at,students(full_name,code),profiles_gvcn:gvcn_by(full_name),profiles_bgh:bgh_by(full_name)")
    .eq("id", exportId).maybeSingle(), "hb_exports");
  if (!e) return { error: "Không tìm thấy bản export." };

  const shaOk = createHash("sha256").update(e.xml, "utf8").digest("hex") === e.sha256;
  const stu = e.students as unknown as { full_name: string; code: string } | null;
  const finalXml = withSignatures(e.xml, {
    gvcn: e.gvcn_sig ? {
      sig: e.gvcn_sig,
      by: (e.profiles_gvcn as unknown as { full_name: string } | null)?.full_name ?? "",
      at: e.gvcn_at ?? "",
    } : undefined,
    bgh: e.bgh_sig ? {
      sig: e.bgh_sig,
      by: (e.profiles_bgh as unknown as { full_name: string } | null)?.full_name ?? "",
      at: e.bgh_at ?? "",
    } : undefined,
  });
  return {
    xml: finalXml,
    filename: `hocba-${stu?.code ?? exportId}.xml`,
    verify: {
      shaOk,
      gvcnOk: !e.gvcn_sig || e.gvcn_sig === signHash(e.id, "gvcn", e.sha256),
      bghOk: !e.bgh_sig || e.bgh_sig === signHash(e.id, "bgh", e.sha256),
    },
  };
}

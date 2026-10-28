"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole } from "@/lib/auth";
import type { Role } from "@/types";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

// CR-072: tich hop - bgh|admin quan ly connectors + retry outbox.
const ROLES: Role[] = ["bgh", "admin"];

async function guard() {
  const deny = await checkActionRole(ROLES);
  if (deny) return deny;
  return assertModule("tich_hop");
}

function mapRpcError(message: string): string {
  if (message.includes("module_disabled")) return "Module tích hợp đã tắt.";
  if (message.includes("invalid_name")) return "Tên connector không được để trống.";
  if (message.includes("invalid_type")) return "Loại connector không hợp lệ.";
  if (message.includes("invalid_auth")) return "Kiểu xác thực không hợp lệ.";
  if (message.includes("secret_name_required")) return "Nhập tên biến env chứa secret.";
  if (message.includes("endpoint_required")) return "Nhập endpoint URL.";
  if (message.includes("connector_not_found")) return "Không tìm thấy connector.";
  if (message.includes("connector_disabled")) return "Connector đang tắt.";
  if (message.includes("invalid_event")) return "Tên event không được để trống.";
  if (message.includes("event_not_found")) return "Không tìm thấy event.";
  if (message.includes("forbidden")) return "Bạn không có quyền thực hiện thao tác này.";
  return message;
}

export async function saveConnector(input: {
  id?: string;
  type: string;
  name: string;
  endpoint?: string;
  authType: string;
  secretName?: string;
  config?: Record<string, string>;
  enabled?: boolean;
}) {
  const deny = await guard();
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("int_upsert_connector", {
    p_id: input.id ?? null,
    p_type: input.type,
    p_name: input.name,
    p_endpoint: input.endpoint ?? null,
    p_auth_type: input.authType,
    p_secret_name: input.secretName ?? null,
    p_config: input.config ?? {},
    p_enabled: input.enabled ?? true,
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/school/integrations");
  return null;
}

export async function deleteConnector(id: string) {
  const deny = await guard();
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("int_delete_connector", { p_id: id });
  if (error) return mapRpcError(error.message);
  revalidatePath("/school/integrations");
  return null;
}

export async function retryEvent(id: string) {
  const deny = await guard();
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("int_retry", { p_id: id });
  if (error) return mapRpcError(error.message);
  revalidatePath("/school/integrations");
  return null;
}

export async function testEvent(connectorId: string) {
  const deny = await guard();
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("int_enqueue", {
    p_connector: connectorId,
    p_event: "test.ping",
    p_payload: { source: "admin_ui" },
    p_idem: `test-${connectorId}-${Date.now()}`,
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/school/integrations");
  return null;
}

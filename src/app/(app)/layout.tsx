import { redirect } from "next/navigation";
import { requireProfile, STAFF_ROLES } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { disabledModules } from "@/lib/modules";
import { hasRole, hasAnyRole } from "@/lib/roles";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  if (!hasAnyRole(profile, STAFF_ROLES)) {
    redirect("/portal/" + (hasRole(profile, "phu_huynh") ? "parent" : "student"));
  }
  // r-h0601: nav thi fail-open (an menu ma loi DB se vo toan bo app);
  // route guards van fail-closed rieng. Neu bang chua migrate thi app
  // van chay, chi module filter khong ap dung.
  let disabled: string[] = [];
  try {
    disabled = [...(await disabledModules())];
  } catch (e) {
    console.error("[layout] disabledModules failed:", e);
  }
  return (
    <AppShell profile={profile} disabledModules={disabled}>
      {children}
    </AppShell>
  );
}

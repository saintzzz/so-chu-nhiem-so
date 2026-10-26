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
  const disabled = [...(await disabledModules())];
  return (
    <AppShell profile={profile} disabledModules={disabled}>
      {children}
    </AppShell>
  );
}

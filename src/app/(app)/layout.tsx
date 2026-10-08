import { redirect } from "next/navigation";
import { requireProfile, STAFF_ROLES } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
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
  return <AppShell profile={profile}>{children}</AppShell>;
}

import { redirect } from "next/navigation";
import { requireProfile, STAFF_ROLES } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  if (!STAFF_ROLES.includes(profile.role)) {
    redirect("/portal/" + (profile.role === "phu_huynh" ? "parent" : "student"));
  }
  return <AppShell profile={profile}>{children}</AppShell>;
}

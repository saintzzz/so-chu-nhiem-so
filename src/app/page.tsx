import { redirect } from "next/navigation";
import { getProfile, ROLE_HOME } from "@/lib/auth";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/api/auth/reset");
  redirect(ROLE_HOME[profile.role]);
}
